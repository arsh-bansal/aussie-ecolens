"""
Aussie EcoLens — Query API
Rachana's component: read side of the CQRS architecture.

Routes:
  GET  /search       — find files by tag counts or species presence (2.2.1)
  GET  /thumbnail    — map thumbnail URL → full-size URL (2.2.2)
  POST /query-file   — tag an uploaded file + return matching records (2.2.3)
  POST /tags         — bulk add/remove tags (2.3.1)
  DELETE /files      — delete files from S3 + Cosmos (2.3.2)

All routes require a valid Cognito JWT (Authorization: Bearer <token>).
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS

from search_handler    import search_bp
from thumbnail_handler import thumbnail_bp
from query_file_handler import query_file_bp
from tags_handler      import tags_bp
from files_handler import files_bp
from delete_handler    import delete_bp

app = Flask(__name__)
CORS(app)   # Allow Shaurya's frontend to call the API cross-origin

# Register all route blueprints
app.register_blueprint(files_bp)
app.register_blueprint(search_bp)
app.register_blueprint(thumbnail_bp)
app.register_blueprint(query_file_bp)
app.register_blueprint(tags_bp)
app.register_blueprint(delete_bp)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    # Local dev only — not for Lambda deployment
    required_env = ["COSMOS_ENDPOINT", "COSMOS_KEY", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID"]
    missing = [v for v in required_env if not os.environ.get(v)]
    if missing:
        print(f"WARNING: missing env vars: {', '.join(missing)}")

    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
