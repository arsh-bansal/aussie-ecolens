import { getIdToken } from "./cognito";
import type {
  PresignRequest,
  PresignResponse,
  TagModifyRequest,
  TagModifyResponse,
  DeleteFilesRequest,
  DeleteFilesResponse,
  SubscribeRequest,
  SubscribeResponse,
  FileStatusResponse,
  SearchResponse,
  TagSearchRequest,
  SpeciesSearchRequest,
  ThumbnailLookupRequest,
  ThumbnailLookupResponse,
} from "@/types";

// Two backend APIs:
//   AWS_BASE   (NEXT_PUBLIC_AWS_API_BASE)   -> the upload/auth API (P1/Adam):
//                                              /uploads/presign only.
//   QUERY_BASE (NEXT_PUBLIC_AZURE_API_BASE) -> the query API (P3/Rachana), which
//                                              serves ALL reads (search/*) AND the
//                                              tag-edit + delete + subscribe
//                                              mutations (/tags/subscribe).
// Note: the query API is deployed on AWS API Gateway (Flask), not Azure
// Functions, so the NEXT_PUBLIC_AZURE_API_BASE name is historical. It points at
// the AWS query-API base URL (…execute-api.ap-southeast-2.amazonaws.com, $default
// stage, no path suffix).
const trimBase = (url: string) => url.replace(/\/+$/, "");
const AWS_BASE = trimBase(process.env.NEXT_PUBLIC_AWS_API_BASE ?? "");
const QUERY_BASE = trimBase(process.env.NEXT_PUBLIC_AZURE_API_BASE ?? "");

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string | { message?: string } };
    const message =
      typeof err?.error === 'string'
        ? err.error
        : err?.error?.message ?? `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

// Upload/auth API (Adam): presign + subscribe.
function aws<T>(path: string, options?: RequestInit) {
  return request<T>(`${AWS_BASE}${path}`, options);
}

// Query API (Rachana, on AWS API Gateway): search + tag-edit + delete.
function queryApi<T>(path: string, options?: RequestInit) {
  return request<T>(`${QUERY_BASE}${path}`, options);
}

export const api = {
  // ── Upload/auth API (presign, subscribe) ──────────────────────────────────
  presign: (body: PresignRequest) =>
    aws<PresignResponse>("/uploads/presign", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Query API (search + tag-edit + delete + subscribe) ────────────────────
  // tag-edit, delete, and subscribe are served by the query API (same place as
  // search), not the upload/auth API — so they route through queryApi(), not
  // aws(). subscribe lives on the query API (/tags/subscribe), so it must use
  // QUERY_BASE; otherwise pointing AWS_BASE at Adam's upload API would 404 it.
  subscribe: (body: SubscribeRequest) =>
    queryApi<SubscribeResponse>("/tags/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  modifyTags: (body: TagModifyRequest) =>
    queryApi<TagModifyResponse>("/tags/modify", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteFiles: (body: DeleteFilesRequest) =>
    queryApi<DeleteFilesResponse>("/files/delete", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Poll async tagging status after an upload (status: "pending" → "tagged").
  getFileStatus: (sha: string) =>
    queryApi<FileStatusResponse>(`/files/status/${sha}`, { method: "GET" }),

  listFiles: () =>
    queryApi<SearchResponse>("/files/list", { method: "GET" }),

  searchByTags: (body: TagSearchRequest, signal?: AbortSignal) =>
    queryApi<SearchResponse>("/search/tags", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),

  searchBySpecies: (body: SpeciesSearchRequest, signal?: AbortSignal) =>
    queryApi<SearchResponse>("/search/species", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),

  searchByThumbnail: (body: ThumbnailLookupRequest) =>
    queryApi<ThumbnailLookupResponse>("/search/by-thumbnail", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  async searchByFile(file: File, signal?: AbortSignal): Promise<SearchResponse> {
    const token = await getIdToken();

    const attempt = async () => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${QUERY_BASE}/search/by-file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: string | { message?: string } };
        const message =
          typeof err?.error === "string"
            ? err.error
            : err?.error?.message ??
              (res.status === 503
                ? "ML model is warming up — wait 30 seconds and try again."
                : `Request failed with status ${res.status}`);
        const error = new Error(message);
        (error as Error & { retriable?: boolean }).retriable = res.status === 503;
        throw error;
      }
      return data as SearchResponse;
    };

    try {
      return await attempt();
    } catch (e) {
      const err = e as Error & { retriable?: boolean };
      // Don't retry if the caller aborted.
      if (err.retriable && !signal?.aborted) {
        await new Promise(r => setTimeout(r, 8000));
        return await attempt();
      }
      throw e;
    }
  },

  uploadToPresignedUrl(
    presignedUrl: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`S3 upload failed: ${xhr.status}`));
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  },
};
