import type { StepFunctions } from "aws-sdk";
import type { ListExecutionsPageToken } from "aws-sdk/clients/stepfunctions";
import type { ExpressPluginApiDefinition, ExpressMockExecution } from "../express/types";
import type { RetryPolicy } from "cockatiel";
import type { HookDefinition } from "../../container/hook";
import type { Plugin, PluginAction } from "../../container/plugin";
import type { ValueObject, Status } from "../../container/value-object";
import type { STEP_FUNCTIONS_PLUG } from "./name";

export enum StepFunctionsHookName {
  mocked = "stepFunctionsMocked",
  intercepted = "stepFunctionsIntercepted",
  unleashed = "stepFunctionsUnleashed",
  awaited = "stepFunctionsAwaited",
}

export type StepFunctionsHookDefinition =
  | HookDefinition<StepFunctionsHookName.mocked, { apiDefinition: ExpressPluginApiDefinition<string, string> }>
  | HookDefinition<
      StepFunctionsHookName.intercepted,
      {
        apiDefinition: ExpressPluginApiDefinition<string, string>;
        handlerAmount: number;
        exhaustedAmount: number;
        payload: StepFunctions.Types.StartExecutionInput;
      }
    >
  | HookDefinition<StepFunctionsHookName.unleashed, { executions: ExpressMockExecution<any>[] }>
  | HookDefinition<
      StepFunctionsHookName.awaited,
      { executions: ExpressMockExecution<any>[]; retryPolicy: RetryPolicy }
    >;

export interface StepFunctionsState {
  globalState: {
    stepFunctions: StepFunctions;
  };
}

export interface StepFunctionsActions extends PluginAction<any, any, any> {
  stepFunctionsMock: (payload: { handlerAmount?: number }) => Promise<void>;
  stepFunctionsUnleash: (payload: { filter?: Parameters<ExpressMockExecution<any>[]["filter"]>[0] }) => Promise<void>;
  stepFunctionsAwait: (payload: { filter?: Parameters<ExpressMockExecution<any>[]["filter"]>[0] }) => Promise<void>;
  stepFunctionsListExecutions: (payload: {
    stateMachineArn: string;
    executions?: StepFunctions.Types.ExecutionListItem[];
    nextToken?: ListExecutionsPageToken;
  }) => Promise<StepFunctions.Types.ExecutionListItem[]>;
}

export type StepFunctionsPlugin = Plugin<
  typeof STEP_FUNCTIONS_PLUG,
  StepFunctionsState,
  StepFunctionsActions,
  StepFunctionsHookDefinition
>;

export type StepFunctionsValueObject = ValueObject<Status.forged, StepFunctionsHookDefinition, StepFunctionsPlugin>;
