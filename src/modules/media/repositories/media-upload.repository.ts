/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  CleanupOutcome,
  MediaUploadSession,
  UploadPurpose,
} from '../types/media.types';

@Injectable()
export class MediaUploadRepository {
  reserveUpload(
    _userId: string,
    _purpose: UploadPurpose,
    _now: Date,
  ): Promise<MediaUploadSession> {
    throw new NotImplementedException(
      'Upload reservation and quota checks are not implemented.',
    );
  }

  claimCleanupBatch(_limit: number, _now: Date): Promise<MediaUploadSession[]> {
    throw new NotImplementedException('Cleanup claiming is not implemented.');
  }

  finishCleanup(_id: string, _outcome: CleanupOutcome): Promise<void> {
    throw new NotImplementedException(
      'Cleanup persistence is not implemented.',
    );
  }
}
