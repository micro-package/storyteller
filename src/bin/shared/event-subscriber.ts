import type { eventValidator } from "../app/event";
import type { zod } from "./zod";

export interface EventSubscriber<
  TValidators extends typeof eventValidator,
  TFunctions extends {
    [key in string]: (event: zod.infer<TValidators>) => Promise<void>;
  },
> {
  subscriptions: { eventFunction: TFunctions[keyof TFunctions]; eventValidator: TValidators }[];
  functions: TFunctions;
}

export const createEventSubscriber = <
  TValidators extends typeof eventValidator,
  TFunctions extends {
    [key in string]: (event: zod.infer<TValidators>) => Promise<void>;
  },
>(
  subscriptions: (
    functions: TFunctions,
  ) => { eventFunction: TFunctions[keyof TFunctions]; eventValidator: TValidators }[],
  functions: TFunctions,
): EventSubscriber<TValidators, TFunctions> => ({
  subscriptions: subscriptions(functions),
  functions,
});
