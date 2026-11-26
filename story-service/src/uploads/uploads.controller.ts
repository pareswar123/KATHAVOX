import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UPLOAD_REQUEST_LIMITS } from '../config/upload';
import { t } from '../i18n/i18n';
import { UserRole } from '../database/entities';
import { Roles } from '../auth/auth.decorators';
import { UploadKind, UploadsService } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @Roles(UserRole.AUTHOR, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_REQUEST_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a cover (cover) or in-story image (image). JPEG, PNG or WebP only.' })
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Query('kind') kind: string) {
    if (!file) throw new BadRequestException(t('uploads.missingFile'));
    if (kind !== 'cover' && kind !== 'image') {
      throw new BadRequestException(t('uploads.invalidKind'));
    }
    return this.uploads.save(file.buffer, kind as UploadKind);
  }
}
