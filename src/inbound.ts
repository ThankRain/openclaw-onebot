import { dispatchInboundReplyWithBase } from "openclaw/plugin-sdk/compat";
import { getOneBotRuntime } from "./runtime.js";
import { sendMessageOneBot } from "./send.js";
import { extractPlainText } from "./normalize.js";
import type { CoreConfig, OneBotV11Event, ResolvedOneBotAccount } from "./types.js";

const CHANNEL_ID = "onebot" as const;

export async function handleOneBotInbound(params: {
  event: OneBotV11Event;
  account: ResolvedOneBotAccount;
  config: CoreConfig;
}) {
  const { event, account, config } = params;
  if (event.post_type !== "message") {
    return { ok: true, ignored: true, reason: "unsupported_post_type" };
  }

  const rawBody = (event.raw_message?.trim() || extractPlainText(event.message) || "").trim();
  if (!rawBody) {
    return { ok: true, ignored: true, reason: "empty_message" };
  }

  const isGroup = event.message_type === "group";
  const senderId = stringify(event.user_id);
  const targetId = isGroup ? stringify(event.group_id) : senderId;
  const senderName = event.sender?.card || event.sender?.nickname || senderId;
  const timestamp = (event.time ?? Math.floor(Date.now() / 1000)) * 1000;
  const runtime = getOneBotRuntime();
  const route = runtime.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: targetId,
    },
  });

  const storePath = runtime.channel.session.resolveStorePath(
    (config.session as Record<string, unknown> | undefined)?.store as string | undefined,
    { agentId: route.agentId },
  );

  const previousTimestamp = runtime.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  const body = runtime.channel.reply.formatAgentEnvelope({
    channel: "OneBot",
    from: senderName,
    timestamp,
    previousTimestamp,
    envelope: runtime.channel.reply.resolveEnvelopeFormatOptions(config),
    body: rawBody,
  });

  const ctxPayload = runtime.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `onebot:${senderId}`,
    To: isGroup ? `onebot:group:${targetId}` : `onebot:${targetId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: isGroup ? `group:${targetId}` : senderName,
    SenderName: senderName,
    SenderId: senderId,
    GroupSubject: isGroup ? `group:${targetId}` : undefined,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    MessageSid: stringify(event.message_id),
    Timestamp: timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: isGroup ? `onebot:group:${targetId}` : `onebot:${targetId}`,
    CommandAuthorized: true,
  });

  await dispatchInboundReplyWithBase({
    cfg: config,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    route,
    storePath,
    ctxPayload,
    core: runtime,
    deliver: async (payload: { text?: string; replyToId?: string }) => {
      if (!payload?.text?.trim()) {
        return;
      }
      await sendMessageOneBot(isGroup ? `group:${targetId}` : `private:${senderId}`, payload.text, {
        cfg: config,
        accountId: account.accountId,
        replyToId: payload.replyToId ?? null,
      });
    },
    onRecordError: (err: unknown) => runtime.error?.(`onebot: failed updating session meta: ${String(err)}`),
    onDispatchError: (err: unknown, info: { kind: string }) =>
      runtime.error?.(`onebot ${info.kind} reply failed: ${String(err)}`),
  });

  return { ok: true };
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}
