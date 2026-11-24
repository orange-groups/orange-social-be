/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import {
  BadGatewayException,
  Injectable,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadAvatarResponseDto } from './dto/upload-avatar-response.dto';
import type {
  SignedImageUploadParams,
  VerifiedImage,
} from './types/media.types';

/**
 * Cloudinary SDK adapter. Direct upload signing, lookup and deletion are
 * still skeletons.
 *
 * Implementation handoff:
 * - Reuse the lazy SDK configuration below for future provider methods.
 * - Read CLOUDINARY_AVATAR_UPLOAD_PRESET for the signed avatar upload policy;
 *   it is an upload parameter, NOT a cloudinary.config() option.
 * - Sign only server-selected params via utils.api_sign_request(params, secret).
 * - getImage: query api.resource(publicId, { resource_type: 'image', type: 'upload' });
 *   narrow/map provider metadata to VerifiedImage; do not trust client URLs.
 * - destroyImage: use uploader.destroy with the expected resource type; handle
 *   missing assets idempotently. Ownership/attachment checks belong to MediaService.
 * - Never expose/log api_secret, signatures or credentials; do not call the SDK
 *   from FE with backend secrets. Mock SDK calls in unit tests.
 *
 * See ./README.md for environment precedence, preset setup and integration gates.
 */
@Injectable()
export class CloudinaryService {
  private isConfigured = false;

  constructor(private readonly config: ConfigService) {}

  private configureUpload(): void {
    if (this.isConfigured) return;

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Dịch vụ tải ảnh chưa được cấu hình.',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.isConfigured = true;
  }

  uploadImage(
    image: Buffer,
    publicId: string,
  ): Promise<UploadAvatarResponseDto> {
    return this.upload(image, publicId, 'image', [
      'jpg',
      'jpeg',
      'png',
      'webp',
    ]);
  }

  uploadVideo(video: Buffer, publicId: string) {
    return this.upload(video, publicId, 'video', ['mp4', 'webm']);
  }

  private upload(
    file: Buffer,
    publicId: string,
    resourceType: 'image' | 'video',
    allowedFormats: string[],
  ): Promise<UploadAvatarResponseDto> {
    this.configureUpload();

    return new Promise((resolve, reject) => {
      const fail = () => reject(new BadGatewayException());

      try {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            public_id: publicId,
            allowed_formats: allowedFormats,
            overwrite: false,
            timeout: 15_000,
          },
          (error, result) => {
            const secureUrl = result?.secure_url;
            if (
              error ||
              result?.public_id !== publicId ||
              typeof secureUrl !== 'string' ||
              !secureUrl.startsWith('https://') ||
              !URL.canParse(secureUrl)
            ) {
              fail();
              return;
            }
            resolve({ publicId, secureUrl });
          },
        );
        stream.once('error', fail);
        stream.end(file);
      } catch {
        fail();
      }
    });
  }

  signImageUpload(_params: SignedImageUploadParams): string {
    throw new NotImplementedException('Cloudinary signing is not implemented.');
  }

  getImage(_publicId: string): Promise<VerifiedImage> {
    throw new NotImplementedException(
      'Cloudinary metadata lookup is not implemented.',
    );
  }

  destroyImage(_publicId: string): Promise<void> {
    throw new NotImplementedException(
      'Cloudinary deletion is not implemented.',
    );
  }
}
