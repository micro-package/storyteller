import { inspect } from "util";
import { logger } from "../shared/logger";
import type { zod } from "../shared/zod";
import type { EventSubscriber } from "./event-subscriber";
import type { eventValidator } from "../app/event";

export interface EventDispatcher {
  dispatch: (event: zod.infer<typeof eventValidator>) => Promise<void>;
}

export const createEventDispatcher = (config: { subscribers: EventSubscriber<any>[] }): EventDispatcher => ({
  dispatch: async (event) => {
    await Promise.allSettled(
      config.subscribers
        .filter((subscriber) =>
          subscriber.subscriptions.find(
            (subscription) => subscription.eventValidator.shape.eventName._def.value === event.eventName,
          ),
        )
        .map((subscriber) =>
          subscriber.subscriptions.map(async (subscription) => {
            const eventValidationResult = subscription.eventValidator.safeParse(event);
            if (eventValidationResult.success === false) {
              logger.debug(
                "CLI server",
                `received event is not valid [${event.eventName}] for function [${
                  subscription.eventFunction.name
                }] - ${inspect(event)}`,
              );
              return;
            }
            try {
              logger.debug(
                "CLI server",
                `dispatching event [${event.eventName}] to function [${subscription.eventFunction.name}] starts`,
              );
              await subscription.eventFunction();
              logger.debug(
                "CLI server",
                `dispatching event [${event.eventName}] to function [${subscription.eventFunction.name}] succeed`,
              );
            } catch (error) {
              logger.debug(
                "CLI server",
                `dispatching event [${event.eventName}] to function [${
                  subscription.eventFunction.name
                }] errored -> ${error.toString()}`,
              );
            }
          }),
        )
        .flat(),
    );
  },
});
