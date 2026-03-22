export type OneBotAccountConfig = {
  enabled?: boolean;
  name?: string;
  selfId?: string;
  apiBaseUrl?: string;
  wsUrl?: string;
  accessToken?: string;
  webhookPath?: string;
  webhookSecret?: string;
};

export type OneBotChannelConfig = {
  enabled?: boolean;
  accounts?: Record<string, OneBotAccountConfig>;
};

export type CoreConfig = {
  channels?: {
    onebot?: OneBotChannelConfig;
  };
  session?: Record<string, unknown>;
};

export type ResolvedOneBotAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  selfId?: string;
  apiBaseUrl?: string;
  wsUrl?: string;
  accessToken?: string;
  webhookPath: string;
  webhookSecret?: string;
  config: OneBotAccountConfig;
};

export type OneBotV11MessageSegment = {
  type: string;
  data?: Record<string, string>;
};

export type OneBotV11Event = {
  time?: number;
  self_id?: number | string;
  post_type?: string;
  message_type?: "private" | "group" | string;
  sub_type?: string;
  user_id?: number | string;
  group_id?: number | string;
  raw_message?: string;
  message?: string | OneBotV11MessageSegment[];
  message_id?: number | string;
  sender?: {
    user_id?: number | string;
    nickname?: string;
    card?: string;
  };
};
