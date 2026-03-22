import { createHmac, timingSafeEqual } from "node:crypto";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { listOneBotAccountIds, resolveOneBotAccount } from "./accounts.js";
import { handleOneBotInbound } from "./inbound.js";
import type { CoreConfig } from "./types.js";

export function registerOneBotWebhookRoute(api: OpenClawPluginApi) {
  api.registerHttpRoute({
    path: "/onebot",
    auth: "plugin",
    match: "prefix",
    handler: async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end("method not allowed");
        return true;
      }

      const cfg = (api.config ?? {}) as CoreConfig;
      const path = req.url ? new URL(req.url, "http://localhost").pathname : "";
      const account = resolveOneBotAccountByPath(cfg, path);
      if (!account) {
        res.statusCode = 404;
        res.end("unknown onebot webhook path");
        return true;
      }

      const bodyText = await readBody(req);
      if (account.webhookSecret && !verifyOneBotSignature(account.webhookSecret, bodyText, req.headers["x-signature"])) {
        res.statusCode = 401;
        res.end("invalid signature");
        return true;
      }

      try {
        const event = JSON.parse(bodyText);
        const result = await handleOneBotInbound({ event, account, config: cfg });
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(result ?? { ok: true }));
        return true;
      } catch (error) {
        res.statusCode = 500;
        res.end(`onebot webhook error: ${String(error)}`);
        return true;
      }
    },
  });
}

function resolveOneBotAccountByPath(cfg: CoreConfig, path: string) {
  for (const accountId of listOneBotAccountIds(cfg)) {
    const account = resolveOneBotAccount({ cfg, accountId });
    if (account.webhookPath === path) {
      return account;
    }
  }
  return null;
}

async function readBody(req: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function verifyOneBotSignature(secret: string, body: string, header: string | string[] | undefined) {
  const rawHeader = Array.isArray(header) ? header[0] : header;
  if (!rawHeader || !rawHeader.startsWith("sha1=")) {
    return false;
  }
  const actual = Buffer.from(rawHeader.slice(5), "hex");
  const expected = Buffer.from(createHmac("sha1", secret).update(body).digest("hex"), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
