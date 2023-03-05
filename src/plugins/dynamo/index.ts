import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { MetadataBearer } from "@aws-sdk/types";
import { createPlugin } from "../../container/plugin";
import { DYNAMO_PLUG } from "./name";
import { logger } from "../../common/logger";
import type {
  DynamoActions,
  DynamoCommand,
  DynamoHookDefinition,
  DynamoPlugin,
  DynamoPluginValueObject,
} from "./types";
import { DynamoHookName } from "./types";

export const dynamoPlugin = <TDynamoCommand extends DynamoCommand<object, MetadataBearer, object, MetadataBearer, {}>>(
  config: DynamoDBClientConfig,
) =>
  createPlugin<
    typeof DYNAMO_PLUG,
    DynamoActions<TDynamoCommand>,
    DynamoHookDefinition<TDynamoCommand>,
    DynamoPlugin<TDynamoCommand>
  >({
    name: DYNAMO_PLUG,
    state: {
      commands: [],
      client: DynamoDBDocumentClient.from(new DynamoDBClient(config)),
    },
    actions: {
      dynamoSendCommand: (valueObject: DynamoPluginValueObject<TDynamoCommand>) => async (payload) => {
        try {
          await valueObject.runHooks({ name: DynamoHookName.commandStarted, payload });
          const result = await valueObject.getPlugin(DYNAMO_PLUG).state.client.send(payload.command, payload.options);
          valueObject.getPlugin(DYNAMO_PLUG).state.commands.push({ ...payload, result } as any);
          await valueObject.runHooks({ name: DynamoHookName.commandFinished, payload: { ...payload, result } as any });
          return result;
        } catch (error) {
          valueObject.getPlugin(DYNAMO_PLUG).state.commands.push({ ...payload, result: error } as any);
          await valueObject.runHooks({ name: DynamoHookName.commandErrored, payload: { ...payload, error } });
          throw error;
        }
      },
      dynamoGetSentCommands: (valueObject: DynamoPluginValueObject<TDynamoCommand>) => (payload) =>
        valueObject
          .getPlugin(DYNAMO_PLUG)
          .state.commands.filter(({ command }) => command.constructor.name === payload.commandName),
    },
    hooks: [
      {
        name: DynamoHookName.commandStarted,
        handler: (valueObject: DynamoPluginValueObject<TDynamoCommand>) => async (payload) => {
          logger.plugin(
            DYNAMO_PLUG,
            `command started ${payload.command.constructor.name} ${
              valueObject
                .getPlugin(DYNAMO_PLUG)
                .state.commands.filter((command) => command.constructor.name === payload.command.constructor.name)
                .length
            }/${valueObject.getPlugin(DYNAMO_PLUG).state.commands.length}`,
          );
        },
      },
      {
        name: DynamoHookName.commandFinished,
        handler: (valueObject: DynamoPluginValueObject<TDynamoCommand>) => async (payload) => {
          logger.plugin(
            DYNAMO_PLUG,
            `command finished ${payload.command.constructor.name} ${
              valueObject
                .getPlugin(DYNAMO_PLUG)
                .state.commands.filter((command) => command.constructor.name === payload.command.constructor.name)
                .length
            }/${valueObject.getPlugin(DYNAMO_PLUG).state.commands.length}`,
          );
        },
      },
      {
        name: DynamoHookName.commandErrored,
        handler: (valueObject: DynamoPluginValueObject<TDynamoCommand>) => async (payload) => {
          logger.plugin(
            DYNAMO_PLUG,
            `command errored ${payload.command.constructor.name} ${
              valueObject
                .getPlugin(DYNAMO_PLUG)
                .state.commands.filter((command) => command.constructor.name === payload.command.constructor.name)
                .length
            }/${valueObject.getPlugin(DYNAMO_PLUG).state.commands.length}`,
          );
        },
      },
    ],
  });
