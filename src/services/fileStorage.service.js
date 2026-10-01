const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/database');

class FileStorageService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
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
    const safeEntityType = String(entityType || 'misc').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!safeEntityType) throw new Error('Invalid entity type');
    const maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
    if (!file?.buffer || !file?.originalname || !file?.mimetype) throw new Error('Invalid upload payload');
    if (file.buffer.length > maxBytes) throw new Error('Upload exceeds maximum allowed size');

    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const fileName = `${timestamp}_${random}${ext}`;
    const storageKey = `${safeEntityType}/${fileName}`;
    const entityDir = path.join(this.uploadDir, safeEntityType);
    await fs.mkdir(entityDir, { recursive: true });
    const filePath = path.join(entityDir, fileName);

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Generate URL (relative to uploads directory)
    const relativeUrl = `/uploads/${storageKey}`;
    const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const fileUrl = base ? `${base}${relativeUrl}` : relativeUrl;

    // Save metadata to database
    const mediaFile = await prisma.mediaFile.create({
      data: {
        fileName: fileName,
        originalName: file.originalname,
        fileUrl: fileUrl,
        fileType: this.getFileType(file.mimetype),
        mimeType: file.mimetype,
        fileSize: file.buffer.length,
        entityType: safeEntityType.toUpperCase(),
        entityId: entityId,
        uploadedBy: userId,
        storageKey
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
    const safeMediaId = String(mediaId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `whatsapp_${timestamp}_${safeMediaId}${ext}`;
    const storageKey = `whatsapp/${fileName}`;
    const filePath = path.join(this.uploadDir, storageKey);

    await fs.writeFile(filePath, buffer);

    const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const fileUrl = base ? `${base}/uploads/${storageKey}` : `/uploads/${storageKey}`;

    const mediaFile = await prisma.mediaFile.create({
      data: {
        fileName: fileName,
        originalName: fileName,
        fileUrl: fileUrl,
        fileType: this.getFileType(mimeType),
        mimeType: mimeType,
        fileSize: buffer.length,
        entityType: 'WHATSAPP',
        entityId: mediaId,
        storageKey
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
    const filePath = path.join(this.uploadDir, file.storageKey);
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

