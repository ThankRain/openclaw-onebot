export type NormalizedOneBotTarget = {
  raw: string;
  chatType: "direct" | "group";
  target: string;
  to: string;
};

export function looksLikeOneBotTargetId(value: string): boolean {
  return /^(onebot:)?(group|private|user|friend):\d+$/.test(value) || /^\d+$/.test(value);
}

export function normalizeOneBotMessagingTarget(input: string): NormalizedOneBotTarget {
  const raw = input.trim();
  if (!raw) {
    throw new Error("OneBot target is empty");
  }

  const normalizedRaw = raw.startsWith("onebot:") ? raw.slice("onebot:".length) : raw;

  if (/^group:\d+$/.test(normalizedRaw)) {
    const to = normalizedRaw.slice("group:".length);
    return { raw, chatType: "group", target: `group:${to}`, to };
  }

  if (/^(private|user|friend):\d+$/.test(normalizedRaw)) {
    const to = normalizedRaw.split(":", 2)[1]!;
    return { raw, chatType: "direct", target: `private:${to}`, to };
  }

  if (/^\d+$/.test(raw)) {
    return { raw, chatType: "direct", target: `private:${raw}`, to: raw };
  }

  throw new Error(`Unsupported OneBot target: ${raw}`);
}

export function extractPlainText(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }
  if (!Array.isArray(message)) {
    return "";
  }
  return message
    .map((segment) => {
      if (!segment || typeof segment !== "object") {
        return "";
      }
      const typed = segment as { type?: string; data?: Record<string, unknown> };
      if (typed.type === "text") {
        return typeof typed.data?.text === "string" ? typed.data.text : "";
      }
      if (typed.type === "at") {
        return typeof typed.data?.qq === "string" ? `@${typed.data.qq} ` : "";
      }
      return "";
    })
    .join("")
    .trim();
}
