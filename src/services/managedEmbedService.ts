/**
 * Shared managed-embed publisher.
 * Internal markers (e.g. NEXUS_WELCOME_EMBED) stay in code/DB only —
 * they must NEVER appear as Discord message content.
 */
import {
  ActionRowBuilder,
  EmbedBuilder,
  Message,
  MessageActionRowComponentBuilder,
  TextChannel,
} from 'discord.js';
import { getManagedMessage, upsertManagedMessage } from '../db/controlRepository';

export const MANAGED_EMBED_CONTENT_TYPE = 'managed_embed';

/** Internal keys only — never send these as Discord content */
export const MANAGED_EMBED_MARKERS = {
  welcome: 'NEXUS_WELCOME_EMBED',
  rules: 'NEXUS_RULES_EMBED',
  services: 'NEXUS_SERVICES_EMBED',
  pricing: 'NEXUS_PRICING_EMBED',
  ticket: 'NEXUS_TICKET_PANEL',
} as const;

export type ManagedEmbedKey = keyof typeof MANAGED_EMBED_MARKERS;

function markerPatterns(marker: string): string[] {
  return [`<!-- ${marker} -->`, `<!--${marker}-->`, marker];
}

function messageHasLegacyMarker(message: Message, marker: string): boolean {
  const content = message.content || '';
  return markerPatterns(marker).some((p) => content.includes(p));
}

/**
 * Resolve an existing managed embed message.
 * Prefer DB messageId / managed_messages; legacy marker scan is fallback only
 * so we can clean old messages without creating duplicates.
 */
export async function resolveManagedEmbedMessage(input: {
  guildId: string;
  channel: TextChannel;
  entityId: ManagedEmbedKey | string;
  storedMessageId?: string | null;
  legacyMarker?: string;
}): Promise<Message | null> {
  const { guildId, channel, entityId, storedMessageId, legacyMarker } = input;

  if (storedMessageId) {
    const byId = await channel.messages.fetch(storedMessageId).catch(() => null);
    if (byId) return byId;
  }

  const managed = getManagedMessage(guildId, MANAGED_EMBED_CONTENT_TYPE, entityId);
  if (managed?.messageId) {
    const byManaged = await channel.messages
      .fetch(managed.messageId)
      .catch(() => null);
    if (byManaged) return byManaged;
  }

  if (legacyMarker) {
    try {
      const recent = await channel.messages.fetch({ limit: 50 });
      const legacy = recent.find(
        (m) => m.author.bot && messageHasLegacyMarker(m, legacyMarker),
      );
      if (legacy) return legacy;
    } catch {
      // ignore fetch errors
    }
  }

  return null;
}

export async function publishManagedEmbed(input: {
  guildId: string;
  channel: TextChannel;
  entityId: ManagedEmbedKey | string;
  embeds: EmbedBuilder[];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  storedMessageId?: string | null;
  legacyMarker?: string;
  reason?: string;
}): Promise<{ message: Message; created: boolean; cleanedMarker: boolean }> {
  const marker =
    input.legacyMarker ??
    (input.entityId in MANAGED_EMBED_MARKERS
      ? MANAGED_EMBED_MARKERS[input.entityId as ManagedEmbedKey]
      : undefined);

  const existing = await resolveManagedEmbedMessage({
    guildId: input.guildId,
    channel: input.channel,
    entityId: input.entityId,
    storedMessageId: input.storedMessageId,
    legacyMarker: marker,
  });

  const payload = {
    // Never publish internal markers as visible content
    content: '',
    embeds: input.embeds,
    components: input.components ?? [],
  };

  let message: Message;
  let created = false;
  let cleanedMarker = false;

  if (existing) {
    cleanedMarker = Boolean(marker && messageHasLegacyMarker(existing, marker));
    message = await existing.edit(payload);
  } else {
    // Omit content entirely on create — embeds-only message
    message = await input.channel.send({
      embeds: input.embeds,
      components: input.components ?? [],
    });
    created = true;
  }

  upsertManagedMessage({
    guildId: input.guildId,
    contentType: MANAGED_EMBED_CONTENT_TYPE,
    entityId: String(input.entityId),
    channelId: input.channel.id,
    messageId: message.id,
  });

  return { message, created, cleanedMarker };
}

/**
 * Strip visible legacy markers from an existing managed message while
 * preserving embeds/components. No-op if message missing or already clean.
 */
export async function scrubManagedEmbedContent(input: {
  guildId: string;
  channel: TextChannel;
  entityId: ManagedEmbedKey | string;
  storedMessageId?: string | null;
  legacyMarker?: string;
}): Promise<{ scrubbed: boolean; messageId: string | null }> {
  const marker =
    input.legacyMarker ??
    (input.entityId in MANAGED_EMBED_MARKERS
      ? MANAGED_EMBED_MARKERS[input.entityId as ManagedEmbedKey]
      : undefined);

  const existing = await resolveManagedEmbedMessage({
    ...input,
    legacyMarker: marker,
  });
  if (!existing) return { scrubbed: false, messageId: null };

  const hadMarker = Boolean(marker && messageHasLegacyMarker(existing, marker));
  const hasVisibleContent = Boolean(existing.content && existing.content.trim());

  if (!hadMarker && !hasVisibleContent) {
    upsertManagedMessage({
      guildId: input.guildId,
      contentType: MANAGED_EMBED_CONTENT_TYPE,
      entityId: String(input.entityId),
      channelId: input.channel.id,
      messageId: existing.id,
    });
    return { scrubbed: false, messageId: existing.id };
  }

  await existing.edit({
    content: '',
    embeds: [...existing.embeds],
    components: [...existing.components],
  });

  upsertManagedMessage({
    guildId: input.guildId,
    contentType: MANAGED_EMBED_CONTENT_TYPE,
    entityId: String(input.entityId),
    channelId: input.channel.id,
    messageId: existing.id,
  });

  return { scrubbed: true, messageId: existing.id };
}
