import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Query,
  BadRequestException,
  Body,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetCurrentUser } from '@app/common/decorators/get-current-user.decorator';

interface UploadBase64Dto {
  fileName: string;
  mimeType: string;
  base64: string;
}

@ApiTags('File Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post('test-public')
  @ApiOperation({ summary: 'Test endpoint without auth' })
  async testPublic() {
    this.logger.log('[UploadController] Test public endpoint called');
    return {
      message: 'Upload controller is working!',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('avatar-base64')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload avatar as Base64 (avoids multipart issues)' })
  @ApiResponse({
    status: 201,
    description: 'Avatar uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  async uploadAvatarBase64(
    @Body() dto: UploadBase64Dto,
    @GetCurrentUser('sub') userId?: number,
  ) {
    this.logger.log(`[UploadController] uploadAvatarBase64 called - userId: ${userId}`);
    this.logger.log(`[UploadController] fileName: ${dto.fileName}, size: ${dto.base64.length}`);

    if (!dto.base64 || !dto.fileName) {
      throw new BadRequestException('Missing required fields');
    }

    // Convert Base64 to Buffer
    const buffer = Buffer.from(dto.base64, 'base64');

    // Create mock Multer file object
    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: dto.fileName,
      encoding: 'base64',
      mimetype: dto.mimeType,
      size: buffer.length,
      buffer: buffer,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const folderPath = `avatars/${userId}`;
    this.logger.log(`[UploadController] Starting Base64 upload to folder: ${folderPath}`);

    const fileUrl = await this.uploadService.uploadFile(file, folderPath);

    this.logger.log(`[UploadController] Base64 upload successful: ${fileUrl}`);

    return { url: fileUrl };
  }

  @Post('file-base64')
  @ApiOperation({ summary: 'Upload file as Base64 (avoids multipart timeout issues)' })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        fileType: { type: 'string' },
        fileName: { type: 'string' },
        size: { type: 'number' },
        mimetype: { type: 'string' },
      },
    },
  })
  async uploadFileBase64(
    @Body() dto: UploadBase64Dto,
    @GetCurrentUser('sub') userId?: number,
  ) {
    this.logger.log(`[UploadController] uploadFileBase64 called - userId: ${userId}`);
    this.logger.log(`[UploadController] fileName: ${dto.fileName}, mimeType: ${dto.mimeType}, size: ${dto.base64.length}`);

    if (!dto.base64 || !dto.fileName || !dto.mimeType) {
      throw new BadRequestException('Missing required fields: fileName, base64, mimeType');
    }

    // TEMPORARY: Return mock URL to test request flow
    // TODO: Fix actual upload issue
    this.logger.log(`[UploadController] Returning mock URL for testing`);
    const mockUrl = `data:${dto.mimeType};base64,${dto.base64}`;

    return {
      url: mockUrl,
      fileType: this.uploadService.getFileTypeCategory(dto.mimeType),
      fileName: dto.fileName,
      size: dto.base64.length,
      mimetype: dto.mimeType,
    };

    /* ORIGINAL CODE - DISABLED FOR TESTING
    // Convert Base64 to Buffer
    const buffer = Buffer.from(dto.base64, 'base64');

    // Create mock Multer file object
    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: dto.fileName,
      encoding: 'base64',
      mimetype: dto.mimeType,
      size: buffer.length,
      buffer: buffer,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    // Use attachments folder for chat files
    const folderPath = `attachments/${userId}`;
    this.logger.log(`[UploadController] Starting Base64 file upload to folder: ${folderPath}`);

    const fileUrl = await this.uploadService.uploadFile(file, folderPath);

    this.logger.log(`[UploadController] Base64 file upload successful: ${fileUrl}`);

    return {
      url: fileUrl,
      fileType: this.uploadService.getFileTypeCategory(dto.mimeType),
      fileName: dto.fileName,
      size: buffer.length,
      mimetype: dto.mimeType,
    };
    */
  }

  @Post('single')
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        fileType: { type: 'string' },
        fileName: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingleFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
    @GetCurrentUser('sub') userId?: number,
  ) {
    this.logger.log(`[UploadController] uploadSingleFile called - userId: ${userId}, folder: ${folder}`);
    this.logger.log(`[UploadController] file: ${file?.originalname}, size: ${file?.size}, mimetype: ${file?.mimetype}`);

    if (!file) {
      this.logger.error('[UploadController] No file provided!');
      throw new BadRequestException('No file provided');
    }

    const folderPath = folder || `attachments/${userId}`;
    this.logger.log(`[UploadController] Starting upload to folder: ${folderPath}`);

    const fileUrl = await this.uploadService.uploadFile(file, folderPath);

    this.logger.log(`[UploadController] Upload successful: ${fileUrl}`);

    return {
      url: fileUrl,
      fileType: this.uploadService.getFileTypeCategory(file.mimetype),
      fileName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('multiple')
  @ApiOperation({ summary: 'Upload multiple files (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              fileType: { type: 'string' },
              fileName: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder?: string,
    @GetCurrentUser('sub') userId?: number,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const folderPath = folder || `attachments/${userId}`;
    const fileUrls = await this.uploadService.uploadMultipleFiles(
      files,
      folderPath,
    );

    return {
      files: files.map((file, index) => ({
        url: fileUrls[index],
        fileType: this.uploadService.getFileTypeCategory(file.mimetype),
        fileName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      })),
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Delete a file' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(@Body('fileUrl') fileUrl: string) {
    if (!fileUrl) {
      throw new BadRequestException('File URL is required');
    }

    await this.uploadService.deleteFile(fileUrl);

    return {
      message: 'File deleted successfully',
    };
  }
}
