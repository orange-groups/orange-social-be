export type FeedCursor = {
  version: 1;
  kind: 'feed';
  viewerId: string;
} & (
  | {
      mode: 'latest';
      asOf: string;
      after: { createdAt: string; id: string } | null;
    }
  | { mode: 'recommended'; session: string; sourceCursor: string }
);
