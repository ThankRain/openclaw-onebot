import type { OneBotV11Event, ResolvedOneBotAccount } from "./types.js";

const sockets = new Map<string, OneBotSocketClient>();

export class OneBotSocketClient {
  private ws: WebSocket | null = null;
  private seq = 1;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private closed = false;

  constructor(
    readonly account: ResolvedOneBotAccount,
    private readonly onEvent: (event: OneBotV11Event) => Promise<void>,
    private readonly onStatus?: (patch: Record<string, unknown>) => void,
  ) {}

  async connect(abortSignal?: AbortSignal): Promise<void> {
    this.closed = false;
    const url = buildWsUrl(this.account.wsUrl!, this.account.accessToken);
    const ws = new WebSocket(url);
    this.ws = ws;

    abortSignal?.addEventListener(
      "abort",
      () => {
        this.closed = true;
        try {
          ws.close();
        } catch {}
      },
      { once: true },
    );

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      ws.addEventListener("open", () => {
        this.onStatus?.({ running: true, connected: true, lastStartAt: Date.now(), lastError: null });
        finish(resolve);
      });

      ws.addEventListener("error", (event: any) => {
        const details = event?.message || event?.error?.message || event?.type || String(event);
        finish(() => reject(new Error(`OneBot websocket connection failed: ${details}`)));
      });

      ws.addEventListener("close", () => {
        this.onStatus?.({ running: false, connected: false, lastStopAt: Date.now() });
        this.rejectAll(new Error("OneBot websocket closed"));
      });

      ws.addEventListener("message", async (message) => {
        const raw = typeof message.data === "string" ? message.data : String(message.data ?? "");
        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return;
        }

        if (payload?.echo && this.pending.has(String(payload.echo))) {
          const key = String(payload.echo);
          const entry = this.pending.get(key)!;
          clearTimeout(entry.timer);
          this.pending.delete(key);
          if (payload.status && payload.status !== "ok") {
            entry.reject(new Error(`OneBot action failed: ${raw}`));
          } else {
            entry.resolve(payload);
          }
          return;
        }

        if (payload?.post_type === "message") {
          try {
            await this.onEvent(payload as OneBotV11Event);
          } catch (error) {
            this.onStatus?.({ lastError: String(error) });
          }
        }
      });
    });
  }

  async sendAction(action: string, params: Record<string, unknown>): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("OneBot websocket is not connected");
    }
    const echo = `${Date.now()}-${this.seq++}`;
    const frame = { action, params, echo };
    const promise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(echo);
        reject(new Error(`OneBot action timeout: ${action}`));
      }, 10000);
      this.pending.set(echo, { resolve, reject, timer });
    });
    this.ws.send(JSON.stringify(frame));
    return await promise;
  }

  close() {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {}
  }

  private rejectAll(error: Error) {
    for (const [key, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(key);
    }
  }
}

export function setOneBotSocketClient(accountId: string, client: OneBotSocketClient) {
  sockets.set(accountId, client);
}

export function getOneBotSocketClient(accountId: string): OneBotSocketClient | undefined {
  return sockets.get(accountId);
}

export function removeOneBotSocketClient(accountId: string) {
  const client = sockets.get(accountId);
  client?.close();
  sockets.delete(accountId);
}

function buildWsUrl(base: string, token?: string): string {
  if (!token) return base;
  const url = new URL(base);
  url.searchParams.set("access_token", token);
  return url.toString();
}
