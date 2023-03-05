/* eslint-disable no-console */
import { pipe } from "ts-pipe-compose";
import { storytellerHelper, storytellerPlugin } from ".";
import { createValueObject, forgeValueObject } from "../../container/value-object";

const testFramework = pipe(
  createValueObject(),
  storytellerPlugin({}),
  forgeValueObject({ debug: false }),
  storytellerHelper,
);

describe("00", () => {
  it(
    "test0",
    testFramework.createStory({
      arrange: testFramework.createStep({
        name: "stepArrange",
        handler: async (valueObject) => {
          expect(valueObject).toStrictEqual({
            storytellerCreateStory: expect.any(Function),
            storytellerCreateStep: expect.any(Function),
          });
        },
      }),
      act: testFramework.createStep({
        name: "stepAct",
        handler: async (valueObject) => {
          expect(valueObject).toStrictEqual({
            storytellerCreateStory: expect.any(Function),
            storytellerCreateStep: expect.any(Function),
          });
        },
      }),
      assert: testFramework.createStep({
        name: "stepAssert",
        handler: async (valueObject) => {
          expect(valueObject).toStrictEqual({
            storytellerCreateStory: expect.any(Function),
            storytellerCreateStep: expect.any(Function),
          });
        },
      }),
    }),
  );
});
