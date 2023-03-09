import { dynamoPlugin } from ".";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { expect } from "@jest/globals";
import { createValueObject, forgeValueObject } from "../../container/value-object";
import { falso } from "../../common/falso";
import { storytellerPlugin, storytellerHelper } from "../storyteller";
import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { pipe } from "ts-pipe-compose";
import { normalize } from "path";
import { config } from "dotenv";

const { parsed: env } = config({ path: normalize(`${__dirname}/../../../.env`) });
if (
  env === undefined ||
  env.DYNAMODB_URL === undefined ||
  env.DYNAMODB_REGION === undefined ||
  env.AWS_ACCESS_KEY_ID === undefined ||
  env.AWS_SECRET_ACCESS_KEY === undefined
) {
  throw Error("Test has missing env variables");
}

enum StepName {
  stepArrange = "stepArrange",
  stepAct = "stepAct",
  stepAssert = "stepAssert",
}
const testFramework = pipe(
  createValueObject(),
  storytellerPlugin<StepName>({}),
  dynamoPlugin({
    endpoint: env.DYNAMODB_URL,
    region: env.DYNAMODB_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
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
