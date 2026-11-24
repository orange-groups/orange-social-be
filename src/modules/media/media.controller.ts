import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { AvatarFileInterceptor } from './avatar-file.interceptor';
import type { AvatarFile } from './avatar-file.interceptor';
import { CreateUploadSignatureDto } from './dto/create-upload-signature.dto';
import type { UploadAvatarResponseDto } from './dto/upload-avatar-response.dto';
import type { UploadSignatureResponseDto } from './dto/upload-signature-response.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('avatar')
  @UseInterceptors(AvatarFileInterceptor)
  uploadAvatar(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() file?: AvatarFile,
  ): Promise<UploadAvatarResponseDto> {
    return this.media.uploadAvatar(user.sub, file?.buffer);
  }

  @Post('upload-signature')
  createUploadSignature(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateUploadSignatureDto,
  ): Promise<UploadSignatureResponseDto> {
    return this.media.createUploadSignature(user.sub, dto.purpose);
  }
}
