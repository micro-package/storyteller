import { createCommand } from "../../shared/command-bus";
import { zod } from "../../shared/zod";
import { CommandName } from "../command";

export const commandStoreStorytellerEvent = () =>
  createCommand({
    commandValidator: zod.object({
      commandName: zod.literal(CommandName.storeStorytellerEvent),
      commandPayload: zod.object({
        eventName: zod.string(),
        eventData: zod.object({}),
      }),
    }),
    commandHandler: async (command) => {},
  });
