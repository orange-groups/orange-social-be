/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  SignedImageUploadParams,
  VerifiedImage,
} from './types/media.types';

@Injectable()
export class CloudinaryService {
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
