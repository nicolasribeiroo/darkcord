import {
  AnyClient,
  DataWithClient,
  InteractionFlags,
  MessagePostData,
} from "@typings/index";
import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteraction,
  APIApplicationCommandInteractionDataBasicOption,
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandOptionChoice,
  APIChannel,
  APIChatInputApplicationCommandInteractionData,
  APIGuildMember,
  APIInteraction,
  APIInteractionDataResolved,
  APIInteractionDataResolvedGuildMember,
  APIMessageApplicationCommandInteractionData,
  APIMessageComponentInteraction,
  APIMessageSelectMenuInteractionData,
  APIModalInteractionResponseCallbackData,
  APIModalSubmitInteraction,
  APIRole,
  APIUser,
  APIUserApplicationCommandInteractionData,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  ModalSubmitActionRowComponent,
} from "discord-api-types/v10";

import { InteractionResponse } from "@darkcord/interactions";
import { Resolvable } from "@utils/Resolvable";
import { MakeError, transformMessagePostData } from "@utils/index";
import { Base } from "./Base";
import { Channel, TextBasedChannel } from "./Channel";
import { Guild } from "./Guild";
import { Member } from "./Member";
import { Message } from "./Message";
import { Role } from "./Role";
import { User } from "./User";

export class Interaction extends Base {
  /**
   * Id of the application this interaction is for
   */
  applicationId: string;
  /**
   * Type of interaction
   */
  type: InteractionType;
  /**
   * Continuation token for responding to the interaction
   */
  token: string;
  /**
   * Read-only property, always 1
   */
  version: number;

  constructor(data: DataWithClient<APIInteraction>) {
    super(data, data.client);

    this.applicationId = data.application_id;
    this.type = data.type;
    this.token = data.token;
    this.version = data.version;
  }

  static from(data: DataWithClient<APIInteraction>, res?: InteractionResponse) {
    switch (data.type) {
      case InteractionType.ApplicationCommand: {
        return new CommandInteraction(data, res);
      }
      case InteractionType.MessageComponent: {
        return new ComponentInteraction(data, res);
      }
      case InteractionType.ApplicationCommandAutocomplete: {
        return new AutocompleteInteraction(data, res);
      }
      case InteractionType.ModalSubmit: {
        return new ModalSubmitInteraction(data, res);
      }
      default: {
        return new Interaction(data);
      }
    }
  }

  isCommand(): this is CommandInteraction {
    return this instanceof CommandInteraction;
  }

  isComponent(): this is ComponentInteraction {
    return this instanceof ComponentInteraction;
  }

  isAutoComplete(): this is AutocompleteInteraction {
    return this instanceof AutocompleteInteraction;
  }

  isModalSubmit(): this is ModalSubmitInteraction {
    return this instanceof ModalSubmitInteraction;
  }

  toJSON() {
    return Base.toJSON(this as Interaction, [
      "applicationId",
      "createdAt",
      "id",
      "rawData",
      "token",
      "type",
      "version",
    ]);
  }
}

export class ReplyableInteraction extends Interaction {
  // For http response
  _http?: InteractionResponse;
  /**
   * This interaction is received for webserver
   */
  isHTTP: boolean;
  /**
   * The interaction is acknowledged
   */
  acknowledged: boolean;
  constructor(
    data: DataWithClient<APIInteraction>,
    httpResponse?: InteractionResponse,
  ) {
    super(data);
    this._http = httpResponse;
    this.isHTTP = Boolean(httpResponse);
    this.acknowledged = false;
  }

  /**
   * Respond to this interaction with defer
   */
  async defer(flags?: InteractionFlags) {
    if (this.acknowledged) {
      throw MakeError({
        name: "InteractionAlreadyAcknowledged",
        message: "You have already acknowledged this interaction.",
      });
    }

    if (this.isHTTP) {
      await this._http?.send(
        {
          flags: (flags as MessageFlags) || 0,
        },
        InteractionResponseType.DeferredChannelMessageWithSource,
      );

      this.acknowledged = true;
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        {
          flags: (flags as MessageFlags) || 0,
        },
        InteractionResponseType.DeferredChannelMessageWithSource,
      );

      this.acknowledged = true;
    }
  }

  /**
   * Delete a interaction reply
   * @param messageId id of the reply to be deleted
   * @returns
   */
  deleteReply(messageId: string) {
    if (!this.acknowledged) {
      throw MakeError({
        name: "InteractionNoAcknowledged",
        message: "Acknowledge the interaction first",
      });
    }

    return this._client.rest.deleteWebhookMessage(
      this.applicationId,
      this.token,
      messageId,
    );
  }

  /**
   * Delete the original reply of this interaction
   * @returns
   */
  deleteOriginalReply() {
    return this.deleteReply("@original");
  }

  /**
   * Respond to this interaction
   * @param content The content of response
   */
  async reply(content: MessagePostData | string) {
    if (this.acknowledged) {
      throw MakeError({
        name: "InteractionAlreadyAcknowledged",
        message: "You have already acknowledged this interaction.",
      });
    }

    content = transformMessagePostData(content);

    if (this.isHTTP) {
      await this._http?.send(
        content,
        InteractionResponseType.ChannelMessageWithSource,
      );
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        content,
        InteractionResponseType.ChannelMessageWithSource,
      );
    }

    this.acknowledged = true;
  }

  /**
   * Edit a interaction reply
   * @param messageId
   * @param content
   */
  async editReply(messageId: string, content: MessagePostData | string) {
    await this._client.rest.editWebhookMessage(
      this.applicationId,
      this.token,
      messageId,
      transformMessagePostData(content),
    );
  }

  /**
   * Edit the original reply of this interaction
   * @param content
   * @returns
   */
  editOriginalReply(content: MessagePostData) {
    return this.editReply("@original", content);
  }

  /**
   * Create a followup message for the original reply of this interaction
   * @param content
   * @returns
   */
  createFollowUP(content: MessagePostData) {
    if (!this.acknowledged) {
      throw MakeError({
        name: "InteractionNoAcknowledged",
        message: "Acknowledge the interaction first",
      });
    }

    return this._client.rest.executeWebhook(
      this.applicationId,
      this.token,
      transformMessagePostData(content),
    );
  }

  /**
   * Delete a followup message
   * @param messageId The id of the followup to be deleted
   * @returns
   */
  deleteFollowUP(messageId: string) {
    return this._client.rest.deleteWebhookMessage(
      this.applicationId,
      this.token,
      messageId,
    );
  }

  /**
   * Edit a followup message
   * @param messageId The id of the followup to be edited
   * @param content The new content of followup
   * @returns
   */
  async editFollowUP(messageId: string, content: MessagePostData) {
    const data = await this._client.rest.editWebhookMessage(
      this.applicationId,
      this.token,
      messageId,
      content,
    );
    const channel = this._client.channels.cache.get(
      data.channel_id,
    )! as TextBasedChannel;
    const message = channel?.messages?.get(data.id);

    if (message) {
      return message._update(data);
    } else {
      const guildId = channel.isGuildChannel() ? channel.guildId : undefined;
      const message_1 = new Message(
        { client: this._client, ...data },
        guildId ? Resolvable.resolveGuild(guildId, this._client) : undefined,
      );
      return Resolvable.resolveMessage(message_1, this._client);
    }
  }

  /**
   * Get a followup message
   * @param messageId The id of the followup
   * @returns
   */
  async getFollowUP(messageId: string) {
    const data = await this._client.rest.getWebhookMessage(
      this.applicationId,
      this.token,
      messageId,
    );
    const channel = this._client.channels.cache.get(data.channel_id)!;
    const guildId = channel.isGuildChannel() ? channel.guildId : undefined;
    const message = new Message(
      { client: this._client, ...data },
      guildId ? Resolvable.resolveGuild(guildId, this._client) : undefined,
    );
    return Resolvable.resolveMessage(message, this._client);
  }

  /**
   * Get the original reply of this interaction
   * @returns
   */
  async getOriginalReply() {
    if (!this.acknowledged) {
      throw MakeError({
        name: "InteractionNoAcknowledged",
        message: "Acknowledge the interaction first",
      });
    }

    const rawMessage = await this._client.rest.getWebhookMessage(
      this.applicationId,
      this.token,
      "@original",
    );
    const channel = this._client.channels.cache.get(rawMessage.channel_id)!;
    const guildId = channel.isGuildChannel() ? channel.guildId : undefined;

    const message = new Message(
      { ...rawMessage, client: this._client },
      guildId ? Resolvable.resolveGuild(guildId, this._client) : undefined,
    );

    return Resolvable.resolveMessage(message, this._client);
  }

  toJSON() {
    return Base.toJSON(this as ReplyableInteraction, [
      "applicationId",
      "createdAt",
      "id",
      "rawData",
      "token",
      "type",
      "version",
      "acknowledged",
    ]);
  }
}

export class SelectMenuInteractionValues {
  #resolved: APIInteractionDataResolved | null;
  _rawValues: string[];
  constructor(
    resolved: APIInteractionDataResolved | null,
    values: string[],
    public _client: AnyClient,
    public guild?: Guild | null,
  ) {
    this.#resolved = resolved;
    this._rawValues = values;
  }

  _get<T extends Channel | User | Member | Role | APIUser | APIRole>(
    fn: (s: string) => T | undefined,
  ): T[] {
    if (!this.#resolved) {
      throw new Error(
        "Cannot get channels, mentions, roles or members in string select menu",
      );
    }

    return this._rawValues.map(fn).filter((r) => !!r) as T[];
  }

  /**
   * Get the selected channels
   * @returns
   */
  channels() {
    return this._get((id) => {
      const channel = this.#resolved?.channels?.[id];
      return channel && this._client.channels.cache.get(channel.id);
    });
  }

  /**
   * Get the selected users
   * @returns
   */
  users() {
    return this._get((id) => {
      const user = this.#resolved?.users?.[id];
      return user && this._client.users.get(user.id);
    });
  }

  /**
   * Get the selected members
   * @returns
   */
  members() {
    return this._get((id) => {
      const member = this.#resolved?.members?.[id];
      return member && this.guild?.members.cache.get(id);
    });
  }

  /**
   * Get the selected roles
   * @returns
   */
  roles() {
    return this._get((id) => {
      const role = this.#resolved?.roles?.[id];
      return role && this.guild?.roles.cache.get(role.id);
    });
  }

  /**
   * Get the selected mentionables (roles, channels, users, members)
   * @returns
   */
  mentionables() {
    return this._get((id) => {
      const user = this.#resolved?.users?.[id];
      const channel = this.#resolved?.channels?.[id];
      const role = this.#resolved?.roles?.[id];
      const member = this.#resolved?.members?.[id];

      if (member) {
        return this.guild?.members.cache.get(id) || this._client.users.get(id);
      }

      if (user) {
        return this._client.users.get(user.id);
      }

      if (channel) {
        return this._client.channels.cache.get(channel.id);
      }

      if (role) {
        return this._client.roles.cache.get(role.id);
      }
    });
  }

  /**
   * Get the selected strings
   * @returns
   */
  strings() {
    return this._rawValues;
  }
}

export class SelectMenuInteractionData {
  /**
   * The type of the component
   */
  componentType: ComponentType;
  /**
   * The custom_id of the component
   */
  customId: string;
  /**
   * Resolved data of the select menu
   */
  resolved: APIInteractionDataResolved | null;
  /**
   * Values of the select menu
   */
  values: SelectMenuInteractionValues;
  constructor(
    data: DataWithClient<APIMessageSelectMenuInteractionData>,
    guild?: Guild | null,
  ) {
    this.componentType = data.component_type;
    this.customId = data.custom_id;
    this.resolved = null;
    if ("resolved" in data) {
      this.resolved = data.resolved;
    }
    this.values = new SelectMenuInteractionValues(
      this.resolved,
      data.values,
      data.client,
      guild,
    );
  }
}

export class ComponentInteraction extends ReplyableInteraction {
  /**
   * The type of the component
   */
  componentType: ComponentType;
  /**
   * The custom_id of the component
   */
  customId: string;
  /**
   * The channel id it was sent from
   * @deprecated use `channel.id` instead
   */
  channelId: string;
  /**
   * The selected language of the invoking user
   */
  locale: string;
  /**
   * The guild's preferred locale, if invoked in a guild
   */
  guildLocale: string | null;
  /**
   * For components, the message they were attached to
   */
  message: Message;
  /**
   * The channel it was sent from
   */
  channel: Channel | (Partial<APIChannel> & Pick<APIChannel, "id" | "type">);
  /**
   * The component data payload
   */
  data: SelectMenuInteractionData | null;
  /**
   * The guild id it was sent from
   */
  guildId?: string;
  /**
   * The guild it was sent from
   */
  guild?: Guild | null;
  member: Member | null | undefined;
  constructor(
    data: DataWithClient<APIMessageComponentInteraction>,
    httpResponse?: InteractionResponse,
  ) {
    super(data, httpResponse);
    this.componentType = data.data.component_type;
    this.customId = data.data.custom_id;
    this.guildId = data.guild_id;
    this.guild = this.guildId
      ? data.client.guilds.cache.get(this.guildId)
      : null;
    this.channelId = data.channel_id;
    this.locale = data.locale;
    this.guildLocale = data.guild_locale ?? null;
    this.message = Resolvable.resolveMessage(
      new Message({
        ...data.message,
        client: data.client,
      }),
      data.client,
    );
    this.channel =
      data.client.channels.cache.get(data.channel?.id)! ?? data.channel;

    this.data = null;
    this.member = data.member ? this.guild?.members.cache.get(data.member?.user.id!) : null;

    if (
      [
        ComponentType.ChannelSelect,
        ComponentType.MentionableSelect,
        ComponentType.RoleSelect,
        ComponentType.StringSelect,
        ComponentType.UserSelect,
      ].some((type) => this.componentType === type)
    ) {
      this.data = new SelectMenuInteractionData(
        {
          client: data.client,
          ...(data.data as APIMessageSelectMenuInteractionData),
        },
        this.guild,
      );
    }
  }

  async deferUpdate() {
    if (this.acknowledged) {
      throw MakeError({
        name: "InteractionAlreadyAcknowledged",
        message: "You have already acknowledged this interaction.",
      });
    }

    if (this.isHTTP) {
      await this._http?.send({}, InteractionResponseType.DeferredMessageUpdate);
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        {},
        InteractionResponseType.DeferredMessageUpdate,
      );
    }
  }

  async editParent(content: MessagePostData) {
    content = transformMessagePostData(content);

    if (this.acknowledged) {
      return this.editOriginalReply(content);
    }

    if (this.isHTTP) {
      await this._http?.send(content, InteractionResponseType.UpdateMessage);
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        content,
        InteractionResponseType.UpdateMessage,
      );
    }
  }

  toJSON() {
    return Base.toJSON(this as ComponentInteraction, [
      "applicationId",
      "createdAt",
      "id",
      "rawData",
      "token",
      "type",
      "version",
      "channel",
      "channelId",
      "locale",
      "guildLocale",
      "message",
      "componentType",
      "acknowledged",
      "customId",
    ]);
  }
}

export class ModalSubmitInteraction extends ReplyableInteraction {
  /**
   * The selected language of the invoking user
   */
  locale: string;
  /**
   * The guild's preferred locale, if invoked in a guild
   */
  guildLocale: string | null;
  /**
   * For components, the message they were attached to
   */
  message: Message | null;
  /**
   * The channel id it was sent from
   * @deprecated use `channel.id` instead
   */
  channelId?: string;
  /**
   * The channel id it was sent from
   */
  channel:
    | Channel
    | (Partial<APIChannel> & Pick<APIChannel, "id" | "type">)
    | null;
  /**
   * A developer-defined identifier for the component, max 100 characters
   */
  customId: string;
  /**
   * A list of child components
   */
  components: ModalSubmitActionRowComponent[];
  constructor(
    data: DataWithClient<APIModalSubmitInteraction>,
    httpResponse?: InteractionResponse,
  ) {
    super(data, httpResponse);
    this.locale = data.locale;
    this.guildLocale = data.guild_locale ?? null;
    this.message = data.message
      ? Resolvable.resolveMessage(
          new Message({ ...data.message, client: data.client }),
          data.client,
        )
      : null;
    this.channelId = data.channel_id;
    this.channel =
      data.client.channels.cache.get(this.channel?.id!)! ?? data.channel;
    this.customId = data.data.custom_id;
    this.components = data.data.components;
  }

  async deferUpdate() {
    if (this.acknowledged) {
      throw MakeError({
        name: "InteractionAlreadyAcknowledged",
        message: "You have already acknowledged this interaction.",
      });
    }

    if (this.isHTTP) {
      await this._http?.send({}, InteractionResponseType.DeferredMessageUpdate);
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        {},
        InteractionResponseType.DeferredMessageUpdate,
      );
    }
  }

  async editParent(data: MessagePostData) {
    if (this.acknowledged) {
      return this.editOriginalReply(data);
    }

    if (this.isHTTP) {
      await this._http?.send(data, InteractionResponseType.UpdateMessage);
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        data,
        InteractionResponseType.UpdateMessage,
      );
    }
  }

  toJSON() {
    return Base.toJSON(this as ModalSubmitInteraction, [
      "applicationId",
      "createdAt",
      "id",
      "rawData",
      "token",
      "type",
      "version",
      "acknowledged",
      "channel",
      "channelId",
      "locale",
      "guildLocale",
      "message",
    ]);
  }
}

export class CommandInteractionOptions {
  #options: APIApplicationCommandInteractionDataBasicOption[];
  subCommand?: string;
  subCommandGroup?: string;
  #resolved: APIInteractionDataResolved;
  constructor(
    options: APIApplicationCommandInteractionDataOption[],
    resolved: APIInteractionDataResolved,
    public _client: AnyClient,
    public guild?: Guild,
  ) {
    this.#resolved = resolved;

    if (options[0]?.type === ApplicationCommandOptionType.Subcommand) {
      this.subCommand = options[0].name;
      options = options[0].options ?? [];
    }

    if (options[0]?.type === ApplicationCommandOptionType.SubcommandGroup) {
      this.subCommandGroup = options[0].name;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      options = options[0].options ?? [];
    }

    this.#options =
      options as APIApplicationCommandInteractionDataBasicOption[];
  }

  /**
   * Get a option
   * @param name The name of option
   * @returns
   */
  get(name: string) {
    const option = this.#options.find((o) => o.name === name);

    switch (option?.type) {
      case ApplicationCommandOptionType.Attachment: {
        return {
          value: this.#resolved.attachments?.[option.value] ?? null,
          name: option.name,
          type: option.type,
        };
      }
      case ApplicationCommandOptionType.User: {
        const user = this.#resolved.users?.[option.value];

        return {
          value: user ? this._client.users.add(user) : null,
          name: option.name,
          type: option.type,
        };
      }
      case ApplicationCommandOptionType.Channel: {
        const channel = this.#resolved.channels?.[option.value];

        return {
          value: channel
            ? this._client.channels.cache.get(channel.id) || channel
            : null,
          name: option.name,
          type: option.type,
        };
      }
      case ApplicationCommandOptionType.Role: {
        const role = this.#resolved.roles?.[option.value];
        return {
          value: role && this.guild ? this.guild.roles.add(role) : null,
          name: option.name,
          type: option.type,
        };
      }
      case ApplicationCommandOptionType.Mentionable: {
        const user = this.#resolved.users?.[option.value];
        const role = this.#resolved.roles?.[option.value];
        const member = this.#resolved.members?.[option.value];

        return {
          value:
            (member && this.guild?.members.cache.get(option.value)) ||
            (user && this._client.users.add(user)) ||
            (role && this.guild?.roles.add(role)) ||
            null,
          name: option.name,
          type: option.type,
        };
      }
      default: {
        return option;
      }
    }
  }

  /**
   * Get a string option value
   * @param name Option name
   * @returns
   */
  string(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.String ? r.value : null;
  }

  /**
   * Get a number option value
   * @param name Option name
   * @returns
   */
  number(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.Number ? r.value : null;
  }

  /**
   * Get a integer option value
   * @param name Option name
   * @returns
   */
  integer(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.Integer ? r.value : null;
  }

  /**
   * Get a boolean option value
   * @param name Option name
   * @returns
   */
  boolean(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.Boolean ? r.value : null;
  }

  /**
   * Get a attachment option value
   * @param name Option name
   * @returns
   */
  attachment(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.Attachment ? r.value : null;
  }

  /**
   * Get a user option value
   * @param name Option name
   * @returns
   */
  user(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.User ? r.value : null;
  }

  /**
   * Get a role option value
   * @param name Option name
   * @returns
   */
  role(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.Role ? r.value : null;
  }

  /**
   * Get a mentionable (user, member, role, channel) option value
   * @param name Option name
   * @returns
   */
  mentionable(name: string) {
    const r = this.get(name);
    return r?.type === ApplicationCommandOptionType.Mentionable
      ? r.value
      : null;
  }

  toArray() {
    return this.#options;
  }
}

export class ChatInputApplicationCommandInteractionData extends Base {
  /**
   * The type of the invoked command
   */
  type: ApplicationCommandType.ChatInput;
  /**
   * The name of the invoked command
   */
  name: string;

  /**
   * The guild ID of the invoked command
   */
  guildId?: string;

  /**
   * The options of the invoked command
   */
  options: CommandInteractionOptions | null;
  constructor(
    data: DataWithClient<APIChatInputApplicationCommandInteractionData>,
    guild?: Guild,
  ) {
    super(data, guild?._client);

    this.name = data.name;
    this.type = data.type;
    this.options = data.options
      ? new CommandInteractionOptions(
          data.options,
          data.resolved!,
          data.client,
          guild,
        )
      : null;
    data.resolved;
  }
}

export class MessageApplicationCommandInteractionData extends Base {
  constructor(
    data: DataWithClient<APIMessageApplicationCommandInteractionData>,
    guild?: Guild,
  ) {
    super(data, guild?._client);
  }
}

export class UserApplicationCommandInteractionData extends Base {
  /**
   * User target
   */
  target: User | APIUser;
  /**
   * The name of the invoked command
   */
  name: string;
  /**
   * 	Id of the user targeted
   */
  targetId: string;
  /**
   * Guild member target
   */
  targetMember?: APIInteractionDataResolvedGuildMember | Member;
  constructor(
    data: DataWithClient<APIUserApplicationCommandInteractionData>,
    guild?: Guild,
  ) {
    super(data, guild?._client);

    this.target =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      this._client.cache.users.get(data.target_id) ??
      data.resolved.users[data.target_id];
    this.targetId = data.target_id;
    this.name = data.name;
    this.targetMember =
      guild?.members.cache.get(data.target_id) ??
      data.resolved.members?.[data.target_id];
  }
}

export class CommandInteraction extends ReplyableInteraction {
  /**
   * The guild id it was sent from
   */
  guildId?: string;
  /**
   * The guild's preferred locale, if invoked in a guild
   */
  guildLocale?: string;
  /**
   * The channel id it was sent from
   * @deprecated use `channel.id` instead
   */
  channelId: string;
  /**
   * The guild object it was sent from
   */
  guild?: Guild | null;
  /**
   * The command data payload
   */
  data:
    | ChatInputApplicationCommandInteractionData
    | UserApplicationCommandInteractionData
    | MessageApplicationCommandInteractionData;
  /**
   * Member of the invoked command
   */
  member: Member | APIGuildMember | null = null;
  /**
   * User of the invoked command
   */
  user: User | APIUser | null = null;
  /**
   * The name of the invoked command
   */
  commandName: string;
  /**
   * The selected language of the invoking user
   */
  locale: string;
  /**
   * For components, the message they were attached to
   */
  message: Message | null;
  /**
   * The channel it was sent from
   */
  channel:
    | Channel
    | (Partial<APIChannel> & Pick<APIChannel, "id" | "type">)
    | null;

  declare rawData: APIApplicationCommandInteraction;
  constructor(
    data: DataWithClient<APIApplicationCommandInteraction>,
    httpResponse?: InteractionResponse,
  ) {
    super(data, httpResponse);
    this.guildId = data.guild_id;
    this.guildLocale = data.guild_locale;
    this.channelId = data.channel_id;
    this.channel =
      data.client.channels.cache.get(data.channel?.id)! ?? data.channel;
    this.guild = data.client.guilds.cache.get(data.guild_id!);
    this.commandName = data.data.name;
    this.locale = data.locale;
    this.message = data.message
      ? Resolvable.resolveMessage(
          new Message({ ...data.message, client: data.client }),
          data.client,
        )
      : null;

    if ("member" in data && data.member && this.guild) {
      const member = new Member(data.member as APIGuildMember, this.guild);
      this.member = this.guild.members.add(member);
      this.user = this.member!.user!;
    } else if ("member" in data && data.member) {
      this.member = data.member;
      this.user = this._client.cache.users.add(data.member.user!);
    } else {
      this.user = this._client.cache.users.add(data.user!);
    }

    if (data.data.type === ApplicationCommandType.ChatInput) {
      this.data = new ChatInputApplicationCommandInteractionData(
        {
          ...data.data,
          client: this._client,
        },
        this.guild,
      );
    } else if (data.data.type === ApplicationCommandType.Message) {
      this.data = new MessageApplicationCommandInteractionData(
        {
          ...data.data,
          client: this._client,
        },
        this.guild,
      );
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (data.data.type === ApplicationCommandType.User) {
      this.data = new UserApplicationCommandInteractionData(
        {
          ...data.data,
          client: this._client,
        },
        this.guild,
      );
    }
  }

  /**
   * Create a modal
   */
  async createModal(data: APIModalInteractionResponseCallbackData) {
    if (this.acknowledged) {
      throw MakeError({
        name: "InteractionAlreadyAcknowledged",
        message: "You have already acknowledged this interaction.",
      });
    }

    if (this.isHTTP) {
      await this._http?.send(data, InteractionResponseType.Modal);

      this.acknowledged = true;
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        data,
        InteractionResponseType.Modal,
      );

      this.acknowledged = true;
    }
  }

  toJSON() {
    return Base.toJSON(this as CommandInteraction, [
      "applicationId",
      "createdAt",
      "id",
      "rawData",
      "token",
      "type",
      "version",
      "acknowledged",
      "channel",
      "channelId",
      "commandName",
      "data",
      "guild",
      "guildId",
      "guildLocale",
      "message",
      "member",
      "user",
      "locale",
    ]);
  }
}

export class AutocompleteInteraction extends Interaction {
  // For http response
  _http?: InteractionResponse;
  /**
   * This interaction is received for webserver
   */
  isHTTP: boolean;
  /**
   * The interaction is acknowledged
   */
  acknowledged: boolean;
  constructor(
    data: DataWithClient<APIApplicationCommandAutocompleteInteraction>,
    httpResponse?: InteractionResponse,
  ) {
    super(data);

    this._http = httpResponse;
    this.isHTTP = Boolean(httpResponse);
    this.acknowledged = false;
  }

  async result(choices: APIApplicationCommandOptionChoice[]) {
    if (this.acknowledged) {
      throw MakeError({
        name: "InteractionAlreadyAcknowledged",
        message: "You have already acknowledged this interaction.",
      });
    }

    if (this.isHTTP) {
      await this._http?.send(
        { choices },
        InteractionResponseType.ApplicationCommandAutocompleteResult,
      );
    } else {
      await this._client.rest.respondInteraction(
        this.id,
        this.token,
        { choices },
        InteractionResponseType.ApplicationCommandAutocompleteResult,
      );
    }

    this.acknowledged = true;
  }
}
