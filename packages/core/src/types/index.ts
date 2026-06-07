/**
 * Composite types and view models that don't map 1:1 to a table.
 * Database row types live in @moajoa/api/src/types/database.ts (generated).
 */

import type { Board } from '../schemas/board';
import type { Link } from '../schemas/link';
import type { Place } from '../schemas/place';
import type { Vote } from '../schemas/vote';
import type { Membership } from '../schemas/membership';

/** A board with all related data needed to render the map view. */
export interface BoardWithContents {
  board: Board;
  links: Link[];
  places: Place[];
  members: Membership[];
  /** Aggregated love counts keyed by place_id. */
  vote_counts: Record<string, number>;
  /** Current user's votes keyed by place_id. */
  my_votes: Record<string, Vote>;
}

/** Public board view — what an unauthenticated visitor sees via share link. */
export interface PublicBoardView {
  board: Pick<Board, 'id' | 'title' | 'description' | 'city_code' | 'cover_image_url' | 'updated_at'>;
  links: Pick<
    Link,
    'id' | 'source_kind' | 'url' | 'title' | 'thumbnail_url' | 'author_name' | 'summary_ko'
  >[];
  places: Pick<
    Place,
    | 'id'
    | 'link_id'
    | 'name_local'
    | 'name_ko'
    | 'name_en'
    | 'lat'
    | 'lng'
    | 'category'
    | 'source_timestamp_sec'
    | 'source_kind'
    | 'confidence'
    | 'summary_ko'
  >[];
  owner_display_name: string;
}
