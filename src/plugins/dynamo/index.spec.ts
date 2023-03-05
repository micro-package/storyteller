import { dynamoPlugin } from ".";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { expect } from "@jest/globals";
import { createValueObject, forgeValueObject } from "../../container/value-object";
import { falso } from "../../common/falso";
import { storytellerPlugin, compose, storytellerHelper } from "../storyteller";
import { CreateTableCommand } from "@aws-sdk/client-dynamodb";

enum StepName {
  stepArrange = "stepArrange",
  stepAct = "stepAct",
  stepAssert = "stepAssert",
}

const testFramework = compose(
  createValueObject(),
  storytellerPlugin<StepName>({}),
  dynamoPlugin({
    endpoint: "http://localhost:8000",
    region: "eu-central-1	",
  }),
  forgeValueObject({ debug: false }),
  storytellerHelper,
);

const TableName = "test-table-name";
const results: any[] = [];

describe("dynamo plugin", () => {
  it(
    "dynamo perform command and store it properly",
    testFramework.createStory({
      arrange: testFramework.createStep({
        name: StepName.stepArrange,
        handler: async (valueObject) => {
          const payload = {
            options: {},
            command: new CreateTableCommand({
              TableName,
              AttributeDefinitions: [{ AttributeName: "publisherId", AttributeType: "N" }],
              KeySchema: [{ AttributeName: "publisherId", KeyType: "HASH" }],
              BillingMode: "PAY_PER_REQUEST",
            }),
          };
          try {
            //@ts-ignore TODO figure out why types are not fitting after changes
            const result = await valueObject.dynamoSendCommand(payload);
            results.push({ ...payload, result });
          } catch (error) {
            results.push({ ...payload, result: error });
          }
        },
      }),
      act: testFramework.createStep({
        name: StepName.stepAct,
        handler: async (valueObject) => {
          const payload = {
            options: {},
            command: new PutCommand({
              TableName,
              Item: { publisherId: falso.randNumber() },
            }),
          };
          const result = await valueObject.dynamoSendCommand(payload);
          results.push({ ...payload, result });
        },
      }),
      assert: testFramework.createStep({
        name: StepName.stepAssert,
        handler: async (valueObject) => {
          const putCommands = valueObject.dynamoGetSentCommands({ commandName: PutCommand.name });
          const createTableCommands = valueObject.dynamoGetSentCommands({ commandName: CreateTableCommand.name });
          expect(createTableCommands[0]).toStrictEqual(results[0]);
          expect(putCommands[0]).toStrictEqual(results[1]);
        },
      }),
    }),
  );
});
