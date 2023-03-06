import { pipe } from "ts-pipe-compose";
import { falso } from "../common/falso";
import type { HookHandler } from "./hook";
import type { Plugin } from "./plugin";
import { createPlugin } from "./plugin";
import type { HookDefinition } from "./hook";
import type { Status } from "./value-object";
import type { ValueObject } from "./value-object";
import { createValueObject, forgeValueObject } from "./value-object";
import { expect } from "@jest/globals";
import { exactType } from "../common/exact-type";
enum TestHookName {
  testHook = "testHook",
  testHook1 = "testHook1",
}

enum PluginName {
  testPlugin = "testPlugin@1.0.0",
  testPlugin2 = "testPlugin2@1.0.0",
}
interface HandlerPayload {
  name: string;
}

type TestPlugin1Definition = HookDefinition<TestHookName.testHook, HandlerPayload>;
type TestPlugin2Definition = HookDefinition<TestHookName.testHook1, HandlerPayload>;

interface Plugin1State {
  names: string[];
}
interface Plugin2State {
  filenames: string[];
}

interface DatasetOne {
  pluginState: Plugin1State;
  handler: HookHandler<HandlerPayload>;
  plugin: Plugin<PluginName.testPlugin, Plugin1State, {}, TestPlugin1Definition>;
}

interface DatasetTwo {
  plugin1State: Plugin1State;
  plugin2State: Plugin2State;
  handler1: HookHandler<HandlerPayload>;
  handler2: HookHandler<HandlerPayload>;
  plugin1: Plugin<PluginName.testPlugin, Plugin1State, {}, TestPlugin1Definition>;
  plugin2: Plugin<PluginName.testPlugin2, Plugin2State, {}, TestPlugin2Definition>;
}

const prepareOne = ({
  pluginState = { names: [falso.randFullName()] },
  handler = () => async () => {},
  plugin = {
    state: pluginState,
    actions: {},
    name: PluginName.testPlugin,
    hooks: Array.from<any>({ length: 1 }).fill({ name: TestHookName.testHook, handler }),
  },
}: Partial<DatasetOne>) => {
  const dataset: DatasetOne = { pluginState, plugin, handler };

  return {
    dataset,
    execute: () => pipe(createValueObject(), createPlugin(dataset.plugin), forgeValueObject({ debug: false })),
  };
};
const prepareTwo = ({
  plugin1State = { names: [falso.randFullName()] },
  plugin2State = { filenames: [falso.randFileName()] },
  handler1 = () => async () => {},
  handler2 = () => async () => {},
  plugin1 = {
    state: plugin1State,
    actions: {},
    name: PluginName.testPlugin,
    hooks: Array.from<any>({ length: 1 }).fill({ name: TestHookName.testHook, handler: handler1 }),
  },
  plugin2 = {
    state: plugin2State,
    actions: {},
    name: PluginName.testPlugin2,
    hooks: Array.from<any>({ length: 1 }).fill({ name: TestHookName.testHook1, handler: handler2 }),
  },
}: Partial<DatasetTwo>) => {
  const dataset: DatasetTwo = { plugin1State, plugin1, plugin2State, plugin2, handler1, handler2 };
  return {
    dataset,
    execute: () =>
      pipe(
        createValueObject(),
        createPlugin(dataset.plugin1),
        createPlugin(dataset.plugin2),
        forgeValueObject({ debug: false }),
      ),
  };
};

declare const plugin1State: Plugin1State;

describe("value object", () => {
  it.skip("<type test>value object: exists", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    exactType(valueObject.plugins[0].state, plugin1State);
  });

  it("value object: plugin hook mutates state", async () => {
    const handlerPayload: HandlerPayload = { name: falso.randFullName() };
    const test = prepareOne({
      handler: (valueObject) => async (payload) => {
        valueObject.plugins[0].state.names.push(payload.name);
      },
    });

    const valueObject = test.execute();
    await valueObject.runHooks({ name: TestHookName.testHook, payload: handlerPayload });

    expect(valueObject.plugins[0].state).toStrictEqual({
      names: [...test.dataset.pluginState.names, handlerPayload.name],
    });
  });
  it("value object: getPlugin provides correct state", async () => {
    const handlerPayload: HandlerPayload = { name: falso.randFullName() };
    const test = prepareTwo({
      handler1: (valueObject) => async (payload) => {
        valueObject.plugins[0].state.names.push(payload.name);
      },
      handler2: (valueObject) => async (payload) => {
        valueObject.plugins[1].state.filenames.push(payload.name);
      },
    });

    const valueObject = test.execute();
    await valueObject.runHooks({ name: TestHookName.testHook, payload: handlerPayload });
    await valueObject.runHooks({ name: TestHookName.testHook1, payload: handlerPayload });

    expect("names" in valueObject.plugins[0].state).toStrictEqual(true);
    expect("filenames" in valueObject.plugins[0].state).toStrictEqual(false);
    expect("names" in valueObject.plugins[1].state).toStrictEqual(false);
    expect("filenames" in valueObject.plugins[1].state).toStrictEqual(true);
    expect(valueObject.getPlugin(PluginName.testPlugin).state).toStrictEqual({
      names: [...test.dataset.plugin1State.names, handlerPayload.name],
    });
    expect(valueObject.getPlugin(PluginName.testPlugin2).state).toStrictEqual({
      filenames: [...test.dataset.plugin2State.filenames, handlerPayload.name],
    });
  });
  it("value object: plugin may modify other plugin state", async () => {
    const handlerPayload: HandlerPayload = { name: falso.randFullName() };
    const test = prepareTwo({
      handler1:
        (
          valueObject: ValueObject<
            Status.forged,
            TestPlugin1Definition,
            Plugin<PluginName.testPlugin, Plugin1State, {}, TestPlugin1Definition>
          >,
        ) =>
        async (payload) => {
          const plugin1 = valueObject.getPlugin(PluginName.testPlugin);
          plugin1.state.names.push(payload.name);
        },
    });
    const valueObject = test.execute();
    await valueObject.runHooks({ name: TestHookName.testHook, payload: handlerPayload });
    expect(valueObject.getPlugin(PluginName.testPlugin).state).toStrictEqual({
      names: [...test.dataset.plugin1State.names, handlerPayload.name],
    });
    expect(valueObject.getPlugin(PluginName.testPlugin2).state).toStrictEqual({
      filenames: [...test.dataset.plugin2State.filenames],
    });
  });
});
