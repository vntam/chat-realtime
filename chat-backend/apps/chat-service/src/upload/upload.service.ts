import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly useS3: boolean;

  // File size limits (in bytes) - from environment variables
  private readonly MAX_FILE_SIZE: number;
  private readonly MAX_IMAGE_SIZE: number;
  private readonly MAX_VIDEO_SIZE: number;

  // Allowed file types
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
  ];
  private readonly ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  constructor() {
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'chat-uploads';
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.useS3 = process.env.USE_S3_STORAGE === 'true';

    // Load file size limits from environment variables
    this.MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // Default 10MB
    this.MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '5242880', 10); // Default 5MB
    this.MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE || '52428800', 10); // Default 50MB

    if (this.useS3) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });
      this.logger.log(`S3 upload initialized for bucket: ${this.bucketName}`);
    } else {
      this.logger.log('Using local file storage (S3 disabled)');
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size based on type
    if (this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      if (file.size > this.MAX_IMAGE_SIZE) {
        throw new BadRequestException(
          `Image size exceeds maximum allowed size of ${this.MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        );
      }
    } else if (this.ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      if (file.size > this.MAX_VIDEO_SIZE) {
        throw new BadRequestException(
          `Video size exceeds maximum allowed size of ${this.MAX_VIDEO_SIZE / 1024 / 1024}MB`,
        );
      }
    } else if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Check file type
    const allAllowedTypes = [
      ...this.ALLOWED_IMAGE_TYPES,
      ...this.ALLOWED_VIDEO_TYPES,
      ...this.ALLOWED_DOCUMENT_TYPES,
    ];

    if (!allAllowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }
  }

  /**
   * Upload file to S3 or local storage
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'attachments',
  ): Promise<string> {
    this.validateFile(file);

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;

    if (this.useS3) {
      return this.uploadToS3(file, fileName);
    } else {
      return this.uploadToLocal(file, fileName);
    }
  }

  /**
   * Upload to AWS S3
   */
  private async uploadToS3(
    file: Express.Multer.File,
    fileName: string,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read', // Make files publicly accessible
      });

      await this.s3Client.send(command);

      const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileName}`;
      this.logger.log(`File uploaded to S3: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(`S3 upload failed: ${error.message}`);
      throw new BadRequestException('File upload failed');
    }
  }

  /**
   * Upload to local storage (for development)
   */
  private uploadToLocal(file: Express.Multer.File, fileName: string): string {
    // For local development, return a mock URL
    // In production, you would save to disk using fs
    const localUrl = `http://localhost:3002/uploads/${fileName}`;
    this.logger.log(`File would be saved locally as: ${localUrl}`);

    // TODO: Implement actual file system storage if needed
    // const uploadPath = path.join(__dirname, '../../../uploads', fileName);
    // fs.writeFileSync(uploadPath, file.buffer);

    return localUrl;
  }

  /**
   * Delete file from S3 or local storage
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!this.useS3) {
      this.logger.log(`Would delete local file: ${fileUrl}`);
      // TODO: Implement local file deletion
      return;
    }

    try {
      // Extract file key from URL
      const url = new URL(fileUrl);
      const fileName = url.pathname.substring(1); // Remove leading slash

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from S3: ${fileName}`);
    } catch (error) {
      this.logger.error(`S3 deletion failed: ${error.message}`);
      // Don't throw error for deletion failures
    }
  }

  /**
   * Get file type category
   */
  getFileTypeCategory(mimetype: string): string {
    if (this.ALLOWED_IMAGE_TYPES.includes(mimetype)) {
      return 'image';
    } else if (this.ALLOWED_VIDEO_TYPES.includes(mimetype)) {
      return 'video';
    } else if (this.ALLOWED_DOCUMENT_TYPES.includes(mimetype)) {
      return 'document';
    }
    return 'other';
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'attachments',
  ): Promise<string[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed per upload');
    }

    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }
}
