import { falso } from "../falso";
import { buildReplacementString, getCircularReplacer, getSecureReplacer, js2SecureJson } from "./secure-json";
import { expect } from "@jest/globals";
interface Dataset {
  fieldKey: string;
  fieldValue: any;
  object: any;
  seen: WeakSet<object>;
  reason: "SECURE";
  securedKeys: string[];
}

const prepare = ({
  fieldKey = falso.randProductName(),
  fieldValue = falso.randProductName(),
  object = { [fieldKey]: fieldValue },
  seen = new WeakSet(),
  securedKeys = [fieldKey],
}: Partial<Omit<Dataset, "reason">>) => {
  const dataset: Dataset = {
    seen,
    fieldKey,
    fieldValue,
    object,
    reason: "SECURE",
    securedKeys,
  };
  const dependencies = {
    secureReplacer: jest.fn(getSecureReplacer(dataset.securedKeys)),
    circularReplacer: jest.fn(getCircularReplacer(dataset.seen)),
  };
  const executeSecureJsonStringify = () =>
    js2SecureJson(dependencies.secureReplacer, dependencies.circularReplacer)(object);
  const executeBuildReplacementString = () =>
    buildReplacementString(dataset.reason, dataset.fieldKey, dataset.fieldValue);
  const executeSecureReplacer = () => dependencies.secureReplacer(dataset.fieldKey, dataset.fieldValue);
  const executeCircularReplacer = () => dependencies.circularReplacer(dataset.fieldKey, dataset.fieldValue);
  return {
    dependencies,
    dataset,
    executeSecureJsonStringify,
    executeBuildReplacementString,
    executeSecureReplacer,
    executeCircularReplacer,
  };
};

describe("parser/secure-json", () => {
  it("build-replacement-string", () => {
    const test = prepare({});

    const result = test.executeBuildReplacementString();

    expect(result).toStrictEqual(
      `_${test.dataset.reason}_<${typeof test.dataset.fieldValue}>${test.dataset.fieldKey}_`,
    );
  });

  it("secure-replacer", () => {
    const test = prepare({});

    const result = test.executeSecureReplacer();

    expect(result).toStrictEqual(buildReplacementString("SECURE", test.dataset.fieldKey, test.dataset.fieldValue));
  });

  it("secure-replacer without replacement", () => {
    const test = prepare({ securedKeys: [] });

    const result = test.executeSecureReplacer();

    expect(result).toStrictEqual(test.dataset.fieldValue);
  });

  it("get-circular-replacer", () => {
    const test = prepare({ seen: { has: jest.fn(), add: jest.fn() } as any, fieldValue: {} });

    const result = test.executeCircularReplacer();

    expect(test.dataset.seen.has).toBeCalledTimes(1);
    expect(test.dataset.seen.add).toBeCalledTimes(1);
    expect(result).toStrictEqual(test.dataset.fieldValue);
  });

  it("get-circular-replacer not object", () => {
    const test = prepare({ seen: { has: jest.fn(() => false), add: jest.fn() } as any });

    const result = test.executeCircularReplacer();

    expect(test.dataset.seen.has).toBeCalledTimes(0);
    expect(test.dataset.seen.add).toBeCalledTimes(0);
    expect(result).toStrictEqual(test.dataset.fieldValue);
  });

  it("get-circular-replacer already seen", () => {
    const test = prepare({ seen: { has: jest.fn(() => true), add: jest.fn() } as any, fieldValue: {} });

    const result = test.executeCircularReplacer();

    expect(test.dataset.seen.has).toBeCalledTimes(1);
    expect(test.dataset.seen.add).toBeCalledTimes(0);
    expect(result).toStrictEqual(buildReplacementString("CIRCULAR", test.dataset.fieldKey, test.dataset.fieldValue));
  });

  it("secure-json-stringify", () => {
    const test = prepare({});

    test.executeSecureJsonStringify();

    expect(test.dependencies.secureReplacer).toBeCalledTimes(Object.keys(test.dataset.object).length + 1);
  });

  it("secure-json-stringify circular dependency", () => {
    const circular: any = {};
    circular.next = circular;
    const test = prepare({ object: circular });

    test.executeSecureJsonStringify();

    expect(test.dependencies.secureReplacer).toBeCalledTimes(Object.keys(test.dataset.object).length * 2 + 2);
    expect(test.dependencies.circularReplacer).toBeCalledTimes(Object.keys(test.dataset.object).length + 1);
  });
});
