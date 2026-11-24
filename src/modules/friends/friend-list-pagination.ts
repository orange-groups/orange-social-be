import { BadRequestException } from '@nestjs/common';
import { isISO8601, isUUID } from 'class-validator';
import type { Page } from '../../common/types/page';

type Scope = 'friends' | 'incoming' | 'outgoing';
type Boundary = { sortAt: string; sortId: string };
const CURSOR_TIME =
  /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}Z$/;

export function readFriendCursor(
  cursor: string | undefined,
  viewerId: string,
  scope: Scope,
): Boundary | undefined {
  if (cursor === undefined) return;
  const invalid = () =>
    new BadRequestException('Trang danh sách không hợp lệ.');
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw invalid();
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !('v' in value) ||
    value.v !== 1 ||
    !('viewerId' in value) ||
    value.viewerId !== viewerId ||
    !('scope' in value) ||
    value.scope !== scope ||
    !('sortId' in value) ||
    typeof value.sortId !== 'string' ||
    !isUUID(value.sortId) ||
    !('sortAt' in value) ||
    typeof value.sortAt !== 'string' ||
    !CURSOR_TIME.test(value.sortAt) ||
    value.sortAt.startsWith('0000-') ||
    !isISO8601(value.sortAt, { strict: true })
  ) {
    throw invalid();
  }
  return { sortAt: value.sortAt, sortId: value.sortId };
}

export function toFriendPage<Row extends Boundary, Item>(
  rows: Row[],
  limit: number,
  viewerId: string,
  scope: Scope,
  toItem: (row: Row) => Item,
): Page<Item> {
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    hasMore,
    nextCursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              v: 1,
              viewerId,
              scope,
              sortAt: last.sortAt,
              sortId: last.sortId,
            }),
          ).toString('base64url')
        : null,
  };
}
