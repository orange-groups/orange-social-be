import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_AVATAR_BYTES, MAX_COVER_BYTES } from './media.service';

export interface ProfileImageFile {
  buffer: Buffer;
}

export type AvatarFile = ProfileImageFile;

function profileImageInterceptor(maxBytes: number) {
  return FileInterceptor('file', {
    // Multer rejects files that reach its limit; allow exactly maxBytes.
    limits: { fileSize: maxBytes + 1, files: 1, fields: 0, parts: 2 },
  });
}

export const AvatarFileInterceptor = profileImageInterceptor(MAX_AVATAR_BYTES);
export const CoverFileInterceptor = profileImageInterceptor(MAX_COVER_BYTES);
