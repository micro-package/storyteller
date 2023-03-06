export interface EventSubscriber<TFunctions extends { [key in string]: (event: any) => Promise<void> }> {
  subscriptions: { eventFunction: TFunctions[keyof TFunctions]; eventName: string }[];
  functions: TFunctions;
}

export const eventSubscriber = <TFunctions extends { [key in string]: (event: any) => Promise<void> }>(
  subscriptions: (functions: TFunctions) => { eventFunction: TFunctions[keyof TFunctions]; eventName: string }[],
  functions: TFunctions,
): EventSubscriber<TFunctions> => ({
  subscriptions: subscriptions(functions),
  functions,
});
