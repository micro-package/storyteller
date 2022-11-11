import type { pipelineUnary } from "ts-pipe-compose";
import type { HookDefinition } from "@micro-package/container/hook";
import type { Plugin, PluginAction, PluginName } from "@micro-package/container/plugin";
import type { Status, ValueObject } from "@micro-package/container/value-object";
import type { STORYTELLER_PLUG } from "./name";

export enum StorytellerStepStatus {
  created = "created",
  started = "started",
  finished = "finished",
  errored = "errored",
}

export interface StorytellerStep<
  TStepName extends string,
  TStorytellerStepStatus extends StorytellerStepStatus,
  TValueObject extends ValueObject<Status.forged, any, any>,
> {
  name: TStepName;
  status: TStorytellerStepStatus;
  handler: (actions: TValueObject["actions"]) => Promise<void>;
}

export enum StorytellerHookName {
  storytellerCreated = "storytellerCreated",
  storytellerFinished = "storytellerFinished",

  stepCreated = "stepCreated",
  stepStarted = "stepStarted",
  stepFinished = "stepFinished",
  stepErrored = "stepErrored",

  scenarioStarted = "scenarioStarted",
  scenarioFinished = "scenarioFinished",
  scenarioErrored = "scenarioErrored",

  arrangeStarted = "arrangeStarted",
  arrangeFinished = "arrangeFinished",
  arrangeErrored = "arrangeErrored",

  actStarted = "actStarted",
  actFinished = "actFinished",
  actErrored = "actErrored",

  assertStarted = "assertStarted",
  assertFinished = "assertFinished",
  assertErrored = "assertErrored",
}

export type StorytellerHookDefinition =
  | HookDefinition<
      StorytellerHookName.stepErrored,
      {
        error: Error;
        step: StorytellerStep<string, StorytellerStepStatus.errored, ValueObject<Status.forged, any, any>>;
      }
    >
  | HookDefinition<
      StorytellerHookName.stepFinished,
      { step: StorytellerStep<string, StorytellerStepStatus.finished, ValueObject<Status.forged, any, any>> }
    >
  | HookDefinition<
      StorytellerHookName.stepStarted,
      { step: StorytellerStep<string, StorytellerStepStatus.started, ValueObject<Status.forged, any, any>> }
    >
  | HookDefinition<
      StorytellerHookName.stepCreated,
      { step: StorytellerStep<string, StorytellerStepStatus.created, ValueObject<Status.forged, any, any>> }
    >
  | HookDefinition<StorytellerHookName.scenarioStarted, {}>
  | HookDefinition<StorytellerHookName.scenarioErrored, { error: Error }>
  | HookDefinition<StorytellerHookName.scenarioFinished, {}>
  | HookDefinition<StorytellerHookName.storytellerCreated, {}>
  | HookDefinition<StorytellerHookName.arrangeStarted, {}>
  | HookDefinition<StorytellerHookName.arrangeFinished, {}>
  | HookDefinition<StorytellerHookName.arrangeErrored, { error: Error }>
  | HookDefinition<StorytellerHookName.actStarted, {}>
  | HookDefinition<StorytellerHookName.actFinished, {}>
  | HookDefinition<StorytellerHookName.actErrored, { error: Error }>
  | HookDefinition<StorytellerHookName.assertStarted, {}>
  | HookDefinition<StorytellerHookName.assertFinished, {}>
  | HookDefinition<StorytellerHookName.assertErrored, { error: Error }>
  | HookDefinition<StorytellerHookName.storytellerFinished, {}>;

export interface StorytellerState<
  TStepName extends string,
  TStep extends StorytellerStep<TStepName, StorytellerStepStatus, ValueObject<Status.forged, any, any>>,
  TState extends any,
> {
  steps: TStep[];
  globalState: {
    scenariosCreatedAmount: number;
    scenariosStartedAmount: number;
    scenariosFinishedAmount: number;
    scenariosErroredAmount: number;
    scenarioName: string;
  };
  defaultStates: { pluginName: string; state: TState }[];
}

export interface StorytellerActions<TStepName extends string> extends PluginAction<any, any, any> {
  storytellerScenario: (scenario: Scenario<TStepName, StorytellerValueObject<TStepName>>) => () => Promise<void>;
  storytellerStep: (
    step: Omit<StorytellerStep<TStepName, StorytellerStepStatus, ValueObject<Status.forged, any, any>>, "status">,
  ) => {
    (actions: Promise<void> | void): Promise<void>;
    handler: typeof step.handler;
  };
}

export interface StorytellerPlugin<TStepName extends string>
  extends Plugin<
    typeof STORYTELLER_PLUG,
    StorytellerState<
      TStepName,
      StorytellerStep<TStepName, StorytellerStepStatus, ValueObject<Status.forged, any, any>>,
      any
    >,
    StorytellerActions<TStepName>,
    StorytellerHookDefinition
  > {}

export interface StorytellerValueObject<TStepName extends string>
  extends ValueObject<
    Status.forged,
    StorytellerHookDefinition,
    StorytellerPlugin<TStepName> | Plugin<PluginName, any, any, HookDefinition<string, any>>
  > {}

export interface TestRunnerNameGetters {
  name: string;
  getScenarioName: () => string | void;
}

export type Section<TStepName extends string, TValueObject extends StorytellerValueObject<TStepName>> = (
  actions: TValueObject["actions"],
) => Promise<void>;

export enum SectionName {
  arrange = "arrange",
  act = "act",
  assert = "assert",
}

export type Scenario<TStepName extends string, TValueObject extends StorytellerValueObject<TStepName>> = {
  [key in SectionName]: Section<TStepName, TValueObject>;
};

export interface StorytellerHelper<TStepName extends string, TValueObject extends StorytellerValueObject<TStepName>> {
  runHooks: TValueObject["runHooks"];
  createScenario: TValueObject["actions"]["storytellerScenario"];
  createStep: TValueObject["actions"]["storytellerStep"] extends (
    step: Omit<StorytellerStep<infer UCreateStep, StorytellerStepStatus, TValueObject>, "status">,
  ) => (prevStepPromise: Promise<void> | void) => Promise<void>
    ? <TStep extends Omit<StorytellerStep<UCreateStep, StorytellerStepStatus, TValueObject>, "status">>(
        step: TStep,
      ) => {
        (actions: any): Promise<void>;
        handler: TStep["handler"];
      }
    : never;
  composeSection: typeof pipelineUnary;
}
