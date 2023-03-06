import { createEventSubscriber } from "../../shared/event-subscriber";
import type { zod } from "../../shared/zod";
import type { CommandBus } from "../command";
import { CommandName } from "../command";
import { eventValidatorTestStartRequested } from "../events/test-start-requested.event";

export const eventSubscriberCLI = (commandBus: CommandBus) =>
  createEventSubscriber(
    (functions) => [{ eventValidator: eventValidatorTestStartRequested, eventFunction: functions.startTests }],
    {
      startTests: async (event: zod.infer<typeof eventValidatorTestStartRequested>) => {
        await commandBus.execute({
          commandName: CommandName.startTestContainer,
          commandPayload: {
            testNames: event.eventPayload.testNames,
          },
        });
      },
    },
  );
