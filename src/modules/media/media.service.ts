/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DatabaseTransaction } from '../../database/types/transaction';
import type { UploadSignatureResponseDto } from './dto/upload-signature-response.dto';
import type { UploadPurpose, VerifiedImage } from './types/media.types';

@Injectable()
export class MediaService {
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
