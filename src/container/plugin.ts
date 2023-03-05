import type { UnionToIntersection } from "../common/types";
import type { Hook, HookDefinition } from "./hook";
import type { Status } from "./value-object";
import type { ValueObject } from "./value-object";

export type PluginAction<TActionName extends string, TPayload extends any, TResult extends any> = {
  [key in TActionName]: (payload: TPayload) => TResult;
};

export type PluginName = string; //`${string}@${number}.${number}.${number}`;

export interface Plugin<
  TPluginName extends PluginName,
  TState extends any,
  TAction extends PluginAction<string, any, any>,
  THookDefinition extends HookDefinition<string, any>,
> {
  requiredPlugins?: string[];
  state: TState;
  name: TPluginName;
  actions: UnionToIntersection<{
    [key in keyof TAction]: (valueObject: ValueObject<Status.forged, any, any>) => TAction[key];
  }>;
  hooks: (THookDefinition extends infer UHookDefinition extends HookDefinition<string, any>
    ? Hook<UHookDefinition>
    : never)[];
}

export type CreatePlugin = <
  TPluginName extends PluginName,
  TAction extends PluginAction<string, any, any>,
  THookDefinition extends HookDefinition<string, any>,
  TPlugin extends Plugin<TPluginName, any, TAction, THookDefinition>,
>(
  plugin: TPlugin,
) => <
  TPrevTPluginName extends PluginName,
  TPrevAction extends PluginAction<string, any, any>,
  TPrevHookDefinition extends HookDefinition<string, any>,
  TPrevPlugin extends Plugin<TPrevTPluginName, any, TPrevAction, TPrevHookDefinition>,
>(
  valueObject: ValueObject<Status.created, TPrevHookDefinition, TPrevPlugin>,
) => ValueObject<Status.created, THookDefinition | TPrevHookDefinition, TPrevPlugin | TPlugin>;

export const createPlugin: CreatePlugin = (plugin) => (valueObject) => ({
  actions: null,
  getPlugin: valueObject.getPlugin,
  plugins: [...valueObject.plugins, plugin],
  runHooks: valueObject.runHooks,
});
