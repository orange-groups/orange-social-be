/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotImplementedException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { DatabaseTransaction } from '../../database/types/transaction';
import { CloudinaryService } from './cloudinary.service';
import type { UploadAvatarResponseDto } from './dto/upload-avatar-response.dto';
import type { UploadSignatureResponseDto } from './dto/upload-signature-response.dto';
import type { UploadPurpose, VerifiedImage } from './types/media.types';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const MAX_POST_MEDIA_BYTES = 20 * 1024 * 1024;
export const MAX_POST_FILES = 5;

const JPEG_SIGNATURE = Buffer.from('ffd8ff', 'hex');
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const EBML_SIGNATURE = Buffer.from('1a45dfa3', 'hex');

function hasVideoSignature(buffer: Buffer) {
  return (
    (buffer.length >= 12 && buffer.toString('latin1', 4, 8) === 'ftyp') ||
    buffer.subarray(0, EBML_SIGNATURE.length).equals(EBML_SIGNATURE)
  );
}

function hasImageSignature(buffer: Buffer): boolean {
  return (
    buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE) ||
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    (buffer.toString('latin1', 0, 4) === 'RIFF' &&
      buffer.toString('latin1', 8, 12) === 'WEBP')
  );
}

@Injectable()
export class MediaService {
  constructor(private readonly cloudinary: CloudinaryService) {}

  uploadAvatar(
    userId: string,
    image: Buffer | undefined,
  ): Promise<UploadAvatarResponseDto> {
    return this.uploadProfileImage(userId, image, 'avatars', MAX_AVATAR_BYTES);
  }

  uploadCover(userId: string, image: Buffer | undefined) {
    return this.uploadProfileImage(userId, image, 'covers', MAX_COVER_BYTES);
  }

  async uploadPostMedia(userId: string, files: Buffer[]) {
    if (
      files.reduce((total, file) => total + file.length, 0) >
      MAX_POST_MEDIA_BYTES
    ) {
      throw new PayloadTooLargeException('Tổng dung lượng tệp tối đa 20 MiB.');
    }

    let images = 0;
    let videos = 0;
    const types = files.map((file) => {
      if (hasImageSignature(file)) {
        if (file.length > MAX_COVER_BYTES) {
          throw new PayloadTooLargeException('Mỗi ảnh tối đa 5 MiB.');
        }
        images++;
        return 'image';
      }
      if (hasVideoSignature(file)) {
        videos++;
        return 'video';
      }
      throw new UnsupportedMediaTypeException(
        'Chỉ hỗ trợ JPEG, PNG, WebP, MP4 và WebM.',
      );
    });
    if (images > 4 || videos > 1) {
      throw new BadRequestException('Tối đa 4 ảnh và 1 video.');
    }

    const assets: {
      type: 'image' | 'video';
      url: string;
      storageKey: string;
    }[] = [];
    for (const [position, file] of files.entries()) {
      const type = types[position];
      const publicId = `orange-social/posts/${userId}/${randomUUID()}`;
      const uploaded =
        type === 'image'
          ? await this.cloudinary.uploadImage(file, publicId)
          : await this.cloudinary.uploadVideo(file, publicId);
      assets.push({
        type,
        url: uploaded.secureUrl,
        storageKey: uploaded.publicId,
      });
    }
    return assets;
  }

  private uploadProfileImage(
    userId: string,
    image: Buffer | undefined,
    directory: 'avatars' | 'covers',
    maxBytes: number,
  ) {
    if (!image?.length) {
      throw new BadRequestException('Vui lòng gửi ảnh trong trường file.');
    }
    if (image.length > maxBytes) {
      throw new PayloadTooLargeException(
        `Ảnh không được vượt quá ${maxBytes / (1024 * 1024)} MiB.`,
      );
    }
    if (!hasImageSignature(image)) {
      throw new UnsupportedMediaTypeException(
        'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.',
      );
    }

    const publicId = `orange-social/${directory}/${userId}/${randomUUID()}`;
    return this.cloudinary.uploadImage(image, publicId);
  }

  createUploadSignature(
    _userId: string,
    _purpose: UploadPurpose,
  ): Promise<UploadSignatureResponseDto> {
    throw new NotImplementedException(
      'Signed upload creation is not implemented.',
    );
  }

  verifyProfileUpload(
    _userId: string,
    _uploadId: string,
    _purpose: UploadPurpose,
  ): Promise<VerifiedImage> {
    throw new NotImplementedException(
      'Profile upload verification is not implemented.',
    );
  }

  attachVerifiedUpload(
    _tx: DatabaseTransaction,
    _userId: string,
    _uploadId: string,
    _purpose: UploadPurpose,
  ): Promise<VerifiedImage> {
    throw new NotImplementedException('Upload attachment is not implemented.');
  }

  scheduleCleanup(_tx: DatabaseTransaction, _uploadId: string): Promise<void> {
    throw new NotImplementedException('Cleanup scheduling is not implemented.');
  }
}
