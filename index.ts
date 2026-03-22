import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/compat";
import { onebotPlugin } from "./src/channel.js";
import { registerOneBotWebhookRoute } from "./src/http.js";
import { setOneBotRuntime } from "./src/runtime.js";

const plugin = {
  id: "onebot",
  name: "OneBot",
  description: "OneBot v11 channel plugin (MVP)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setOneBotRuntime(api.runtime);
    api.registerChannel({ plugin: onebotPlugin });
    registerOneBotWebhookRoute(api);
  },
};

export default plugin;
