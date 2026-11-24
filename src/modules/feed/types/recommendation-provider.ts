export interface RecommendationQuery {
  viewerId: string;
  limit: number;
  cursor: string | null;
  session: string | null;
}

export interface RecommendationCandidates {
  postIds: string[];
  nextCursor: string | null;
  hasMore: boolean;
  session: string;
}

/** Contract only. No fake provider is bound until the recommendation module exists. */
export interface RecommendationProvider {
  getCandidates(query: RecommendationQuery): Promise<RecommendationCandidates>;
}
