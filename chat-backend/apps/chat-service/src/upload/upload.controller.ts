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
import { AuthGuard } from '@app/common/guards/auth.guard';
import { GetCurrentUser } from '@app/common/decorators/get-current-user.decorator';

@ApiTags('File Upload')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

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
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const folderPath = folder || `attachments/${userId}`;
    const fileUrl = await this.uploadService.uploadFile(file, folderPath);

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
