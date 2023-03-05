import type { Status, ValueObject } from "./value-object";

export interface HookHandler<TPayload, TResult = Promise<void>> {
  (valueObject: ValueObject<Status.forged, any, any>): (payload: TPayload) => TResult;
}

export interface HookDefinition<THookName extends string, TPayload> {
  name: THookName;
  payload: TPayload;
}

export type Hook<THookDefinition extends HookDefinition<string, any>> = {
  name: THookDefinition["name"];
  handler: HookHandler<THookDefinition["payload"]>;
};

export enum PrimaryHookName {
  beforeHook = "beforeHook",
  afterHook = "afterHook",
}

export type PrimaryHookDefinition<THookDefinition extends HookDefinition<string, any>> =
  | HookDefinition<PrimaryHookName.beforeHook, THookDefinition>
  | HookDefinition<PrimaryHookName.afterHook, THookDefinition>;
