import { google } from 'googleapis';
import { Readable } from 'stream';

// Build an OAuth2 auth client from a refresh token belonging to a REAL
// Google account (the app owner's personal Gmail that has the storage plan).
//
// Why OAuth2 and not a service account?
//   A service account has NO Drive storage quota on a personal (non-Workspace)
//   account — Google rejects uploads with "storageQuotaExceeded". Files uploaded
//   with THIS client are owned by the account behind GOOGLE_REFRESH_TOKEN and
//   consume that account's quota (e.g. the 200GB Google One plan).
//
// The doctor never sees Google: the OAuth consent is a ONE-TIME setup step done
// by the app owner to mint GOOGLE_REFRESH_TOKEN. After that, uploads are fully
// server-side and the access token is auto-refreshed from the refresh token.
//
// Required env vars (.env.local):
//   GOOGLE_CLIENT_ID       - OAuth 2.0 Client ID
//   GOOGLE_CLIENT_SECRET   - OAuth 2.0 Client secret
//   GOOGLE_REFRESH_TOKEN   - refresh token minted once with the drive scope
//   GOOGLE_DRIVE_FOLDER_ID - root folder ("Doctor Portal Case") id
//   GOOGLE_OAUTH_REDIRECT_URI (optional) - redirect used when minting the token
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    'https://developers.google.com/oauthplayground'
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

// Create the Drive client ONCE and reuse it across all method calls.
// The OAuth2 client transparently refreshes the short-lived access token using
// the refresh token, so this survives server restarts.
const drive = google.drive({ version: 'v3', auth: oauth2Client });

class GoogleDriveService {
  constructor() {
    this.drive = drive;
  }

  /**
   * Upload a single file to Google Drive.
   * @param {{ originalname: string, mimetype: string, buffer: Buffer }} file
   * @param {string|null} folderId
   */
  async uploadFile(file, folderId = null) {
    try {
      const { originalname, mimetype, buffer } = file;

      const metadata = {
        name: originalname,
        mimeType: mimetype,
      };

      if (folderId) {
        metadata.parents = [folderId];
      }

      const response = await this.drive.files.create({
        requestBody: metadata,
        media: {
          mimeType: mimetype,
          body: Readable.from(buffer),
        },
        fields: 'id,name,mimeType,size,webViewLink',
      });

      // Make the file publicly viewable
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
        webViewLink: response.data.webViewLink,
      };
    } catch (error) {
      console.error('Google Drive upload error:', error);
      throw error;
    }
  }

  /**
  * Upload multiple files to Google Drive IN PARALLEL.
  */
  async uploadMultipleFiles(files, folderId = null) {
    const uploadPromises = files.map(file => this.uploadFile(file, folderId));
    return Promise.all(uploadPromises);
  }

  /**
  * Get the ID of a folder by name.
  */
  async getFolderId(folderName) {
    try {
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });
      return response.data.files.length > 0 ? response.data.files[0].id : null;
    } catch (error) {
      console.error('Error getting folder ID:', error);
      return null;
    }
  }

  /**
  * Create a folder in Google Drive.
  */
  async createFolder(folderName, parentFolderId = null) {
    try {
      const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };
      if (parentFolderId) {
        metadata.parents = [parentFolderId];
      }
      const response = await this.drive.files.create({
        requestBody: metadata,
        fields: 'id,name',
      });
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
  * Permanently delete a file or folder from Google Drive (bypasses trash).
  */
  async deleteFile(fileId) {
    if (!fileId) return false;
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (error) {
      console.error(`Drive delete failed for ${fileId}:`, error.message);
      return false;
    }
  }

  /**
  * Create the full Drive layout for a single case:
  *   <ROOT>/[YYYY-MM-DD] - [patient name]/   (caseFolderId)
  *        └─ chat/                            (chatFolderId)
  * where <ROOT> is GOOGLE_DRIVE_FOLDER_ID when set, otherwise Drive root.
  * Returns the folder ids/name so callers can persist them on the case row.
  * Throws on failure so callers can decide whether to fall back to root.
  */
  async ensureCaseFolders(folderName, parentFolderId = null) {
    const root = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    const caseFolder = await this.createFolder(folderName, root);
    const chatFolder = await this.createFolder('chat', caseFolder.id);
    return {
      caseFolderId: caseFolder.id,
      caseFolderName: caseFolder.name,
      chatFolderId: chatFolder.id,
    };
  }

  /**
  * Create (or recreate) the "chat" subfolder under an existing case folder.
  */
  async ensureChatSubfolder(parentFolderId) {
    const folder = await this.createFolder('chat', parentFolderId);
    return folder.id;
  }

  /**
   * Create the "revisions" subfolder under an existing case folder. Revisions
   * of a case share this one folder (each revision's files are tracked in its
   * own JSON arrays), so callers should reuse an existing revisionsFolderId
   * rather than always recreating it.
   */
  async ensureRevisionsSubfolder(parentFolderId) {
    const folder = await this.createFolder('revisions', parentFolderId);
    return folder.id;
  }

  /**
  * Get the account's Drive storage quota (limit/usage in bytes).
  */
  async getStorageQuota() {
    try {
      const response = await this.drive.about.get({ fields: 'storageQuota' });
      const quota = response.data.storageQuota || {};
      return {
        limit: quota.limit ? Number(quota.limit) : null,
        usage: quota.usage ? Number(quota.usage) : 0,
        usageInDrive: quota.usageInDrive ? Number(quota.usageInDrive) : 0,
        usageInDriveTrash: quota.usageInDriveTrash ? Number(quota.usageInDriveTrash) : 0,
      };
    } catch (error) {
      console.error('Error getting storage quota:', error);
      throw error;
    }
  }

  /**
  * List EVERY file the app can see in Drive (trashed=false), paginating
  * through all pages. Under the `drive.file` scope this is limited to files
  * the app itself created — which is exactly the universe the Drive Manager
  * admin tab cares about (orphaned uploads that aren't tied to a case).
  *
  * Returns a flat array of lightweight metadata:
  *   { id, name, mimeType, size, createdTime, modifiedTime,
  *     webViewLink, iconLink, parents }
  * (size is a number or null; parents is an array of folder ids, possibly empty.)
  */
  async listAllFiles() {
    try {
      const files = [];
      let pageToken = null;

      do {
        const response = await this.drive.files.list({
          q: 'trashed=false',
          pageSize: 1000,
          pageToken: pageToken || undefined,
          fields:
            'nextPageToken, files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,parents)',
        });
        const batch = response.data.files || [];
        for (const f of batch) {
          files.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size ? Number(f.size) : null,
            createdTime: f.createdTime || null,
            modifiedTime: f.modifiedTime || null,
            webViewLink: f.webViewLink || null,
            iconLink: f.iconLink || null,
            parents: Array.isArray(f.parents) ? f.parents : [],
          });
        }
        pageToken = response.data.nextPageToken || null;
      } while (pageToken);

      return files;
    } catch (error) {
      console.error('Error listing Drive files:', error);
      throw error;
    }
  }

  /**
  * Fetch a single file's lightweight metadata by id (used by the delete
  * safety check to inspect the file's parents before removing it).
  */
  async getFile(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,parents',
      });
      const f = response.data;
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : null,
        createdTime: f.createdTime || null,
        modifiedTime: f.modifiedTime || null,
        webViewLink: f.webViewLink || null,
        iconLink: f.iconLink || null,
        parents: Array.isArray(f.parents) ? f.parents : [],
      };
    } catch (error) {
      // 404 / permission errors both mean "can't act on this file".
      if (error?.response?.status === 404) return null;
      console.error(`Drive getFile failed for ${fileId}:`, error.message);
      return null;
    }
  }

  /**
  * Download a file's raw bytes as a Node stream, plus its metadata. Used by
  * the image preview proxy so the browser never has to hit Drive's public
  * thumbnail endpoint (which Google intermittently answers with 503).
  * Returns null when the file doesn't exist or isn't accessible.
  */
  async getFileStream(fileId) {
    const meta = await this.getFile(fileId);
    if (!meta) return null;
    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return { meta, stream: response.data };
  }

  /**
  * Generate the OAuth2 authorization URL used to mint GOOGLE_REFRESH_TOKEN.
  * Visit this URL once (as the storage account owner), approve access, and
  * exchange the returned code via getAccessToken() to obtain a refresh token.
  */
  /**
   * List the immediate children of a folder (non-recursive). Used to walk the
   * Drive tree for the file-explorer admin tab and for recursive deletes.
   * Returns the same lightweight shape as listAllFiles/getFile.
   */
  async listFilesInFolder(folderId, fields) {
    const want =
      fields ||
      'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,parents';
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        pageSize: 1000,
        fields: `nextPageToken, files(${want})`,
      });
      const batch = response.data.files || [];
      return batch.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : null,
        createdTime: f.createdTime || null,
        modifiedTime: f.modifiedTime || null,
        webViewLink: f.webViewLink || null,
        iconLink: f.iconLink || null,
        parents: Array.isArray(f.parents) ? f.parents : [],
      }));
    } catch (error) {
      console.error(`Error listing folder ${folderId}:`, error.message);
      return [];
    }
  }

  getAuthUrl() {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force Google to always issue a refresh_token
      scope: ['https://www.googleapis.com/auth/drive'],
    });
  }

  /**
  * Exchange an authorization code for tokens (one-time setup helper).
  * The returned tokens.refresh_token is what you store in GOOGLE_REFRESH_TOKEN.
  */
  async getAccessToken(code) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
  }
}

// Initialize the service
const driveService = new GoogleDriveService();
export default driveService;