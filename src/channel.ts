import {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createAccountStatusSink,
  deleteAccountFromConfigSection,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
  type ChannelPlugin,
} from "openclaw/plugin-sdk/compat";
import { resolveOneBotAccount, listOneBotAccountIds, resolveDefaultOneBotAccountId } from "./accounts.js";
import { looksLikeOneBotTargetId, normalizeOneBotMessagingTarget } from "./normalize.js";
import { sendMessageOneBot } from "./send.js";
import type { CoreConfig, ResolvedOneBotAccount } from "./types.js";

const meta = {
  id: "onebot",
  label: "OneBot",
  selectionLabel: "OneBot v11",
  docsPath: "/channels/onebot",
  docsLabel: "onebot",
  blurb: "OneBot v11 HTTP webhook + send API plugin.",
  aliases: ["cqhttp", "go-cqhttp", "napcat"],
  order: 70,
} as const;

const OneBotChannelSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    enabled: { type: "boolean" },
    accounts: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          name: { type: "string" },
          selfId: { type: "string" },
          apiBaseUrl: { type: "string" },
          accessToken: { type: "string" },
          webhookPath: { type: "string" },
          webhookSecret: { type: "string" }
        }
      }
    }
  }
} as const;

export const onebotPlugin: ChannelPlugin<ResolvedOneBotAccount> = {
  id: "onebot",
  meta,
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.onebot"] },
  configSchema: buildChannelConfigSchema(OneBotChannelSchema),
  config: {
    listAccountIds: (cfg) => listOneBotAccountIds(cfg as CoreConfig),
    resolveAccount: (cfg, accountId) =>
      resolveOneBotAccount({ cfg: cfg as CoreConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultOneBotAccountId(cfg as CoreConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "onebot",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "onebot",
        accountId,
        clearBaseFields: ["selfId", "apiBaseUrl", "accessToken", "webhookPath", "webhookSecret", "name"],
      }),
    isConfigured: (account) => Boolean(account.apiBaseUrl?.trim() && account.webhookPath?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.apiBaseUrl?.trim() && account.webhookPath?.trim()),
      selfId: account.selfId ?? "[missing]",
      apiBaseUrl: account.apiBaseUrl ? "[set]" : "[missing]",
      webhookPath: account.webhookPath,
      hasAccessToken: Boolean(account.accessToken),
      hasWebhookSecret: Boolean(account.webhookSecret),
    }),
  },
  messaging: {
    normalizeTarget: normalizeOneBotMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeOneBotTargetId,
      hint: "private:123456 or group:123456",
    },
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    validateInput: ({ input }) => {
      const typed = input as Record<string, string | undefined>;
      if (!typed.apiBaseUrl?.trim()) {
        return "OneBot requires apiBaseUrl.";
      }
      if (!typed.webhookPath?.trim()) {
        return "OneBot requires webhookPath.";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const typed = input as Record<string, string | undefined>;
      const next = { ...(cfg as Record<string, unknown>) } as Record<string, any>;
      next.channels = { ...(next.channels ?? {}) };
      next.channels.onebot = { ...(next.channels.onebot ?? {}), enabled: true };
      next.channels.onebot.accounts = { ...(next.channels.onebot.accounts ?? {}) };
      next.channels.onebot.accounts[accountId] = {
        ...(next.channels.onebot.accounts[accountId] ?? {}),
        enabled: true,
        ...(typed.name ? { name: typed.name } : {}),
        ...(typed.selfId ? { selfId: typed.selfId } : {}),
        apiBaseUrl: typed.apiBaseUrl,
        webhookPath: typed.webhookPath,
        ...(typed.accessToken ? { accessToken: typed.accessToken } : {}),
        ...(typed.webhookSecret ? { webhookSecret: typed.webhookSecret } : {}),
      };
      return next as any;
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 2000,
    sendText: async ({ cfg, to, text, accountId, replyToId }) => {
      const result = await sendMessageOneBot(to, text, {
        cfg: cfg as CoreConfig,
        accountId: accountId ?? undefined,
        replyToId: replyToId ?? undefined,
      });
      return { channel: "onebot", ...result };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: Boolean(snapshot.configured),
      running: Boolean(snapshot.running),
      mode: "webhook",
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.apiBaseUrl?.trim() && account.webhookPath?.trim()),
      selfId: account.selfId ?? null,
      webhookPath: account.webhookPath,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      mode: "webhook",
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const statusSink = createAccountStatusSink({
        accountId: ctx.accountId,
        setStatus: ctx.setStatus,
      });
      if (!account.apiBaseUrl || !account.webhookPath) {
        throw new Error(`OneBot not configured for account "${account.accountId}"`);
      }
      statusSink({ running: true, lastStartAt: Date.now(), lastError: null });
      await new Promise<void>((resolve, reject) => {
        ctx.abortSignal.addEventListener("abort", () => {
          statusSink({ running: false, lastStopAt: Date.now() });
          resolve();
        }, { once: true });
      });
    },
    logoutAccount: async ({ accountId, cfg }) => {
      const next = { ...(cfg as Record<string, unknown>) } as Record<string, any>;
      if (!next.channels?.onebot?.accounts?.[accountId]) {
        return cfg;
      }
      next.channels = { ...(next.channels ?? {}) };
      next.channels.onebot = { ...(next.channels.onebot ?? {}) };
      next.channels.onebot.accounts = { ...(next.channels.onebot.accounts ?? {}) };
      delete next.channels.onebot.accounts[accountId];
      return next as any;
    },
  },
};
