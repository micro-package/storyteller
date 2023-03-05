import { pipe } from "ts-pipe-compose";
import type { Plugin, PluginAction } from "./plugin";
import { createPlugin } from "./plugin";
import type { HookHandler, HookDefinition } from "./hook";
import type { Status, ValueObject } from "./value-object";
import { createValueObject, forgeValueObject } from "./value-object";
import { expect } from "@jest/globals";
import { falso } from "../common/falso";
enum TestHookName {
  testHook = "testHook",
  testHook1 = "testHook1",
}

enum PluginName {
  testPlugin = "testPlugin@1.0.0",
  testPlugin2 = "testPlugin2@1.0.0",
}

type TestPluginHookDefinition = HookDefinition<TestHookName.testHook, { ab1: string }>;

type TestPluginHookDefinition2 = HookDefinition<TestHookName.testHook1, { ab2: string }>;

interface HandlerPayload {
  name: string;
}

type TestPlugin1Definition = HookDefinition<TestHookName.testHook, HandlerPayload>;

interface Plugin1State {
  names: string[];
}
interface Actions extends PluginAction<any, any, any> {
  testPluginAction1: (name: string) => Promise<string[]>;
}

type Plugin1 = Plugin<PluginName.testPlugin, Plugin1State, Actions, TestPlugin1Definition>;

interface DatasetOne {
  pluginState: Plugin1State;
  handler: HookHandler<HandlerPayload>;
  testPluginAction1Forger: (
    valueObject: ValueObject<Status.forged, TestPlugin1Definition, Plugin1>,
  ) => Actions["testPluginAction1"];
  testPluginAction1: Actions["testPluginAction1"];
  plugin: Plugin1;
}

const prepareOne = ({
  pluginState = { names: [falso.randFullName()] },
  handler = () => async () => {},
  testPluginAction1 = async (name) => [name],
  testPluginAction1Forger = jest.fn((valueObject) => (name: string) => {
    valueObject.getPlugin(PluginName.testPlugin).state.names.push(name);
    return testPluginAction1(name);
  }),
  plugin = {
    state: pluginState,
    name: PluginName.testPlugin,
    actions: { testPluginAction1: testPluginAction1Forger },
    hooks: Array.from<any>({ length: 1 }).fill({ name: TestHookName.testHook, handler }),
  },
}: Partial<DatasetOne>) => {
  const dataset: DatasetOne = { pluginState, plugin, handler, testPluginAction1, testPluginAction1Forger };

  return {
    dataset,
    execute: () => pipe(createValueObject(), createPlugin(dataset.plugin), forgeValueObject({ debug: false })),
  };
};

interface DatasetTwo {
  hookHandler: jest.Mock<any>;
  hookForger: jest.Mock<any>;
  plugin1HookLength: number;
  plugin1: Plugin<PluginName.testPlugin, { a: 1 }, {}, TestPluginHookDefinition>;
  plugin2HookLength: number;
  plugin2HookName: string;
  plugin2: Plugin<PluginName.testPlugin2, { b: 2 }, {}, TestPluginHookDefinition2>;
}

const prepareTwo = ({
  hookHandler = jest.fn(async () => {}),
  hookForger = jest.fn(() => hookHandler),
  plugin1HookLength = 1,
  plugin1 = {
    state: { a: 1 },
    actions: {},
    name: PluginName.testPlugin,
    hooks: Array.from<any>({ length: plugin1HookLength }).fill({
      name: TestHookName.testHook,
      handler: hookForger,
    }),
  },
  plugin2HookLength = 1,
  plugin2HookName = TestHookName.testHook,
  plugin2 = {
    state: { b: 2 },
    actions: {},
    name: PluginName.testPlugin2,
    hooks: Array.from<any>({ length: plugin2HookLength }).fill({
      name: plugin2HookName,
      handler: hookForger,
    }),
  },
}: Partial<DatasetTwo>) => {
  const dataset = {
    hookHandler,
    hookForger,
    plugin1HookLength,
    plugin1,
    plugin2HookLength,
    plugin2HookName,
    plugin2,
  };
  return {
    dataset,
    execute: () =>
      pipe(createValueObject(), createPlugin(plugin1), createPlugin(plugin2), forgeValueObject({ debug: false })),
  };
};
describe("plugin", () => {
  it("plugin: exists", () => {
    const test = prepareTwo({});

    const valueObject = test.execute();

    expect("plugins" in valueObject).toStrictEqual(true);
  });
  it("plugin: handler, 2 plugin, getPlugin", () => {
    const test = prepareTwo({});

    const valueObject = test.execute();

    const plugin1 = valueObject.getPlugin(PluginName.testPlugin);

    expect(plugin1).toStrictEqual({
      name: test.dataset.plugin1.name,
      actions: {},
      hooks: [{ handler: test.dataset.hookForger, name: test.dataset.plugin1.hooks[0].name }],
      state: test.dataset.plugin1.state,
    });
  });
  it("plugin: handler, 2 plugin, 2 getPlugin", () => {
    const test = prepareTwo({});

    const valueObject = test.execute();

    expect(valueObject.getPlugin(PluginName.testPlugin)).toStrictEqual({
      name: test.dataset.plugin1.name,
      actions: {},
      hooks: [{ handler: test.dataset.hookForger, name: test.dataset.plugin1.hooks[0].name }],
      state: test.dataset.plugin1.state,
    });
    expect(valueObject.getPlugin(PluginName.testPlugin2)).toStrictEqual({
      name: test.dataset.plugin2.name,
      actions: {},
      hooks: [{ handler: test.dataset.hookForger, name: test.dataset.plugin2.hooks[0].name }],
      state: test.dataset.plugin2.state,
    });
  });
  it("plugin: handler, 2 plugin, plugin not found", async () => {
    const test = prepareTwo({});

    const valueObject = test.execute();

    await expect(async () => valueObject.getPlugin("asd" as PluginName)).rejects.toBeInstanceOf(Error);
  });
  it("plugin: action, exists", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    expect("actions" in valueObject.plugins[0]).toStrictEqual(true);
  });
  it("plugin: action, exists", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    expect(valueObject.plugins[0].actions).toStrictEqual({ testPluginAction1: test.dataset.testPluginAction1Forger });
  });
  it("plugin: action, exists", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    const plugin = valueObject.getPlugin(PluginName.testPlugin);

    expect(plugin.actions.testPluginAction1).toStrictEqual(test.dataset.testPluginAction1Forger);
  });
  it("plugin: action, exists in value object", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    expect("actions" in valueObject).toStrictEqual(true);
  });
  it("plugin: action, is null if valueObject is not forged", () => {
    const valueObject = createValueObject();

    expect(valueObject.actions).toStrictEqual(null);
  });
  it("plugin: action, is an object if forged valueObject", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    expect(valueObject.actions).not.toStrictEqual(null);
    expect(valueObject.actions).toBeInstanceOf(Object);
  });
  it("plugin: action, has provided action handler", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    expect("testPluginAction1" in valueObject.actions).toStrictEqual(true);
  });
  it("plugin: action, action handler is correct handler", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    expect(valueObject.actions).toStrictEqual(expect.objectContaining({ testPluginAction1: expect.any(Function) }));
  });
  it("plugin: action, action handler modifies state of plugin", async () => {
    const test = prepareOne({});
    const payload = falso.randFullName();

    const valueObject = test.execute();
    await valueObject.actions.testPluginAction1(payload);

    expect(valueObject.getPlugin(PluginName.testPlugin).state).toStrictEqual({
      names: [...test.dataset.pluginState.names, payload],
    });
  });
});
