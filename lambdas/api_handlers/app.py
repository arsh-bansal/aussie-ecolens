"""
Aussie EcoLens — Query API (updated routes for frontend integration)

Routes:
  POST /search/tags          — find by tag counts (2.2.1)
  POST /search/species       — find by species presence (2.2.1)
  POST /search/by-thumbnail  — thumbnail URL → full-size URL (2.2.2)
  POST /search/by-file/presign — presigned PUT for query image (bypass 6 MB limit)
  POST /search/by-file       — tag staged image + find matches (2.2.3)
  POST /tags/modify          — bulk add/remove tags (2.3.1)
  GET  /tags/subscribe       — list user's SNS alert subscriptions (2.3.3)
  POST /tags/subscribe       — email alert subscription via SNS (2.3.3)
  POST /tags/unsubscribe     — remove one species or cancel all SNS alerts
  POST /files/delete         — delete files from S3 + Cosmos (2.3.2)
  POST /files                — manual write (fallback, not primary path)
  GET  /files/list           — list caller's files (Manage page)
  GET  /files/status/<sha>   — poll async tagging status after upload
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS

from search_handler     import search_bp
from thumbnail_handler  import thumbnail_bp
from query_file_handler import query_file_bp
from tags_handler       import tags_bp
from subscribe_handler  import subscribe_bp
from delete_handler     import delete_bp
from files_handler      import files_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(search_bp)
app.register_blueprint(thumbnail_bp)
app.register_blueprint(query_file_bp)
app.register_blueprint(tags_bp)
app.register_blueprint(subscribe_bp)
app.register_blueprint(delete_bp)
app.register_blueprint(files_bp)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


if __name__ == "__main__":
    required_env = ["COSMOS_ENDPOINT", "COSMOS_KEY", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID"]
    missing = [v for v in required_env if not os.environ.get(v)]
    if missing:
        print(f"WARNING: missing env vars: {', '.join(missing)}")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
