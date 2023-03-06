import type { CommandBusGeneric } from "../shared/command-bus";
import { zod } from "../shared/zod";
import type { commandStartTestContainer } from "./commands/start-test-container.command";
import type { commandStopTestContainer } from "./commands/stop-test-container.command";
import type { commandStoreStorytellerEvent } from "./commands/store-storyteller-event.command";

export const commandValidator = zod.object({
  commandName: zod.string() as unknown as zod.ZodLiteral<string>,
  commandPayload: zod.any() as unknown as zod.ZodObject<any>,
});

export type CommandBus = CommandBusGeneric<
  CommandName,
  | ReturnType<typeof commandStoreStorytellerEvent>
  | ReturnType<typeof commandStartTestContainer>
  | ReturnType<typeof commandStopTestContainer>
>;

export enum CommandName {
  storeStorytellerEvent = "storeStorytellerEvent",
  startTestContainer = "startTestContainer",
  stopTestContainer = "stopTestContainer",
}
