"""Aussie EcoLens - Replicator Lambda (CQRS cross-cloud replication).

Consumes the DynamoDB stream of the shared files table (the AWS-side system
of record) and mirrors every change to Azure Cosmos DB (the read side that
the query API serves from). INSERT/MODIFY become upserts; REMOVE becomes a
delete, so the Cosmos read model stays consistent with DynamoDB.

The Cosmos write is behind a ReplicationTarget port, so the stream-parsing
and orchestration logic is fully testable without Azure, and the concrete
Cosmos adapter can be configured/swapped without touching the core.
"""

__version__ = "0.1.0"
