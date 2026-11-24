import type { UserSummary } from '../../../common/types/user-summary';
import type { Relationship } from '../../friends/types/friends.types';

export interface UserSearchResponseDto extends UserSummary {
  relationship: Relationship;
}
