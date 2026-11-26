export type StoryStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
export type AccessType = 'FREE' | 'PREMIUM';
export type Portal = 'author' | 'admin';

export interface Story {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  publicationStatus: StoryStatus;
  accessType: AccessType;
  pricePaise: number;
  freePreviewPages: number;
  isFeatured: boolean;
  viewCount: number;
  pageCount: number;
  authorId: string;
  authorName: string;
  categoryId: string;
  categoryName: string;
  languageId: string;
  languageName: string;
  rejectionReason: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface StoryPage {
  id: string;
  pageNumber: number;
  title: string;
  content: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface Language {
  id: string;
  name: string;
  code: string;
  slug: string;
  isActive: boolean;
}

export interface AuthorOption {
  id: string;
  fullName: string;
  penName: string | null;
  email: string;
}

export interface AuthorDashboard {
  total: number;
  draft: number;
  pending: number;
  published: number;
  rejected: number;
  archived: number;
  views: number;
}

export interface AdminDashboard {
  total: number;
  draft: number;
  pending: number;
  published: number;
  rejected: number;
  archived: number;
  views: number;
  free: number;
  premium: number;
  authors: number;
  readers: number;
  purchases: number;
  activeSubscriptions: number;
  totalRevenuePaise: number;
  monthlyRevenuePaise: number;
  paymentsEnabled: boolean;
}

export interface StoryListParams {
  page?: number;
  limit?: number;
  status?: StoryStatus | '';
  search?: string;
}
