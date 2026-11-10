import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryService } from './cloudinary.service';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaUploadRepository } from './repositories/media-upload.repository';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    CloudinaryService,
    MediaCleanupService,
    MediaUploadRepository,
  ],
  exports: [MediaService],
})
export class MediaModule {}
