"""AWS Lambda containerized image+video species tagging for Aussie EcoLens.

Pipeline:
    S3 ObjectCreated event
        -> MegaDetector v5a (animal detection)
        -> SpeciesNet (species classification on crops)
        -> DynamoDB write (system of record)
        -> SNS publish (per-species notifications)

The DynamoDB write triggers downstream Lambdas (Replicator -> Cosmos DB
on Azure, Notifier -> SNS topics) via DynamoDB Streams.
"""

__version__ = "0.1.0"
