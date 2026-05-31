"""Aussie EcoLens - Thumbnail Lambda.

Generates a compressed, aspect-ratio-preserving thumbnail for each uploaded
image and stores it at a deterministic key in the thumbnails bucket. The
tagger derives the same key for an image's thumbnail_url, so no database
write or cross-Lambda coordination is needed here (see README).
"""

__version__ = "0.1.0"
