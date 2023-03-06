import { createEventSubscriber } from "../../shared/event-subscriber";
import type { zod } from "../../shared/zod";
import type { CommandBus } from "../command";
import { CommandName } from "../command";
import { eventValidatorStorytellerStarted } from "../events/storyteller-started.event";

export const eventSubscriberStorage = (commandBus: CommandBus) =>
  createEventSubscriber(
    (functions) => [{ eventValidator: eventValidatorStorytellerStarted, eventFunction: functions.logStarted }],
    {
      logStarted: async (event: zod.infer<typeof eventValidatorStorytellerStarted>) => {
        await commandBus.execute({
          commandName: CommandName.storeStorytellerEvent,
          commandPayload: {
            eventName: event.eventName,
            eventData: event.eventPayload,
          },
        });
      },
    },
  );
