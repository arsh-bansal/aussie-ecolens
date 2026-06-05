export type FileType = 'image' | 'video';
export type FileStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface FileRecord {
  file_id: string;
  owner_sub: string;
  file_type: FileType;
  mime_type: string;
  original_filename: string;
  s3_url: string;
  thumbnail_url?: string;
  size_bytes: number;
  tags: Record<string, number>;
  manual_tags_added: string[];
  manual_tags_removed: string[];
  status: FileStatus;
  uploaded_at: string;
  tagged_at?: string;
}

export interface SearchResult {
  file_id: string;
  file_type: FileType;
  thumbnail_url?: string;
  url: string;
  tags: Record<string, number>;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface FileStatusResponse {
  status: string;
  file_type?: FileType;
  tags: Record<string, number>;
  url?: string;
  thumbnail_url?: string;
}

export interface PresignRequest {
  sha256: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface PresignResponse {
  duplicate: boolean;
  upload_url?: string;
  file_id: string;
  expires_in?: number;
  existing_url?: string;
  tags?: Record<string, number>;
}

export interface TagModifyRequest {
  urls: string[];
  tags: string[];
  operation: 0 | 1;
}

export interface TagModifyResponse {
  updated: number;
  failed: string[];
  records?: { file_id: string; tags: Record<string, number> }[];
}

export interface DeleteFilesRequest {
  urls: string[];
}

export interface DeleteFilesResponse {
  deleted: number;
  failed: string[];
}

export interface SubscribeRequest {
  tag: string;
}

export interface SubscribeResponse {
  subscription_arn: string;
}

export interface TagSearchRequest {
  tags: Record<string, number>;
}

export interface SpeciesSearchRequest {
  species: string[];
}

export interface ThumbnailLookupRequest {
  thumbnail_url: string;
}

export interface ThumbnailLookupResponse {
  url: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
}

export type UploadStatus =
  | 'idle'
  | 'hashing'
  | 'checking'
  | 'uploading'
  | 'complete'
  | 'duplicate'
  | 'error';

export interface UploadItem {
  id: string;
  file: File;
  sha256?: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  result?: PresignResponse;
}
