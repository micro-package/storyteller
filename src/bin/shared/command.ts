import type { CommandName } from "../app/command";
import { commandStoreStorytellerEvent } from "../app/commands/store-storyteller-event.command";
import { createCommandBus } from "./command-bus";

export const commandBus = createCommandBus<CommandName>()({
  commandHandlers: [commandStoreStorytellerEvent],
});
export type CommandBus = typeof commandBus;
