/* eslint-disable no-console */
import { compose, storytellerHelper, storytellerPlugin } from ".";
import { inspect } from "util";
import { createValueObject, forgeValueObject } from "../../container/value-object";

const testFramework = compose(
  createValueObject(),
  storytellerPlugin({}),
  forgeValueObject({ debug: false }),
  storytellerHelper,
);

describe("00", () => {
  it(
    "test0",
    testFramework.createScenario({
      arrange: testFramework.createStep({
        name: "stepArrange",
        handler: async (valueObject) => {
          expect(valueObject).toStrictEqual({
            storytellerScenario: expect.any(Function),
            storytellerStep: expect.any(Function),
          });
        },
      }),
      act: testFramework.createStep({
        name: "stepAct",
        handler: async (valueObject) => {
          expect(valueObject).toStrictEqual({
            storytellerScenario: expect.any(Function),
            storytellerStep: expect.any(Function),
          });
        },
      }),
      assert: testFramework.createStep({
        name: "stepAssert",
        handler: async (valueObject) => {
          expect(valueObject).toStrictEqual({
            storytellerScenario: expect.any(Function),
            storytellerStep: expect.any(Function),
          });
        },
      }),
    }),
  );
});
