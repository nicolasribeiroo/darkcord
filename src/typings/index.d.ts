import { Cache } from "@cache/Cache";
import { EmojiCache } from "@cache/EmojiCache";
import { GuildStickerCache } from "@cache/StickerCache";
import { WebServer, WebServerInteractionResponse } from "@client/WebServer";
import { Channel, TextBasedChannel, ThreadChannel } from "@resources/Channel";
import { StageChannel, VoiceChannel } from "@resources/Channel";
import { Reaction } from "@resources/Emoji";
import { Guild, ScheduledEvent } from "@resources/Guild";
import { Interaction } from "@resources/Interaction";
import { Invite } from "@resources/Invite";
import { Member, ThreadMember } from "@resources/Member";
import { Message } from "@resources/Message";
import { Role } from "@resources/Role";
import { User } from "@resources/User";
import { VoiceState } from "@resources/VoiceState";
import { Partials } from "@utils/Constants";
import {
  APIAuditLog,
  APIAuditLogChange,
  APIAuditLogEntry,
  APIChannel,
  APIGuild,
  APIGuildMember,
  APIInteraction,
  APIReaction,
  APIRole,
  APIStageInstance,
  APITextBasedChannel,
  APIUser,
  ChannelType,
  GatewayGuildMembersChunkDispatchData,
  GatewayIntentBits,
  GatewayReceivePayload,
  MessageFlags,
  RESTPostAPIChannelMessageJSONBody,
  UserAvatarFormat,
} from "discord-api-types/v10";
import { Blob, Buffer } from "node:buffer";
import { IncomingMessage, ServerResponse } from "node:http";

import { BaseClient, Client, InteractionClient } from "client/Client";

import { Integration } from "../resources/Integration";
import EventEmitter from "node:events";

export interface RateLimitEvent {
  global: boolean;
  timeout: number;
  limit: number;
  router: string;
  method: string;
}

export interface RestEvents {
  request: [data: unknown];
  rateLimit: [event: RateLimitEvent];
  warn: [message: string];
}

interface PromiseQueue {
  resolve: CallableFunction;
  promise: Promise<unknown>;
}

export interface RequestHeaders {
  Authorization?: string;
  "User-Agent": string;
  "X-Audit-Log-Reason"?: string;
  "Content-Type": string;
}

export interface RequestHandlerOptions {
  token?: string;
  apiVersion?: string;
  maxRetry?: number;
}

export interface DisplayUserAvatarOptions {
  format?: UserAvatarFormat;
  size?: number;
}

export interface MessageAttachment {
  name: string;
  file: Buffer | Blob;
  description?: string;
}

export interface MessagePostData extends RESTPostAPIChannelMessageJSONBody {
  files?: MessageAttachment[];
}

export type GuildDataModel<T> = T & { guild: Guild };

export interface MakeErrorOptions {
  name?: string;
  message: string;
  args?: [string, any][];
}

export interface BaseClientOptions {
  partials: Partials[];
}

export interface InteractionClientOptions extends BaseClientOptions {
  webserver?: WebServerOptions;
  rest?: {
    token?: string;
  };
  cache?: {
    adapter?: CacheAdapter;
    guilds?: CacheOption;
    channels?: CacheOption;
    roles?: CacheOption;
    messageCacheLimitPerChannel?: number;
  };
}

export type CacheOption = number | BaseCacheOptions;

export interface ClientOptions extends BaseClientOptions {
  gateway: {
    intents: GatewayIntentBits | GatewayIntentBits[];
    encoding?: "json" | "etf";
    compress?: boolean;
    properties?: {
      browser: string;
      device: string;
    };
    totalShards?: number;
    disabledEvents: (keyof ClientEvents)[];
  };
  cache?: {
    adapter?: CacheAdapter;
    guilds?: CacheOption;
    users?: CacheOption;
    channels?: CacheOption;
    emojis?: CacheOption;
    stickers?: CacheOption;
    threads?: CacheOption;
    members?: CacheOption;
    roles?: CacheOption;
    messageCacheLimitPerChannel?: number;
  };
  plugins: CallableFunction[];
}

export interface WebServerOptions {
  hostname?: string;
  port: number;
}

export type RawWebServerResponse = ServerResponse<IncomingMessage> & {
  req: IncomingMessage;
};

export interface WebServerEvents {
  data: [
    request: IncomingMessage,
    response: http.ServerResponse<http.IncomingMessage> & {
      req: http.IncomingMessage;
    }
  ];
  listen: [webserver: WebServer];
  interactionDataReceived: [
    body: APIInteraction,
    response: WebServerInteractionResponse
  ];
  interactionPingReceived: [];
}

export type InteractionFlags =
  | MessageFlags.Ephemeral
  | MessageFlags.SuppressEmbeds;

export interface GatewayShardOptions {
  /**
   * the encoding of received gateway packets
   */
  encoding?: "json" | "etf";
  /**
   * recommended to compress gateway packets
   * */
  compress?: boolean;
  /**
   * the id of this gateway shard
   */
  shardId: string;
}

export interface GatewayShardEvents {
  connect: [];
  reconnecting: [];
  close: [code: number, reason: string];
  resume: [];
  reconnectRequired: [];
  ping: [ping: number];
  hello: [];
  debug: [message: string];
  ready: [];
  preReady: [];
  error: [error: any];
  dispatch: [event: string, data: any];
}

export type GuildMembersChunkData = Omit<
  KeysToCamelCase<GatewayGuildMembersChunkDispatchData>,
  "presences" | "members"
> & { members: (APIGuildMember | Member)[]; guild: Guild };

export interface InteractionClientEvents {
  interactionCreate: [interaction: Interaction];
  connect: [];
  warn: [message: string];
}

export interface AuditLogEntry
  extends Omit<KeysToCamelCase<APIAuditLogEntry>, "changes" | "options"> {
  options: KeysToCamelCase<APIAuditLogEntry["options"]>;
  changes: KeysToCamelCase<APIAuditLogChange>[];
}

export interface VoiceServer {
  host: string;
  guild: Guild;
  token: string;
}

export interface ClientEvents {
  // Gateway
  packet: [payload: GatewayReceivePayload];
  ready: [];
  shardConnect: [id: string];
  reconnecting: [];
  shardClose: [code: number, reason: string, id: string];
  shardResume: [id: string];
  shardReconnectRequired: [id: string];
  shardPing: [ping: number, id: string];
  shardHello: [id: string];
  shardDebug: [message: string, id: string];
  shardReady: [id: string];
  shardPreReady: [id: string];
  shardError: [error: any, id: string];
  connect: [];

  // Message
  messageCreate: [message: Message];
  messageUpdate: [old: Message, updated: Message];
  messageDelete: [message: Message];
  messageDeleteBulk: [messagesDeleted: Map<Message>];
  messageReactionAdd: [reaction: Reaction | APIReaction, user: User | APIUser];
  messageReactionRemove: [
    reaction: Reaction | APIReaction,
    user: User | APIUser
  ];
  messageReactionRemoveAll: [
    message: Message,
    removed: Cache<Reaction | APIReaction>
  ];
  messageReactionRemoveEmoji: [
    message: Message,
    removed: Reaction | APIReaction
  ];
  typingStart: [typing: Typing];

  // Interaction
  interactionCreate: [interaction: Interaction];

  // Guild
  guildMembersChunk: [data: GuildMembersChunkEventData];
  guildMembersChunked: [guild: Guild, chunkCount: number];
  guildCreate: [guild: Guild];
  guildUpdate: [old: Guild, updated: Guild];
  guildDelete: [deleted: Guild];
  guildAuditLogEntryCreate: [log: AuditLogEntry];
  guildBanAdd: [guild: Guild, userBanned: User | APIUser];
  guildBanRemove: [guild: Guild, userUnbanned: User | APIUser];
  guildEmojisUpdate: [old: EmojiCache, updated: EmojiCache, guild: Guild];
  guildStickersUpdate: [
    old: GuildStickerCache,
    updated: GuildStickerCache,
    guild: Guild
  ];
  guildMemberAdd: [newMember: Member, guild: Guild];
  guildMemberRemove: [user: User | APIUser, guild: Guild];
  guildMemberUpdate: [old: Member, updated: Member];
  guildIntegrationsUpdate: [guild: Guild];
  guildRoleCreate: [role: Role | APIRole, guild: Guild];
  guildRoleUpdate: [old: Role | APIRole, updated: Role | APIRole, guild: Guild];
  guildRoleDelete: [deleted: Role | APIRole, guild: Guild];
  guildScheduledEventCreate: [event: ScheduledEvent];
  guildScheduledEventUpdate: [old: ScheduledEvent, updated: ScheduledEvent];
  guildScheduledEventDelete: [deleted: ScheduledEvent];
  guildScheduledEventUserAdd: [event: ScheduledEvent, user: User | APIUser];
  guildScheduledEventUserRemove: [event: ScheduledEvent, user: User | APIUser];

  // Thread
  threadCreate: [thread: ThreadChannel];
  threadMemberUpdate: [member: ThreadMember];
  threadMembersUpdate: [added: ThreadMember[], removed: string[]];
  threadDelete: [thread: ThreadChannel];
  threadListSync: [threads: Cache<TheadChannel>, guild: Guild];

  // Stage
  stageInstanceCreate: [instance: APIStageInstance];
  stageInstanceDelete: [instance: APIStageInstance];
  stageInstanceUpdate: [old: APIStageInstance, updated: APIStageInstance];

  // Channel
  channelCreate: [channel: Channel];
  channelDelete: [channel: Channel | APIChannel];
  channelUpdate: [old: Channel | APIChannel, updated: Channel];
  channelPinsUpdate: [
    channel: TextBasedChannel | APITextBasedChannel<ChannelType>
  ];

  // User
  userUpdate: [old: User | APIUser, updated: User | APIUser];

  // Voice
  voiceChannelSwitch: [
    member: Member,
    newChannel: VoiceChannel | StageChannel,
    oldChannel: VoiceChannel | StageChannel
  ];
  voiceChannelJoin: [member: Member, channel: VoiceChannel | StageChannel];
  voiceChannelLeave: [member: Member, channel: VoiceChannel | StageChannel];
  voiceStateUpdate: [member: Member, channel: VoiceState];
  voiceServerUpdate: [server: VoiceServer];

  // Client
  warn: [message: string];

  // Integration
  integrationCreate: [integration: Integration];

  // Invite
  inviteCreate: [invite: Invite];
  inviteDelete: [invite: Invite];
}

export type ValueOf<I> = I[keyof I];

// Only used to implements interfaces
export interface TypedEvents<E> {
  on<T extends keyof E>(event: T, listener: (...args: E[T]) => any): this;
  on(event: string, listener: (...args: any[]) => any): this;
  once<T extends keyof E>(event: T, listener: (...args: E[T]) => any): this;
  once(event: string, listener: (...args: any[]) => any): this;
  emit<T extends keyof E>(event: T, ...args: E[T]): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export interface BaseCacheSweeper<T> {
  lifetime?: number;
  filter?: (value: T) => boolean;
  keepFilter?: (value: T) => boolean;
}

export interface BaseCacheOptions<T = unknown> {
  maxSize: number;
  sweeper?: BaseCacheSweeper<T>;
}

export type Awaitable<T> = T | Promise<T>;

export interface CacheAdapter<T> {
  set(key: string, value: T): CacheAdapter<T>;
  get(key: string): T | undefined;
  delete(key: string): boolean;
  clear(): void;
  entries(): IterableIterator<[string, T]>;
  values(): IterableIterator<T>;
  keys(): IterableIterator<string>;
  has(key: string): boolean;
  size: number;
}

export type AnyClient = InteractionClient | Client;
export type DataWithClient<T = Record<string, any>> = T & { client: AnyClient };

type CamelCase<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>;

type KeysToCamelCase<T> = {
  [K in keyof T as CamelCase<string & K>]: T[K] extends Record<string, K>
    ? KeysToCamelCase<T[K]>
    : T[K];
};

export type APIGuildWithShard = APIGuild & { shard_id: string };

export interface Typing {
  channelId: string;
  channel?: TextBasedChannel | APIChannel;
  startedTimestamp: number;
  guild?: Guild;
  member?: Member;
  guildId?: string;
  userId: string;
}