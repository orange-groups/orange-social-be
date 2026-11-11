/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { NotImplementedException } from '@nestjs/common';
import type { FeedCursor } from '../types/feed.types';

export function encodeFeedCursor(_payload: FeedCursor): string {
  throw new NotImplementedException('Feed cursor encoding is not implemented.');
}

export function decodeFeedCursor(
  _value: string,
  _viewerId: string,
): FeedCursor {
  throw new NotImplementedException('Feed cursor decoding is not implemented.');
}
