import { DataWithClient } from "@typings/index";
import {
  APIInvite,
  APIPartialChannel,
  APIUser,
  InviteTargetType,
} from "discord-api-types/v10";

import { GuildChannel } from "./Channel";
import { Guild, InviteGuild, ScheduledEvent } from "./Guild";
import { User } from "./User";

export class Invite {
  /**
   * The guild this invite is for
   */
  guild: Guild | InviteGuild;
  /**
   * The expiration date of this invite
   */
  expiresAt: number | null;
  /**
   * The user who created the invite
   */
  inviter: User | APIUser | null;
  /**
   * The invite code (unique ID)
   */
  code: string;
  /**
   * The channel this invite is for
   */
  channel: GuildChannel | APIPartialChannel;
  /**
   * The type of target for this voice channel invite
   */
  targetType: InviteTargetType;
  /**
   * The user whose stream to display for this voice channel stream invite
   */
  targetUser: User | APIUser | null;
  /**
   * Approximate count of total members
   */
  approximateMemberCount: number;
  /**
   * Approximate count of online members
   */
  approximatePresenceCount: number;
  /**
   * The guild scheduled event
   */
  guildScheduledEvent: ScheduledEvent | null;
  constructor(data: DataWithClient<APIInvite>) {
    this.guild = data.guild
      ? data.client.cache.guilds.get(data.guild.id) ??
        new InviteGuild({ ...data.guild, client: data.client })
      : null;

    this.expiresAt = data.expires_at
      ? new Date(data.expires_at).getTime()
      : null;

    this.inviter = data.inviter
      ? data.client.cache.users.add(data.inviter)
      : null;

    this.code = data.code;

    this.channel =
      data.client.cache.channels.get(data.channel.id) ?? data.channel;

    this.targetType = data.target_type;
    this.targetUser = data.target_user
      ? data.client.cache.users.add(data.target_user)
      : null;

    this.approximateMemberCount = data.approximate_member_count;
    this.approximatePresenceCount = data.approximate_presence_count;
    this.guildScheduledEvent = data.guild_scheduled_event
      ? new ScheduledEvent(data.guild_scheduled_event, this.guild)
      : null;

    if (this.guildScheduledEvent && this.guild instanceof Guild) {
      this.guild.scheduledEvents.set(
        this.guildScheduledEvent.id,
        this.guildScheduledEvent
      );
    }
  }
}