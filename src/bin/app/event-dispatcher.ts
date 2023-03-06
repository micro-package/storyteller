import { logger } from "../shared/logger";
import type { EventSubscriber } from "./event-subscriber";

export interface Event<T extends any> {
  eventName: string;
  eventPayload: T;
}

export interface EventDispatcher {
  dispatch: (event: Event<any>) => Promise<void>;
}

export const createEventDispatcher = (config: { subscribers: EventSubscriber<any>[] }): EventDispatcher => ({
  dispatch: async (event) => {
    await Promise.allSettled(
      config.subscribers
        .filter((subscriber) =>
          subscriber.subscriptions.find((subscription) => subscription.eventName === event.eventName),
        )
        .map((subscriber) =>
          subscriber.subscriptions.map(async (subscription) => {
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
