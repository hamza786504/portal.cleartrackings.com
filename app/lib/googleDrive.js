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
  }

  /**
   * Upload a single file to Google Drive.
   * @param {{ originalname: string, mimetype: string, buffer: Buffer }} file
   * @param {string|null} folderId
   */
  async uploadFile(file, folderId = null) {
    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      const metadata = {
        name: file.originalname,
        parents: folderId ? [folderId] : [],
      };

      // Convert Buffer to a Node.js Readable stream
      const readable = Readable.from(file.buffer);

      const response = await drive.files.create({
        requestBody: metadata,
        media: {
          mimeType: file.mimetype,
          body: readable,
        },
        fields: 'id,name,mimeType,size,webViewLink',
      });

      // Make the file publicly viewable
      await drive.permissions.create({
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
   * Upload multiple files to Google Drive.
   */
  async uploadMultipleFiles(files, folderId = null) {
    const uploadedFiles = [];
    for (const file of files) {
      const uploaded = await this.uploadFile(file, folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || null);
      uploadedFiles.push(uploaded);
    }
    return uploadedFiles;
  }

  /**
   * Get the ID of a folder by name.
   */
  async getFolderId(folderName) {
    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const response = await drive.files.list({
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
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };
      if (parentFolderId) {
        metadata.parents = [parentFolderId];
      }
      const response = await drive.files.create({
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
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const response = await drive.about.get({ fields: 'storageQuota' });
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