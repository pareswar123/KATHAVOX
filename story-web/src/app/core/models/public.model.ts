import { Paginated } from './story.model';

export type PublicAccess = 'FREE' | 'PREMIUM';

/** A published story as shown to anyone visiting the site. */
export interface PublicStoryCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  accessType: PublicAccess;
  pricePaise: number;
  freePreviewPages: number;
  isFeatured: boolean;
  viewCount: number;
  totalPages: number;
  categoryName: string;
  languageName: string;
  authorName: string;
  publishedAt: string | null;
}

export interface PublicPage {
  pageNumber: number;
  title: string;
  content: string;
}

/** Story detail. Locked pages arrive as numbers only; their content is never sent. */
export interface PublicStoryDetail {
  story: PublicStoryCard;
  previewPages: PublicPage[];
  lockedPageNumbers: number[];
  totalPages: number;
  snapshotPublishedAt: string;
  /** True when the logged-in reader may read every page. */
  entitled: boolean;
  accessNote: { kind: 'PURCHASED' | 'SUBSCRIPTION'; endDate: string | null; planName: string | null } | null;
}

export type PublicStoryList = Paginated<PublicStoryCard>;
