/* eslint-disable no-console */
import { pipe } from "ts-pipe-compose";
import type { Plugin } from "./plugin";
import { createPlugin } from "./plugin";
import type { HookDefinition } from "./hook";
import { createValueObject, forgeValueObject } from "./value-object";
import assert from "static-type-assert";
import type { HookHandler } from "./hook";
import { expect } from "@jest/globals";
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
interface DatasetOne {
  hookHandler: jest.Mock<any>;
  hookForger: jest.Mock<any>;
  pluginHookLength: number;
  plugin: Plugin<PluginName.testPlugin, {}, {}, TestPluginHookDefinition>;
}

interface DatasetTwo {
  hookHandler: jest.Mock<any>;
  hookForger: jest.Mock<any>;
  plugin1HookLength: number;
  plugin1: Plugin<PluginName.testPlugin, {}, {}, TestPluginHookDefinition>;
  plugin2HookLength: number;
  plugin2HookName: string;
  plugin2: Plugin<PluginName.testPlugin2, {}, {}, TestPluginHookDefinition2>;
}

const prepareOne = ({
  hookHandler = jest.fn(async () => {}),
  hookForger = jest.fn(() => hookHandler),
  pluginHookLength = 1,
  plugin = {
    state: {},
    actions: {},
    name: PluginName.testPlugin,
    hooks: Array.from<any>({ length: pluginHookLength }).fill({
      name: TestHookName.testHook,
      handler: hookForger,
    }),
  },
}: Partial<DatasetOne>) => {
  const dataset = {
    hookHandler,
    hookForger,
    pluginHookLength,
    plugin,
  };

  return {
    dataset,
    execute: () => pipe(createValueObject(), createPlugin(dataset.plugin), forgeValueObject({ debug: false })),
  };
};

const prepareTwo = ({
  hookHandler = jest.fn(async () => {}),
  hookForger = jest.fn(() => hookHandler),
  plugin1HookLength = 1,
  plugin1 = {
    state: {},
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
    state: {},
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

describe("hook", () => {
  it("hook: handler exists", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    expect("handler" in valueObject.plugins[0].hooks[0]).toStrictEqual(true);
  });
  it("hook: handler, 1 plugin, payload", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    assert<HookHandler<TestPluginHookDefinition["payload"]>>(valueObject.plugins[0].hooks[0].handler);
  });
  it("hook: handler, 1 plugin, name", () => {
    const test = prepareOne({});

    const valueObject = test.execute();

    assert<TestPluginHookDefinition["name"]>(valueObject.plugins[0].hooks[0].name);
  });
  it("hook: handler, 2 plugin, payload & name", () => {
    const test = prepareTwo({ plugin2HookName: TestHookName.testHook1 });

    const valueObject = test.execute();

    valueObject.plugins.forEach((plugin) =>
      plugin.hooks.forEach((hook) => {
        if (hook.name === TestHookName.testHook) {
          assert<HookHandler<TestPluginHookDefinition["payload"]>>(hook.handler);
        }
        if (hook.name === TestHookName.testHook1) {
          assert<HookHandler<TestPluginHookDefinition2["payload"]>>(hook.handler);
        }
      }),
    );
  });
  it("hook: handler, 2 plugin, payload & name", () => {
    const test = prepareTwo({ plugin2HookName: TestHookName.testHook1 });

    const valueObject = test.execute();

    valueObject.plugins.forEach((plugin) =>
      plugin.hooks.forEach((hook) => {
        if (hook.name === TestHookName.testHook) {
          assert<HookHandler<TestPluginHookDefinition["payload"]>>(hook.handler);
        }
        if (hook.name === TestHookName.testHook1) {
          assert<HookHandler<TestPluginHookDefinition2["payload"]>>(hook.handler);
        }
      }),
    );
  });
  it("hook: runHooks", async () => {
    const test = prepareTwo({
      plugin1HookLength: 2,
      plugin2HookLength: 2,
      plugin2HookName: TestHookName.testHook1,
    });

    const valueObject = test.execute();

    assert<(payload: TestPluginHookDefinition | TestPluginHookDefinition2) => Promise<void>>(valueObject.runHooks);
  });
  it("hook: runHooks, 2 plugins 4 hooks, run 4", async () => {
    const payload1 = { ab1: "abc " };
    const payload2 = { ab2: "xyz " };
    const test = prepareTwo({
      plugin1HookLength: 2,
      plugin2HookLength: 2,
      plugin2HookName: TestHookName.testHook1,
    });

    const valueObject = test.execute();
    await valueObject.runHooks({ name: TestHookName.testHook, payload: payload1 });
    await valueObject.runHooks({ name: TestHookName.testHook1, payload: payload2 });

    expect(test.dataset.hookHandler).toBeCalledTimes(4);
    expect(test.dataset.hookHandler).toHaveBeenNthCalledWith(1, payload1);
    expect(test.dataset.hookHandler).toHaveBeenNthCalledWith(2, payload1);
    expect(test.dataset.hookHandler).toHaveBeenNthCalledWith(3, payload2);
    expect(test.dataset.hookHandler).toHaveBeenNthCalledWith(4, payload2);
    expect(test.dataset.hookForger).toBeCalledTimes(4);
    expect(test.dataset.hookForger).toHaveBeenNthCalledWith(1, valueObject);
    expect(test.dataset.hookForger).toHaveBeenNthCalledWith(2, valueObject);
    expect(test.dataset.hookForger).toHaveBeenNthCalledWith(3, valueObject);
    expect(test.dataset.hookForger).toHaveBeenNthCalledWith(4, valueObject);
  });
});
