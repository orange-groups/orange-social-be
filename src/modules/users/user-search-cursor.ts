import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export function encodeUserSearchCursor(
  viewerId: string,
  query: string,
  lastId: string,
): string {
  return Buffer.from(
    JSON.stringify({ kind: 'users-search-v1', viewerId, query, lastId }),
  ).toString('base64url');
}

export function decodeUserSearchCursor(
  cursor: string,
  viewerId: string,
  query: string,
): string {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const payload: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      payload &&
      typeof payload === 'object' &&
      'kind' in payload &&
      payload.kind === 'users-search-v1' &&
      'viewerId' in payload &&
      payload.viewerId === viewerId &&
      'query' in payload &&
      payload.query === query &&
      'lastId' in payload &&
      typeof payload.lastId === 'string' &&
      isUUID(payload.lastId)
    ) {
      return payload.lastId;
    }
  } catch {
    // Reject malformed cursors without exposing parsing errors.
  }
  throw new BadRequestException('Trang tìm kiếm không hợp lệ.');
}
