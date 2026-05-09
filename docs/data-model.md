# Data model

## DynamoDB — `aussie-ecolens-files`

Single-table design. All file records and per-frame records live in this table.

### Primary key

| Attribute | Type | Notes |
| --- | --- | --- |
| `pk` | String (partition) | See patterns below |
| `sk` | String (sort) | See patterns below |

### Item patterns

#### File record (image or video)

```
pk = FILE#<sha256>
sk = METADATA
```

Attributes:

| Attribute | Type | Example |
| --- | --- | --- |
| `pk` | S | `FILE#a3f1...e9c2` |
| `sk` | S | `METADATA` |
| `file_id` | S | `a3f1...e9c2` (the SHA-256, also the primary identifier) |
| `owner_sub` | S | Cognito user `sub` |
| `file_type` | S | `image` or `video` |
| `mime_type` | S | `image/jpeg`, `video/mp4`, etc. |
| `original_filename` | S | What the user named it |
| `s3_key` | S | `<owner_sub>/<sha256>.<ext>` |
| `s3_url` | S | Full S3 URL to the original |
| `thumbnail_s3_key` | S | (images only) |
| `thumbnail_url` | S | (images only) |
| `size_bytes` | N | |
| `tags` | M | Map of species → count, e.g. `{"koala": 3, "wombat": 1}` |
| `manual_tags_added` | SS | Tags the user added by hand |
| `manual_tags_removed` | SS | Tags the user removed (suppress from tags map) |
| `status` | S | `pending`, `processing`, `complete`, `failed` |
| `expected_frames` | N | (videos only) total frames to process |
| `processed_frames` | N | (videos only) running counter |
| `uploaded_at` | S | ISO-8601 |
| `tagged_at` | S | ISO-8601 |

#### Per-frame record (videos only)

```
pk = FILE#<video_sha256>
sk = FRAME#<frame_number_zero_padded>
```

Attributes: `frame_s3_key`, `frame_tags` (map), `frame_seconds`, `tagged_at`.

These are merged into the parent video record by the Aggregator Lambda once `processed_frames == expected_frames`.

### Global Secondary Indexes

#### GSI1: by-tag

```
gsi1pk = TAG#<species>
gsi1sk = COUNT#<count_padded>#<file_id>
```

Sparse — only `METADATA` items with at least one tag are indexed. One GSI item is written per (file, tag) pair. This supports "find files with tag X" with optional count filter on the sort key.

#### GSI2: by-owner

```
gsi2pk = OWNER#<sub>
gsi2sk = UPLOADED#<iso_timestamp>
```

For per-user listings (frontend "my uploads" page).

#### GSI3: by-thumbnail

```
gsi3pk = THUMB#<thumbnail_s3_key>
gsi3sk = METADATA
```

Sparse — only image records. Supports the "find original by thumbnail URL" query in O(1).

### Streams

DynamoDB Streams are enabled with `NEW_AND_OLD_IMAGES`. Two consumers:

- **Replicator Lambda** — mirrors `METADATA` items to Cosmos DB.
- **Notifier Lambda** — on INSERT or MODIFY where `status: complete` transitions, publishes to per-tag SNS topics.

## Cosmos DB — `ecolens.files`

Mirrors DynamoDB `METADATA` items. Partition key: `/file_id`. Indexed on:

- `tags` (range index on each species count)
- `owner_sub` (hash)
- `thumbnail_url` (hash)

Cosmos is read-only from the application's perspective. All writes flow through the Replicator Lambda. This is the read model in CQRS.

### Why duplicate the data

Cross-cloud reads are slow and metered. By replicating, query latency stays low and we don't pay egress per query. The acceptable tradeoff is eventual consistency — typically <1s lag.

## SHA-256 as the identifier

Hashing on the client gives us:

1. Content-addressed storage (same image uploaded by two users = one file).
2. Trivial deduplication (the brief requires checksum-based dedup).
3. Idempotent processing — re-tagging the same content produces the same key.
4. The S3 key, the DynamoDB partition key, and the file ID in URLs are all the same string.
