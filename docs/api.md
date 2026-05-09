# API contract

All endpoints require a Cognito ID token in the `Authorization: Bearer <token>` header. Endpoints return JSON.

## AWS endpoints (API Gateway)

Base URL: `https://<api_id>.execute-api.us-east-1.amazonaws.com/prod`

### `POST /uploads/presign`

Request a presigned PUT URL for a new upload. Includes an integrated dedup check.

**Request**:
```json
{
  "sha256": "a3f1...e9c2",
  "filename": "koala.jpg",
  "mime_type": "image/jpeg",
  "size_bytes": 1048576
}
```

**Response (new file)**:
```json
{
  "duplicate": false,
  "upload_url": "https://aussie-ecolens-uploads.s3.amazonaws.com/...",
  "file_id": "a3f1...e9c2",
  "expires_in": 900
}
```

**Response (duplicate)**:
```json
{
  "duplicate": true,
  "file_id": "a3f1...e9c2",
  "existing_url": "https://...",
  "tags": {"koala": 2}
}
```

### `POST /tags/modify`

Bulk add or remove tags on files.

**Request**:
```json
{
  "urls": ["https://.../file1.jpg", "https://.../file2.mp4"],
  "tags": ["koala", "dingo"],
  "operation": 1
}
```

`operation`: `1` = add, `0` = remove. Tags are added to `manual_tags_added` (additive) or `manual_tags_removed` (suppression). Removing a tag that isn't there is a no-op (per brief).

**Response**:
```json
{"updated": 2, "failed": []}
```

### `POST /files/delete`

Bulk delete files.

**Request**:
```json
{"urls": ["https://.../file1.jpg"]}
```

**Response**:
```json
{"deleted": 1, "failed": []}
```

Removes from S3 (original + thumbnail), DynamoDB (metadata + per-frame items + GSI entries). Replication propagates the deletion to Cosmos.

### `POST /tags/subscribe`

Subscribe the authenticated user's email to a per-tag SNS topic.

**Request**:
```json
{"tag": "koala"}
```

**Response**:
```json
{"subscription_arn": "arn:aws:sns:..."}
```

The user receives a confirmation email from SNS. (AWS Academy may restrict SES domain identities; SNS email with confirmation works.)

### `POST /search/by-file` (callback target)

Internal endpoint called by Azure when a user submits an image for content-based search. Authenticated by the user's JWT, which Azure forwards. Returns the tag set; Azure handles the Cosmos query and result formatting. The uploaded file is never persisted on AWS.

**Request**:
```json
{"image_b64": "base64..."}
```

**Response**:
```json
{"tags": {"koala": 1, "wombat": 2}}
```

## Azure endpoints (Function App)

Base URL: `https://aussie-ecolens-api.azurewebsites.net/api`

### `POST /search/tags`

Find files where tag counts meet thresholds. Logical AND across the tag map.

**Request**:
```json
{"tags": {"koala": 3, "wombat": 1}}
```

Returns files with `tags.koala >= 3 AND tags.wombat >= 1`.

**Response**:
```json
{
  "results": [
    {
      "file_id": "a3f1...",
      "file_type": "image",
      "thumbnail_url": "https://...",
      "url": "https://...",
      "tags": {"koala": 3, "wombat": 2}
    }
  ]
}
```

For images: response includes `thumbnail_url`. For videos: response includes the full video URL only.

### `POST /search/species`

Find files containing at least one of the listed species.

**Request**:
```json
{"species": ["dingo"]}
```

Returns all files where any of the listed species appears in `tags`.

**Response**: same shape as `/search/tags`.

### `POST /search/by-thumbnail`

Resolve a thumbnail URL to its full-size image URL.

**Request**:
```json
{"thumbnail_url": "https://aussie-ecolens-thumbnails.s3.amazonaws.com/..."}
```

**Response**:
```json
{"url": "https://aussie-ecolens-uploads.s3.amazonaws.com/..."}
```

### `POST /search/by-file`

Find files in the catalogue that share the tag set of a user-submitted file.

**Request**: `multipart/form-data` with `file` field.

**Response**: same shape as `/search/tags`. The query file is held in Blob storage only for the duration of the call and deleted at the end.

## Error format

All errors:
```json
{"error": {"code": "BAD_REQUEST", "message": "..."}}
```

HTTP status codes follow REST conventions (400 client error, 401 missing/bad token, 403 forbidden, 404 not found, 500 server error).
