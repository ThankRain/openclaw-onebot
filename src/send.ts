import type { CoreConfig } from "./types.js";
import { normalizeOneBotMessagingTarget } from "./normalize.js";
import { resolveOneBotAccount } from "./accounts.js";
import { getOneBotSocketClient } from "./socket.js";

export async function sendMessageOneBot(
  to: string,
  text: string,
  params: { cfg: CoreConfig; accountId?: string | null; replyToId?: string | null },
) {
  const account = resolveOneBotAccount({ cfg: params.cfg, accountId: params.accountId });
  const normalized = normalizeOneBotMessagingTarget(to);
  const endpoint = normalized.chatType === "group" ? "send_group_msg" : "send_private_msg";
  const payload =
    normalized.chatType === "group"
      ? { group_id: Number(normalized.to), message: text }
      : { user_id: Number(normalized.to), message: text };

  let data: { status?: string; retcode?: number; data?: any } | null = null;

  const socketClient = getOneBotSocketClient(account.accountId);
  if (socketClient) {
    data = (await socketClient.sendAction(endpoint, payload)) as { status?: string; retcode?: number; data?: any };
  } else {
    if (!account.apiBaseUrl) {
      throw new Error(`OneBot account ${account.accountId} is missing apiBaseUrl or active websocket connection`);
    }

    const response = await fetch(joinApiUrl(account.apiBaseUrl, endpoint), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(account.accessToken ? { Authorization: `Bearer ${account.accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`OneBot send failed: ${response.status} ${response.statusText}`);
    }

    data = (await safeJson(response)) as { status?: string; retcode?: number; data?: any };
  }
  if (data?.status && data.status !== "ok") {
    throw new Error(`OneBot send rejected: ${JSON.stringify(data)}`);
  }

  return {
    ok: true,
    target: normalized.target,
    messageId: data?.data?.message_id ? String(data.data.message_id) : undefined,
  };
}

function joinApiUrl(baseUrl: string, endpoint: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint}`;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
