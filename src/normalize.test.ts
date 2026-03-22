import { strict as assert } from "node:assert";
import test from "node:test";

import { extractPlainText, normalizeOneBotMessagingTarget } from "./normalize.ts";

test("normalize private numeric target", () => {
  const normalized = normalizeOneBotMessagingTarget("10001");
  assert.equal(normalized.chatType, "direct");
  assert.equal(normalized.target, "private:10001");
  assert.equal(normalized.to, "10001");
});

test("normalize group target", () => {
  const normalized = normalizeOneBotMessagingTarget("group:20002");
  assert.equal(normalized.chatType, "group");
  assert.equal(normalized.target, "group:20002");
  assert.equal(normalized.to, "20002");
});

test("normalize openclaw-prefixed group target", () => {
  const normalized = normalizeOneBotMessagingTarget("onebot:group:313214094");
  assert.equal(normalized.chatType, "group");
  assert.equal(normalized.target, "group:313214094");
  assert.equal(normalized.to, "313214094");
});

test("extract plain text from message segments", () => {
  const text = extractPlainText([
    { type: "text", data: { text: "hello " } },
    { type: "at", data: { qq: "10001" } },
    { type: "text", data: { text: "world" } }
  ]);
  assert.equal(text, "hello @10001 world");
});
