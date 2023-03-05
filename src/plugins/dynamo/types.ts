import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Command, MetadataBearer } from "@aws-sdk/types";
import type { SmithyConfiguration } from "@aws-sdk/smithy-client";
import type { HookDefinition } from "../../container/hook";
import type { Plugin, PluginAction } from "../../container/plugin";
import type { DYNAMO_PLUG } from "./name";
import type { Status, ValueObject } from "../../container/value-object";

export interface DynamoCommand<
  ClientInput extends object,
  ClientOutput extends MetadataBearer,
  InputType extends ClientInput,
  OutputType extends ClientOutput,
  HandlerOptions,
> {
  command: Command<ClientInput, InputType, ClientOutput, OutputType, SmithyConfiguration<HandlerOptions>>;
  options: HandlerOptions;
  result: MetadataBearer;
}

export enum DynamoHookName {
  commandStarted = "commandStarted",
  commandFinished = "commandFinished",
  commandErrored = "commandErrored",
}

export type DynamoHookDefinition<
  TDynamoCommand extends DynamoCommand<object, MetadataBearer, object, MetadataBearer, {}>,
> =
  | HookDefinition<DynamoHookName.commandStarted, Omit<TDynamoCommand, "result">>
  | HookDefinition<DynamoHookName.commandFinished, TDynamoCommand>
  | HookDefinition<DynamoHookName.commandErrored, Omit<TDynamoCommand, "result"> & { error: Error }>;

export interface DynamoState<TDynamoCommand extends DynamoCommand<object, MetadataBearer, object, MetadataBearer, {}>> {
  commands: TDynamoCommand[];
  client: DynamoDBDocumentClient;
}

export interface DynamoActions<TDynamoCommand extends DynamoCommand<object, MetadataBearer, object, MetadataBearer, {}>>
  extends PluginAction<any, any, any> {
  dynamoSendCommand: (payload: Omit<TDynamoCommand, "result">) => Promise<TDynamoCommand["result"]>;
  dynamoGetSentCommands: (payload: { commandName: string }) => TDynamoCommand[];
}

export type DynamoPlugin<TDynamoCommand extends DynamoCommand<object, MetadataBearer, object, MetadataBearer, {}>> =
  Plugin<
    typeof DYNAMO_PLUG,
    DynamoState<TDynamoCommand>,
    DynamoActions<TDynamoCommand>,
    DynamoHookDefinition<TDynamoCommand>
  >;

export type DynamoPluginValueObject<
  TDynamoCommand extends DynamoCommand<object, MetadataBearer, object, MetadataBearer, {}>,
> = ValueObject<Status.forged, DynamoHookDefinition<TDynamoCommand>, DynamoPlugin<TDynamoCommand>>;
