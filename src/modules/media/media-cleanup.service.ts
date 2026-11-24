/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class MediaCleanupService {
  cleanupBatch(_limit: number): Promise<void> {
    throw new NotImplementedException('Media cleanup is not implemented.');
  }
}
