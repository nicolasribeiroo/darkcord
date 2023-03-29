import { DataWithClient, MessagePostData } from "@typings/index";
import { Partials } from "@utils/Constants";
import { Resolvable } from "@utils/Resolvable";
import {
  APIAttachment,
  APIEmbed,
  APIMessage,
  APIReaction,
  APIStickerItem,
  APIUser,
  MessageFlags as MFlags,
  MessageType,
} from "discord-api-types/v10";
import { DataCache } from "../manager/DataManager";
import { Base } from "./Base";
import { BitField } from "./BitField";
import { TextBasedChannel } from "./Channel";
import { Emoji, Reaction } from "./Emoji";
import { Guild } from "./Guild";
import { User } from "./User";
import { Member } from "./Member";

export class MessageFlags extends BitField<MFlags, typeof MFlags> {
  constructor(flags: MFlags) {
    super(flags, MFlags);
  }

  static Flags = MFlags;
}

export class Message extends Base {
  /**
   * ID of the channel the message was sent in
   */
  channelId: string;
  /**
   * The channel the message was sent in
   */
  channel: TextBasedChannel | null;
  /**
   * When this message was sent
   */
  timestamp: number;
  /**
   * Contents of the message
   */
  content: string;
  /**
   * Whether this message mentions everyone
   */
  mentionEveryone: boolean;
  /**
   * Any embedded content
   */
  embeds: APIEmbed[];
  /**
   * Any attached files
   */
  attachments: APIAttachment[];
  /**
   * The message associated with the message_reference
   */
  referencedMessage: Message | null;
  /**
   * If the message is generated by a webhook, this is the webhook's id
   */
  webhookId?: string;
  /**
   * A nonce that can be used for optimistic message sending (up to 25 characters)
   */
  nonce?: string | number;
  /**
   * The author of this message (only a valid user in the case where the message is generated by a user or bot user)
   */
  user: User | APIUser;
  /**
   * Type of message
   */
  type: MessageType;
  /**
   * A generally increasing integer (there may be gaps or duplicates) that represents the approximate position of the message in a thread
   *
   * it can be used to estimate the relative position of the message in a thread in company with total_message_sent on parent thread
   */
  position: number;
  /**
   * Message flags combined as a bitfield
   */
  flags: MessageFlags;
  /**
   * When this message was edited (or null if never)
   */
  editedTimestamp: number | null;
  /**
   * Sent if the message contains stickers
   */
  stickerItems?: APIStickerItem[];
  /**
   * Guild was message has sent
   */
  guild: Guild | null;
  /**
   * This message has resolved
   */
  isResolved: boolean;
  /**
   * Reactions in this message
   */
  reactions: DataCache<Reaction | APIReaction>;
  /**
   * Id of guild was message has sent
   */
  guildId?: string;
  /**
   * The member of this message (only received in guild)
   */
  member?: Member | null;
  constructor(data: DataWithClient<APIMessage>, guild?: Guild) {
    super(data, data.client);

    this.isResolved = false;
    this.channelId = data.channel_id;
    this.timestamp = Date.parse(data.timestamp);
    this.editedTimestamp = null;
    this.referencedMessage = data.referenced_message
      ? Resolvable.resolveMessage(
          new Message(
            {
              ...data.referenced_message,
              client: this._client,
            },
            this.guild!,
          ),
          this._client,
        )
      : null;
    this.webhookId = data.webhook_id;
    this.nonce = data.nonce;
    this.user = data.client.users.add(data.author);
    this.member = null;
    this.type = data.type;

    this.guild = guild ?? null;
    this.guildId = guild?.id;
    this.reactions = new DataCache();

    if (this.guild) {
      this.member = this.guild.members.cache.get(this.user.id);
    }

    this._update(data);
  }

  /**
   * Reply this message
   * @param content The content  to reply
   * @returns
   */
  async reply(content: MessagePostData | string) {
    if (this.type !== MessageType.Reply && this.type !== MessageType.Default) {
      return;
    }

    if (typeof content === "string") {
      content = {
        content,
      };
    }

    if (!content.message_reference) {
      content.message_reference = {
        message_id: this.id,
      };
    }

    content.message_reference.channel_id = this.channelId;
    content.message_reference.message_id = this.id;

    if (!this.isResolved) {
      throw new Error("Message not resolved");
    }

    return this.channel?.createMessage(content);
  }

  /**
   * Create's a reaction in message
   * @param emoji Emoji to create te reactions
   * @returns
   */
  async createReaction(emoji: string | Emoji): Promise<APIReaction | Reaction> {
    if (emoji instanceof Emoji) {
      emoji = emoji.uriComponent;
    } else {
      emoji = Emoji.getEncodedURI(emoji);
    }

    let reaction = await this._client.rest.createReaction(
      this.channelId,
      this.id,
      emoji,
    );

    if (!this._client.cache._partial(Partials.Reaction)) {
      reaction = new Reaction({ ...reaction, client: this._client });
    }

    return this.reactions._add(
      reaction,
      true,
      reaction.emoji.id ?? reaction.emoji.name!,
    );
  }

  /**
   * Delete the message
   * @param reason Reason to delete message
   * @returns
   */
  delete(reason?: string) {
    if (!this.isResolved) {
      throw new Error("Message not resolved");
    }

    return this.channel?.deleteMessage(this.id, reason);
  }

  /**
   * Edit the message
   * @param content The new content of message
   * @returns
   */
  async edit(content: MessagePostData) {
    const data = await this._client.rest.editMessage(
      this.channelId,
      this.id,
      content,
    );

    return this._update(data);
  }

  /**
   * Fetch's the webhook of message
   * @returns
   */
  fetchWebhook() {
    if (this.channel?.isGuildText() && this.webhookId) {
      return this.channel.fetchWebhook(this.webhookId);
    }

    return null;
  }

  _update(data: APIMessage) {
    if ("content" in data) this.content = data.content;
    if ("mention_everyone" in data)
      this.mentionEveryone = data.mention_everyone;
    if ("embeds" in data) this.embeds = data.embeds;
    if ("attachments" in data) this.attachments = data.attachments;
    if ("position" in data) this.position = data.position ?? 0;
    if ("flags" in data && data.flags)
      this.flags = new MessageFlags(data.flags);
    if ("edited_timestamp" in data && data.edited_timestamp)
      this.editedTimestamp = Date.parse(data.edited_timestamp);
    if ("sticker_items" in data) this.stickerItems = data.sticker_items;

    this.channel ??= this._client.channels.cache.get(
      data.channel_id,
    ) as TextBasedChannel;

    if (Array.isArray(data.reactions)) {
      for (const reaction of data.reactions) {
        const resolved = this._client.cache._partial(Partials.Reaction)
          ? reaction
          : new Reaction({ ...reaction, client: this._client });

        this.reactions._add(
          resolved,
          true,
          resolved.emoji.id ?? resolved.emoji.name!,
        );
      }
    }

    return this;
  }

  toJSON() {
    return Base.toJSON(this as Message, [
      "attachments",
      "channel",
      "channelId",
      "content",
      "createdAt",
      "editedTimestamp",
      "embeds",
      "flags",
      "guild",
      "guildId",
      "id",
      "isResolved",
      "mentionEveryone",
      "nonce",
      "position",
      "rawData",
      "reactions",
      "referencedMessage",
      "stickerItems",
      "timestamp",
      "editedTimestamp",
      "type",
      "user",
      "webhookId",
    ]);
  }
}
