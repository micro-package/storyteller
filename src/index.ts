import { cloneDeep } from "lodash";
import { errorPlugin } from "@micro-package/common/error";
import { logger } from "@micro-package/common/logger";
import { createPlugin } from "@micro-package/container/plugin";
import { STORYTELLER_PLUG } from "./name";
import type {
  StorytellerActions,
  StorytellerHelper,
  StorytellerHookDefinition,
  StorytellerPlugin,
  StorytellerValueObject,
  TestRunnerNameGetters,
} from "./types";
import { SectionName } from "./types";
import { StorytellerHookName, StorytellerStepStatus } from "./types";
import { pipe, pipelineUnary } from "ts-pipe-compose";

export const testRunnerNameGetters: TestRunnerNameGetters[] = [
  //@ts-ignore
  { name: "jest", getScenarioName: () => expect?.getState()?.currentTestName },
  //@ts-ignore
  { name: "mocha", getScenarioName: () => this?.test?.fullTitle() },
];

export const storytellerPlugin = <TStepName extends string>(config: {
  testRunnerGetTestName?: TestRunnerNameGetters;
}) =>
  createPlugin<
    typeof STORYTELLER_PLUG,
    StorytellerActions<TStepName>,
    StorytellerHookDefinition,
    StorytellerPlugin<TStepName>
  >({
    name: STORYTELLER_PLUG,
    state: {
      globalState: {
        scenariosCreatedAmount: 0,
        scenariosStartedAmount: 0,
        scenariosFinishedAmount: 0,
        scenariosErroredAmount: 0,
        scenarioName: "SCENARIO_NAME_NOT_SET",
      },
      steps: [],
      defaultStates: [],
    },
    actions: {
      storytellerStep: (valueObject: StorytellerValueObject<TStepName>) => (step) => {
        const stepReference = { ...step, status: StorytellerStepStatus.created };
        logger.plugin(STORYTELLER_PLUG, `step created ${step.name}`);
        const stepHandler = async (prevStepPromise: Promise<any>) => {
          await prevStepPromise;
          valueObject.getPlugin(STORYTELLER_PLUG).state.steps.push(stepReference);
          stepReference.status = StorytellerStepStatus.started;
          await valueObject.runHooks({
            name: StorytellerHookName.stepStarted,
            payload: { step: stepReference as any },
          });
          try {
            await step.handler(valueObject.actions);
            stepReference.status = StorytellerStepStatus.finished;
            await valueObject.runHooks({
              name: StorytellerHookName.stepFinished,
              payload: { step: stepReference as any },
            });
          } catch (error) {
            stepReference.status = StorytellerStepStatus.errored;
            await valueObject.runHooks({
              name: StorytellerHookName.stepErrored,
              payload: { step: stepReference as any, error },
            });
            throw error;
          }
        };
        stepHandler.handler = step.handler;
        return stepHandler;
      },
      storytellerScenario: (valueObject: StorytellerValueObject<TStepName>) =>
        function (scenario) {
          valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosCreatedAmount += 1;
          return async () => {
            valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosStartedAmount += 1;
            const scenarioName = (
              config.testRunnerGetTestName === undefined
                ? testRunnerNameGetters
                : [config.testRunnerGetTestName, ...testRunnerNameGetters]
            )
              .map((payload) => {
                try {
                  const name = payload.getScenarioName();
                  if (name === undefined) {
                    throw Error("no scenario name");
                  }
                  logger.plugin(STORYTELLER_PLUG, `Test name received from "${payload.name}" test runner`);
                  return name;
                } catch (error) {
                  logger.plugin(STORYTELLER_PLUG, `Could not receive test name from "${payload.name}" test runner`);
                  return undefined;
                }
              })
              .find((testName) => testName !== undefined);
            if (scenarioName === undefined) {
              throw errorPlugin("missing scenario name");
            }
            valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenarioName = scenarioName;
            try {
              await valueObject.runHooks({ name: StorytellerHookName.scenarioStarted });
              try {
                await valueObject.runHooks({ name: StorytellerHookName.arrangeStarted });
                await scenario.arrange(valueObject.actions);
                await valueObject.runHooks({ name: StorytellerHookName.arrangeFinished });
              } catch (error) {
                await valueObject.runHooks({
                  name: StorytellerHookName.arrangeErrored,
                  payload: { error },
                });
                throw error;
              }
              try {
                await valueObject.runHooks({ name: StorytellerHookName.actStarted });
                await scenario.act(valueObject.actions);
                await valueObject.runHooks({ name: StorytellerHookName.actFinished });
              } catch (error) {
                await valueObject.runHooks({ name: StorytellerHookName.actErrored, payload: { error } });
                throw error;
              }
              try {
                await valueObject.runHooks({ name: StorytellerHookName.assertStarted });
                await scenario.assert(valueObject.actions);
                await valueObject.runHooks({ name: StorytellerHookName.assertFinished });
              } catch (error) {
                await valueObject.runHooks({ name: StorytellerHookName.assertErrored, payload: { error } });
                throw error;
              }
              await valueObject.runHooks({ name: StorytellerHookName.scenarioFinished });
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosFinishedAmount += 1;
            } catch (error) {
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosErroredAmount += 1;
              await valueObject.runHooks({ name: StorytellerHookName.scenarioErrored, payload: { error } });
              throw error;
            } finally {
              if (
                valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosStartedAmount ===
                valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosErroredAmount +
                  valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosFinishedAmount
              ) {
                await valueObject.runHooks({ name: StorytellerHookName.storytellerFinished });
              }
            }
          };
        },
    },
    hooks: [
      {
        name: StorytellerHookName.stepErrored,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          logger.descent(
            STORYTELLER_PLUG,
            `step errored ${payload.step.name} - ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status !== StorytellerStepStatus.created).length
            } created, ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status === StorytellerStepStatus.finished).length
            } finished, ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status === StorytellerStepStatus.errored).length
            } errored: ${payload.error.message}`,
          );
        },
      },
      {
        name: StorytellerHookName.stepFinished,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          logger.descent(
            STORYTELLER_PLUG,
            `step finished ${payload.step.name} - ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status !== StorytellerStepStatus.created).length
            } created, ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status === StorytellerStepStatus.finished).length
            } finished, ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status === StorytellerStepStatus.errored).length
            } errored`,
          );
        },
      },
      {
        name: StorytellerHookName.stepStarted,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          logger.ascent(
            STORYTELLER_PLUG,
            `step started ${payload.step.name} - ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status !== StorytellerStepStatus.created).length
            } started, ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status === StorytellerStepStatus.finished).length
            } finished, ${
              valueObject
                .getPlugin(STORYTELLER_PLUG)
                .state.steps.filter((step) => step.status === StorytellerStepStatus.errored).length
            } errored`,
          );
        },
      },
      {
        name: StorytellerHookName.assertStarted,
        handler: () => async () => {
          logger.ascent(STORYTELLER_PLUG, "section assert started");
        },
      },
      {
        name: StorytellerHookName.assertFinished,
        handler: () => async () => {
          logger.descent(STORYTELLER_PLUG, "section assert finished");
        },
      },
      {
        name: StorytellerHookName.assertErrored,
        handler: () => async (payload) => {
          logger.plugin(STORYTELLER_PLUG, `section assert errored: ${payload.error.message}`);
          logger.descent(STORYTELLER_PLUG, SectionName.assert);
        },
      },
      {
        name: StorytellerHookName.actStarted,
        handler: () => async () => {
          logger.ascent(STORYTELLER_PLUG, "section act started");
        },
      },
      {
        name: StorytellerHookName.actFinished,
        handler: () => async () => {
          logger.descent(STORYTELLER_PLUG, "section act finished");
        },
      },
      {
        name: StorytellerHookName.actErrored,
        handler: () => async (payload) => {
          logger.descent(STORYTELLER_PLUG, `section act errored: ${payload.error.message}`);
        },
      },
      {
        name: StorytellerHookName.arrangeStarted,
        handler: () => async () => {
          logger.ascent(STORYTELLER_PLUG, "section arrange started");
        },
      },
      {
        name: StorytellerHookName.arrangeFinished,
        handler: () => async () => {
          logger.descent(STORYTELLER_PLUG, "section arrange finished");
        },
      },
      {
        name: StorytellerHookName.arrangeErrored,
        handler: () => async (payload) => {
          logger.descent(STORYTELLER_PLUG, `section arrange errored: ${payload.error.message}`);
        },
      },
      {
        name: StorytellerHookName.scenarioFinished,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async () => {
          logger.descent(
            STORYTELLER_PLUG,
            `scenario finished ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenarioName} - ${
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosStartedAmount
            } finished, ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosCreatedAmount} created`,
          );
        },
      },
      {
        name: StorytellerHookName.scenarioStarted,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          valueObject.plugins = valueObject.plugins.map((plugin) => {
            const defaultState = valueObject
              .getPlugin(STORYTELLER_PLUG)
              .state.defaultStates.find(({ pluginName }) => pluginName === plugin.name);
            if (defaultState === undefined) {
              throw errorPlugin("missing plugin default state", {
                payload,
                plugin,
                defaultState,
              });
            }
            return { ...plugin, state: { ...defaultState.state, globalState: plugin.state.globalState } };
          });
          logger.ascent(
            STORYTELLER_PLUG,
            `scenario started ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenarioName} - ${
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosStartedAmount
            } started, ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosCreatedAmount} created`,
          );
        },
      },
      {
        name: StorytellerHookName.scenarioErrored,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          logger.descent(
            STORYTELLER_PLUG,
            `scenario errored ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenarioName} - ${
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosStartedAmount
            } errored, ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.scenariosCreatedAmount} created: ${
              payload.error.message
            }`,
          );
        },
      },
      {
        name: StorytellerHookName.stepCreated,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          logger.plugin(
            STORYTELLER_PLUG,
            `Step ${payload.step.name} appended - ${valueObject.getPlugin(STORYTELLER_PLUG).state.steps.length} index`,
          );
        },
      },
      {
        name: StorytellerHookName.storytellerCreated,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async () => {
          valueObject.getPlugin(STORYTELLER_PLUG).state.defaultStates = valueObject.plugins.map((plugin) =>
            cloneDeep({ pluginName: plugin.name, state: plugin.state }),
          );
        },
      },
    ],
  });

export const storytellerHelper = <TValueObject extends StorytellerValueObject<string>>(
  valueObject: TValueObject,
): StorytellerHelper<string, TValueObject> => {
  const storytellerCreatedPromise = valueObject.runHooks({
    name: StorytellerHookName.storytellerCreated,
  });
  valueObject.getPlugin(STORYTELLER_PLUG).hooks.unshift({
    name: StorytellerHookName.scenarioStarted,
    handler: () => () => storytellerCreatedPromise,
  });
  return {
    runHooks: valueObject.runHooks,
    createStep: valueObject.actions.storytellerStep as any,
    createScenario: valueObject.actions.storytellerScenario as any,
    composeSection: pipelineUnary,
  };
};

export const compose = pipe;
