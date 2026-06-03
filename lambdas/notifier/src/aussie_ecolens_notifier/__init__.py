"""Aussie EcoLens - Notifier Lambda.

Consumes the DynamoDB stream of the shared files table and publishes a
tag-notification to SNS for each species in a newly tagged file. SNS
subscription filter policies route each species to the users watching it,
so a subscriber only receives emails for the tags they care about
(assignment 2.3.3 - tag-based notifications with specific tag filtering).
"""

__version__ = "0.1.0"
