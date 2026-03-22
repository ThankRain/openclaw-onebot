# onebot

Use this plugin when OpenClaw needs to connect to a OneBot v11 compatible endpoint.

Current MVP supports:
- inbound webhook events
- outbound private/group text messages

Target forms:
- `private:<user_id>`
- `group:<group_id>`
- `<user_id>` (treated as private)
