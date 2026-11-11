/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { NotImplementedException } from '@nestjs/common';

export interface CursorPayload {
  version: number;
  kind: string;
}

export function encodeCursor(_payload: CursorPayload): string {
  throw new NotImplementedException('Cursor encoding is not implemented.');
}

export function decodeCursor(
  _value: string,
  _expectedKind: string,
): CursorPayload {
  throw new NotImplementedException('Cursor decoding is not implemented.');
}
