import { getIdToken } from './cognito';
import type {
  PresignRequest,
  PresignResponse,
  TagModifyRequest,
  TagModifyResponse,
  DeleteFilesRequest,
  DeleteFilesResponse,
  SubscribeRequest,
  SubscribeResponse,
  SearchResponse,
  TagSearchRequest,
  SpeciesSearchRequest,
  ThumbnailLookupRequest,
  ThumbnailLookupResponse,
} from '@/types';

const AWS_BASE = process.env.NEXT_PUBLIC_AWS_API_BASE ?? '';
const AZURE_BASE = process.env.NEXT_PUBLIC_AZURE_API_BASE ?? '';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: { message?: string } })?.error?.message ??
      `Request failed with status ${res.status}`
    );
  }
  return data as T;
}

function aws<T>(path: string, options?: RequestInit) {
  return request<T>(`${AWS_BASE}${path}`, options);
}

function azure<T>(path: string, options?: RequestInit) {
  return request<T>(`${AZURE_BASE}${path}`, options);
}

export const api = {
  // ── AWS write-path ──────────────────────────────────────────────────────────
  presign: (body: PresignRequest) =>
    aws<PresignResponse>('/uploads/presign', { method: 'POST', body: JSON.stringify(body) }),

  modifyTags: (body: TagModifyRequest) =>
    aws<TagModifyResponse>('/tags/modify', { method: 'POST', body: JSON.stringify(body) }),

  deleteFiles: (body: DeleteFilesRequest) =>
    aws<DeleteFilesResponse>('/files/delete', { method: 'POST', body: JSON.stringify(body) }),

  subscribe: (body: SubscribeRequest) =>
    aws<SubscribeResponse>('/tags/subscribe', { method: 'POST', body: JSON.stringify(body) }),

  // ── Azure read-path ─────────────────────────────────────────────────────────
  searchByTags: (body: TagSearchRequest) =>
    azure<SearchResponse>('/search/tags', { method: 'POST', body: JSON.stringify(body) }),

  searchBySpecies: (body: SpeciesSearchRequest) =>
    azure<SearchResponse>('/search/species', { method: 'POST', body: JSON.stringify(body) }),

  searchByThumbnail: (body: ThumbnailLookupRequest) =>
    azure<ThumbnailLookupResponse>('/search/by-thumbnail', { method: 'POST', body: JSON.stringify(body) }),

  async searchByFile(file: File): Promise<SearchResponse> {
    const token = await getIdToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${AZURE_BASE}/search/by-file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: { message?: string } })?.error?.message ??
        `Request failed with status ${res.status}`
      );
    }
    return data as SearchResponse;
  },

  uploadToPresignedUrl(
    presignedUrl: string,
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`S3 upload failed: ${xhr.status}`));
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
  },
};
