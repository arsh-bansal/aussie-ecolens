# Thumbnail Lambda

Generates a compressed, aspect-ratio-preserving JPEG thumbnail for each
uploaded image and stores it at a deterministic key `<sha>.jpg` in the
thumbnails bucket.

Triggered by an EventBridge rule on the uploads bucket, filtered to image
suffixes. Videos are handled by the video splitter, not here.

No DynamoDB write: the thumbnail key is a pure function of the upload
checksum (`domain/keys.py`), so the tagger derives the same `thumbnail_url`
for an image without coordinating with this Lambda.
