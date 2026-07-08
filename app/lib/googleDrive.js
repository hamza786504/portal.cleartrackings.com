import { google } from 'googleapis';
import { Readable } from 'stream';

class GoogleDriveService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // The refresh token is enough — googleapis fetches a fresh access token
    // from it automatically whenever one is needed.
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
    }

    // Create the Drive client ONCE and reuse across all method calls.
    // Previously a new client was created on every uploadFile() call,
    // which wasted memory and object initialization time.
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Upload a single file to Google Drive.
   * @param {{ originalname: string, mimetype: string, buffer: Buffer }} file
   * @param {string|null} folderId
   */
  async uploadFile(file, folderId = null) {
    try {
      const metadata = {
        name: file.originalname,
        parents: folderId ? [folderId] : [],
      };

      // Convert Buffer to a Node.js Readable stream
      const readable = Readable.from(file.buffer);

      const response = await this.drive.files.create({
        requestBody: metadata,
        media: {
          mimeType: file.mimetype,
          body: readable,
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
   * Previously used a sequential for-loop which held the server process busy
   * for (N files × upload time). Promise.all() releases the process much faster
   * as all uploads run concurrently.
   */
  async uploadMultipleFiles(files, folderId = null) {
    const targetFolder = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    return Promise.all(files.map((file) => this.uploadFile(file, targetFolder)));
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
   * Get the account's Drive storage quota (limit/usage in bytes).
   * `limit` is null when the account has unlimited storage.
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
   * Generate the OAuth2 authorization URL.
   */
  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force Google to always issue a refresh_token
      scope: ['https://www.googleapis.com/auth/drive.file'],
    });
  }

  /**
   * Exchange an authorization code for tokens.
   */
  async getAccessToken(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }
}

const driveService = new GoogleDriveService();
export default driveService;