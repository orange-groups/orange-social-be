import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { CreateUploadSignatureDto } from './dto/create-upload-signature.dto';
import type { UploadSignatureResponseDto } from './dto/upload-signature-response.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-signature')
  createUploadSignature(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateUploadSignatureDto,
  ): Promise<UploadSignatureResponseDto> {
    return this.media.createUploadSignature(user.sub, dto.purpose);
  }
}
