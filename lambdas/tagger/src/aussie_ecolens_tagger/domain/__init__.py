"""Domain layer for the Tagger Lambda.

Contains AWS-agnostic data models and orchestration logic that can be
exercised in unit tests without any cloud SDKs. The handler module
adapts AWS Lambda events to calls into this layer; services adapt
this layer to external systems (S3, DynamoDB, model files).
"""
