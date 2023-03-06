import type { eventValidator } from "../app/event";

export interface EventSubscriber<TFunctions extends { [key in string]: (event: any) => Promise<void> }> {
  subscriptions: { eventFunction: TFunctions[keyof TFunctions]; eventValidator: typeof eventValidator }[];
  functions: TFunctions;
}

export const eventSubscriber = <TFunctions extends { [key in string]: (event: any) => Promise<void> }>(
  subscriptions: (
    functions: TFunctions,
  ) => { eventFunction: TFunctions[keyof TFunctions]; eventValidator: typeof eventValidator }[],
  functions: TFunctions,
): EventSubscriber<TFunctions> => ({
  subscriptions: subscriptions(functions),
  functions,
});
