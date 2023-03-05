import { errorValueObject } from "../common/error";
import type { UnionToIntersection } from "../common/types";
import type { Plugin, PluginAction, PluginName } from "./plugin"; //! Figure out why vs-code sees this as unused
import type { HookDefinition, PrimaryHookDefinition } from "./hook";
import { PrimaryHookName as PrimaryHookName } from "./hook";
import { cloneDeep } from "lodash";
import { applyProxies } from "../common/proxy/common";
import { errorDecoratorProxyHandler } from "../common/proxy/error-decorator";
import { loggerProxyHandler } from "../common/proxy/logger";
import { LoggingLevel } from "../common/enum";
import { winstonLogger } from "../common/logger";

export enum Status {
  created = "created",
  forged = "forged",
}

export interface ValueObject<
  TStatus extends Status,
  THookDefinition extends HookDefinition<string, any>,
  TPlugin extends Plugin<PluginName, any, any, THookDefinition>,
> {
  plugins: TPlugin[];
  actions: TStatus extends Status.created
    ? null
    : {
        [key in keyof UnionToIntersection<TPlugin["actions"]>]: ReturnType<
          //! I don't know why this ternary must exists. This seemed to work with vscode however typescript was failing when building declaration files (with the same typescript version on both compilers). This `(...args: any) => any ? UPluginAction : never` instead of `UPluginAction` looks like needs to be here but I don't know why, I figured this solution out looking at typescript errors.
          UnionToIntersection<TPlugin["actions"]>[key] extends infer UPluginAction extends (...args: any) => any
            ? UPluginAction
            : never
        >;
      };
  getPlugin: TStatus extends Status.created
    ? (valueObject: ValueObject<Status.forged, THookDefinition, TPlugin>) => GetPlugin<TPlugin>
    : GetPlugin<TPlugin>;
  runHooks: TStatus extends Status.created
    ? (
        valueObject: ValueObject<Status.forged, THookDefinition, Plugin<PluginName, any, any, THookDefinition>>,
      ) => RunHooks<THookDefinition>
    : RunHooks<THookDefinition>;
}

export interface RunHooks<THookDefinition extends HookDefinition<string, any>> {
  (
    payload: THookDefinition extends infer UHookDefinition extends THookDefinition
      ? keyof UHookDefinition["payload"] extends never
        ? Omit<UHookDefinition, "payload">
        : UHookDefinition
      : never,
  ): Promise<void>;
}

export type GetPlugin<TPlugin extends Plugin<PluginName, string, any, any>> = <TPluginName extends TPlugin["name"]>(
  pluginName: TPluginName,
) => Extract<TPlugin, { name: TPluginName }> extends infer UPlugin extends Plugin<any, any, any, any> ? UPlugin : never;

export const createValueObject = (): ValueObject<
  Status.created,
  PrimaryHookDefinition<HookDefinition<string, any>>,
  never
> => ({
  actions: null,
  getPlugin: (valueObject) => (name) => {
    //@ts-ignore
    const plugin = valueObject.plugins.find((ext) => ext.name === name);
    if (plugin === undefined) {
      throw errorValueObject("missing plugin", { name });
    }
    return plugin;
  },
  plugins: [],
  runHooks:
    (valueObject) =>
    async ({ name, payload }) => {
      for await (const plugin of valueObject.plugins) {
        for await (const hook of plugin.hooks) {
          if (hook.name === PrimaryHookName.beforeHook) {
            await hook.handler(valueObject)({ payload, name });
          }
        }
      }
      for await (const plugin of valueObject.plugins) {
        for await (const hook of plugin.hooks) {
          if (hook.name === name) {
            await hook.handler(valueObject)(payload);
          }
        }
      }
      for await (const plugin of valueObject.plugins) {
        for await (const hook of plugin.hooks) {
          if (hook.name === PrimaryHookName.afterHook) {
            await hook.handler(valueObject)({ payload, name });
          }
        }
      }
    },
});

export const forgeValueObject = (config: { debug: boolean }) => {
  winstonLogger.level = config.debug === true ? LoggingLevel.debug : LoggingLevel.plugin;
  return <
    TPluginName extends PluginName,
    TAction extends PluginAction<string, any, any>,
    THookDefinition extends HookDefinition<string, any>,
    TPlugin extends Plugin<TPluginName, any, TAction, THookDefinition>,
  >(
    prevValueObject: ValueObject<Status.created, THookDefinition, TPlugin>,
  ): ValueObject<Status.forged, THookDefinition, TPlugin> => {
    const nextValueObject = {
      actions: {} as any,
      plugins: [],
      getPlugin: undefined as any,
      runHooks: undefined as any,
    } as ValueObject<Status.forged, THookDefinition, TPlugin>;
    nextValueObject.runHooks = prevValueObject.runHooks(nextValueObject);
    nextValueObject.getPlugin = prevValueObject.getPlugin(nextValueObject);
    for (const [index, plugin] of prevValueObject.plugins.entries()) {
      const pluginName = plugin.name.split("@")[0];
      if (plugin.requiredPlugins !== undefined) {
        const missingPlugins = plugin.requiredPlugins.filter(
          (requiredPlugin) => prevValueObject.plugins.find(({ name }) => name === requiredPlugin) === undefined,
        );
        if (missingPlugins.length > 0) {
          throw errorValueObject("missing plugin", { plugin, missingPlugins });
        }
      }
      if (plugin.actions instanceof Object) {
        const wrongActionNames = Object.keys(plugin.actions).filter((actionName) => !actionName.startsWith(pluginName));
        if (wrongActionNames.length > 0) {
          throw errorValueObject("action name must starts with plugin name", { wrongActionNames, pluginName });
        }
      }
      nextValueObject.plugins[index] = cloneDeep({
        state: plugin.state,
        name: plugin.name,
        hooks: plugin.hooks,
        actions: plugin.actions,
      } as TPlugin);
      for (const [actionName, action] of Object.entries(plugin.actions as PluginAction<string, any, any>)) {
        Object.assign(
          nextValueObject.actions,
          applyProxies({ [actionName]: action(nextValueObject) }, [
            errorDecoratorProxyHandler({ dependencyName: `plugin-${pluginName}` }),
            loggerProxyHandler({
              dependencyName: `plugin-${pluginName}`,
              loggerLevel: LoggingLevel.debug,
            }),
          ]),
        );
      }
    }
    Object.assign(
      nextValueObject,
      applyProxies({ runHooks: nextValueObject.runHooks, getPlugin: nextValueObject.getPlugin }, [
        errorDecoratorProxyHandler({ dependencyName: "valueObject" }),
        loggerProxyHandler({
          dependencyName: "valueObject",
          loggerLevel: LoggingLevel.debug,
        }),
      ]),
    );
    return nextValueObject;
  };
};
