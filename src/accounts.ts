import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/compat";
import type { CoreConfig, OneBotAccountConfig, ResolvedOneBotAccount } from "./types.js";

export function listOneBotAccountIds(cfg: CoreConfig): string[] {
  const accounts = cfg.channels?.onebot?.accounts ?? {};
  const ids = Object.keys(accounts);
  return ids.length ? ids : [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultOneBotAccountId(cfg: CoreConfig): string {
  const ids = listOneBotAccountIds(cfg);
  return ids.includes(DEFAULT_ACCOUNT_ID) ? DEFAULT_ACCOUNT_ID : ids[0]!;
}

export function resolveOneBotAccount(params: {
  cfg: CoreConfig;
  accountId?: string | null;
}): ResolvedOneBotAccount {
  const normalizedAccountId = normalizeAccountId(params.accountId);
  const root = params.cfg.channels?.onebot;
  const raw: OneBotAccountConfig = root?.accounts?.[normalizedAccountId] ?? {};
  const defaultWebhookPath = `/onebot/${normalizedAccountId}`;
  return {
    accountId: normalizedAccountId,
    enabled: raw.enabled !== false && root?.enabled !== false,
    name: raw.name,
    selfId: raw.selfId,
    apiBaseUrl: raw.apiBaseUrl,
    wsUrl: raw.wsUrl,
    accessToken: raw.accessToken,
    webhookPath: normalizeWebhookPath(raw.webhookPath ?? defaultWebhookPath),
    webhookSecret: raw.webhookSecret,
    config: raw,
  };
}

function normalizeWebhookPath(path: string): string {
  const trimmed = path.trim() || "/onebot/default";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
