import type { eventValidator } from "../app/event";
import type { zod } from "./zod";

export interface EventSubscriber<
  TValidators extends typeof eventValidator,
  TEvents extends zod.infer<TValidators>,
  TFunctions extends {
    [key in string]: (event: TEvents) => Promise<void>;
  },
> {
  subscriptions: {
    eventFunction: {
      [key in keyof TFunctions]: (
        event: TEvents extends { eventName: infer UEventName } ? Extract<TEvents, UEventName> : never,
      ) => Promise<void>;
    }[keyof TFunctions];
    eventValidator: TValidators;
  }[];
  functions: TFunctions;
}

export const createEventSubscriber = <
  TValidators extends typeof eventValidator,
  TEvents extends zod.infer<TValidators>,
  TFunctions extends {
    [key in string]: (event: TEvents) => Promise<void>;
  },
>(
  subscriptions: (
    functions: TFunctions,
  ) => { eventFunction: TFunctions[keyof TFunctions]; eventValidator: TValidators }[],
  functions: TFunctions,
): EventSubscriber<TValidators, TEvents, TFunctions> => ({
  subscriptions: subscriptions(functions),
  functions,
});
