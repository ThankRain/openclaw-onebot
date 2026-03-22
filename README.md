# OneBot Plugin for OpenClaw

OneBot v11 MVP channel plugin.

## Current scope

- inbound via HTTP webhook
- outbound text messages via OneBot HTTP API
- private chat + group chat
- multiple accounts
- optional `x-signature` verification (`sha1=`)

## Not implemented yet

- media/file upload
- reactions
- recall/delete
- rich CQ code round-trip
- reverse websocket mode
- full onboarding UI polish

## Suggested config

```json
{
  "plugins": {
    "load": {
      "paths": ["/home/xeu/.openclaw/workspace/onebot-plugin"]
    },
    "entries": {
      "onebot": { "enabled": true }
    }
  },
  "channels": {
    "onebot": {
      "enabled": true,
      "accounts": {
        "default": {
          "enabled": true,
          "name": "NapCat",
          "selfId": "123456789",
          "apiBaseUrl": "http://127.0.0.1:3000",
          "accessToken": "your-onebot-token",
          "webhookPath": "/onebot/default",
          "webhookSecret": "your-webhook-secret"
        }
      }
    }
  }
}
```

## Routing

Send targets:

- private chat: `private:123456`
- group chat: `group:123456`
- plain number defaults to private chat: `123456`

## OneBot side

Configure your OneBot implementation to POST events to:

```text
http://<openclaw-host>:<gateway-port>/onebot/default
```

If webhook signing is enabled, send header:

```text
x-signature: sha1=<hex-hmac>
```

Where HMAC payload is the raw request body and key is `webhookSecret`.
