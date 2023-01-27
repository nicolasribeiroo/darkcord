import {
  APIAttachment,
  APIEmbed,
  APIMessage,
  APIReaction,
  APIStickerItem,
  MessageFlags as MFlags,
  MessageType,
} from "discord-api-types/v10";
import { DataWithClient, MessagePostData } from "@typings/index";
import { Partials } from "@utils/Constants";
import { Base } from "./Base";
import { BitField } from "./BitField";
import { Channel, GuildChannel, TextBasedChannel } from "./Channel";
import { Emoji, Reaction } from "./Emoji";
import { User } from "./User";
import { Guild } from "./Guild";
import { Cache } from "@cache/Cache";

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
   * the channel the message was sent in
   */
  channel: TextBasedChannel | null;
  /**
   * when this message was sent
   */
  timestamp: Date;
  /**
   * contents of the message
   */
  content: string;
  /**
   * whether this message mentions everyone
   */
  mentionEveryone: boolean;
  /**
   * any embedded content
   */
  embeds: APIEmbed[];
  /**
   * any attached files
   */
  attachments: APIAttachment[];
  /**
   * the message associated with the message_reference
   */
  referencedMessage: Message | null;
  /**
   * if the message is generated by a webhook, this is the webhook's id
   */
  webhookId?: string;
  /**
   * a nonce that can be used for optimistic message sending (up to 25 characters)
   */
  nonce?: string | number;
  /**
   * the author of this message (only a valid user in the case where the message is generated by a user or bot user)
   */
  user: User;
  /**
   * type of message
   */
  type: MessageType;
  /**
   * a generally increasing integer (there may be gaps or duplicates) that represents the approximate position of the message in a thread
   *
   * it can be used to estimate the relative position of the message in a thread in company with total_message_sent on parent thread
   */
  position: number;
  /**
   * message flags combined as a bitfield
   */
  flags: MessageFlags;
  /**
   * when this message was edited (or null if never)
   */
  editedTimestamp: Date | null;
  /**
   * sent if the message contains stickers
   */
  stickerItems?: APIStickerItem[];
  /**
   * guild was message has sent
   */
  guild?: Guild;
  #resolved: boolean;
  /**
   * Reactions in this message
   */
  reactions: Cache<Reaction | APIReaction>;
  constructor(data: DataWithClient<APIMessage>, guild?: Guild) {
    super(data, data.client);

    this.#resolved = false;

    this.channelId = data.channel_id;
    this.timestamp = new Date(data.timestamp);
    this.content = data.content;
    this.mentionEveryone = data.mention_everyone;
    this.embeds = data.embeds;
    this.attachments = data.attachments;
    this.referencedMessage = data.referenced_message
      ? new Message({
          ...data.referenced_message,
          client: this._client,
        })
      : null;
    this.webhookId = data.webhook_id;
    this.nonce = data.nonce;
    this.user = new User({ ...data.author, client: this._client });
    this.type = data.type;
    this.position = data.position;
    this.flags = new MessageFlags(data.flags);
    this.editedTimestamp = data.edited_timestamp
      ? new Date(data.edited_timestamp)
      : null;
    this.stickerItems = data.sticker_items;
    this.channel = null;
    this.guild = guild ?? null;
    this.reactions = new Cache();

    if (Array.isArray(data.reactions)) {
      for (const reaction of data.reactions) {
        this.reactions._add(
          this._client.cache._partial(Partials.Reaction)
            ? reaction
            : new Reaction({ ...reaction, client: this._client })
        );
      }
    }
  }

  async _resolve() {
    let channel = this._client.cache.channels.get(this.channelId);

    if (!channel) {
      channel = await this._client.rest.getChannel(this.channelId);
    }

    if (!(channel instanceof Channel)) {
      channel = Channel.from({ client: this._client, ...channel }, this.guild);
    }

    if ("guild" in channel && !this.guild) {
      this.guild = (channel as GuildChannel).guild;
    }

    this.channel = channel as TextBasedChannel;
    this.channel.messages.add(this);

    this.#resolved = true;
  }

  async reply(content: MessagePostData) {
    if (!content.message_reference) {
      content.message_reference = {
        message_id: this.id,
      };
    }

    content.message_reference.channel_id = this.channelId;
    content.message_reference.message_id = this.id;

    if (!this.#resolved) {
      await this._resolve();
    }

    return this.channel.createMessage(content);
  }

  async createReaction(emoji: string | Emoji): Promise<APIReaction | Reaction> {
    if (emoji instanceof Emoji) {
      emoji = emoji.uriComponent;
    } else {
      emoji = Emoji.getEncodedURI(emoji);
    }

    let reaction = await this._client.rest.createReaction(
      this.channelId,
      this.id,
      emoji
    );

    if (!this._client.cache._partial(Partials.Reaction)) {
      reaction = new Reaction({ ...reaction, client: this._client });
    }

    return this.reactions._add(reaction, true, reaction.emoji.id);
  }

  async delete(reason?: string) {
    if (!this.#resolved) {
      await this._resolve();
    }

    return this.channel.deleteMessage(this.id, reason);
  }
}
