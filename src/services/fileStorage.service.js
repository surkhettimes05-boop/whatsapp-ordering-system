const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/database');

class FileStorageService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.ensureUploadDir();
  }

  /**
   * Ensure upload directory exists
   */
  async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }

    // Create subdirectories
    const subdirs = ['products', 'users', 'orders', 'support', 'whatsapp'];
    for (const subdir of subdirs) {
      const subdirPath = path.join(this.uploadDir, subdir);
      try {
        await fs.access(subdirPath);
      } catch {
        await fs.mkdir(subdirPath, { recursive: true });
      }
    }
  }

  /**
   * Save file
   */
  async saveFile(file, entityType, entityId = null, userId = null) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp}_${random}${ext}`;
    const filePath = path.join(this.uploadDir, entityType.toLowerCase(), fileName);

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Generate URL (relative to uploads directory)
    const fileUrl = `/uploads/${entityType.toLowerCase()}/${fileName}`;

    // Save metadata to database
    const mediaFile = await prisma.mediaFile.create({
      data: {
        fileName: fileName,
        originalName: file.originalname,
        fileUrl: fileUrl,
        fileType: this.getFileType(file.mimetype),
        mimeType: file.mimetype,
        fileSize: file.size,
        entityType: entityType.toUpperCase(),
        entityId: entityId,
        uploadedBy: userId
      }
    });

    return mediaFile;
  }

  /**
   * Save WhatsApp media
   */
  async saveWhatsAppMedia(mediaId, buffer, mimeType) {
    const timestamp = Date.now();
    const ext = this.getExtensionFromMimeType(mimeType);
    const fileName = `whatsapp_${timestamp}_${mediaId}${ext}`;
    const filePath = path.join(this.uploadDir, 'whatsapp', fileName);

    await fs.writeFile(filePath, buffer);

    const fileUrl = `/uploads/whatsapp/${fileName}`;

    const mediaFile = await prisma.mediaFile.create({
      data: {
        fileName: fileName,
        originalName: fileName,
        fileUrl: fileUrl,
        fileType: this.getFileType(mimeType),
        mimeType: mimeType,
        fileSize: buffer.length,
        entityType: 'WHATSAPP',
        entityId: mediaId
      }
    });

    return mediaFile;
  }

  /**
   * Get file type from mime type
   */
  getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }

  /**
   * Get extension from mime type
   */
  getExtensionFromMimeType(mimeType) {
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
    };

    return mimeToExt[mimeType] || '.bin';
  }

  /**
   * Delete file
   */
  async deleteFile(fileId) {
    const file = await prisma.mediaFile.findUnique({
      where: { id: fileId }
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Delete from disk
    const filePath = path.join(__dirname, '../../', file.fileUrl);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file from disk:', error);
    }

    // Delete from database
    await prisma.mediaFile.delete({
      where: { id: fileId }
    });

    return { success: true };
  }

  /**
   * Get file by ID
   */
  async getFile(fileId) {
    const file = await prisma.mediaFile.findUnique({
      where: { id: fileId }
    });

    if (!file) {
      throw new Error('File not found');
    }

    return file;
  }
}

module.exports = new FileStorageService();

