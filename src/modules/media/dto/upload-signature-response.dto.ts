import type { SignedImageUploadParams } from '../types/media.types';

export interface UploadSignatureResponseDto {
  uploadId: string;
  uploadUrl: string;
  apiKey: string;
  params: SignedImageUploadParams;
  signature: string;
  completeBefore: string;
  constraints: { maxBytes: number; formats: string[] };
}
