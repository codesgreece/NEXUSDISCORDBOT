import { Client, Events } from 'discord.js';
import { readyHandler } from './ready';
import { interactionCreateHandler } from './interactionCreate';

export function registerEvents(client: Client): void {
  client.once(Events.ClientReady, readyHandler);
  client.on(Events.InteractionCreate, interactionCreateHandler);
}
