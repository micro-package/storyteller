import { cloneDeep } from "lodash";
import { errorPlugin } from "../../common/error";
import { logger } from "../../common/logger";
import { createPlugin } from "../../container/plugin";
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
import { pipelineUnary } from "ts-pipe-compose";
import { WebSocket } from "ws";
import { PrimaryHookName } from "../../container/hook";
import { secureJsonStringify } from "../../common/parser/secure-json";
import { v4 } from "uuid";
import { DateTime } from "luxon";

export const testRunnerNameGetters: TestRunnerNameGetters[] = [
  //@ts-ignore
  { name: "jest", getStoryName: () => expect?.getState()?.currentTestName },
  //@ts-ignore
  { name: "mocha", getStoryName: () => this?.test?.fullTitle() },
];

const initializeWebsocketConnection = (config: { url: string }) => {
  const websocket = new WebSocket(`${config.url}?userId=123&userType=storyteller`);
  websocket.on("error", (err) => logger.debug(STORYTELLER_PLUG, `weboskcet error: ${err.toString()}`));
  websocket.on("message", (data) => logger.debug(STORYTELLER_PLUG, `weboskcet message: ${data.toString()}`));
  websocket.on("close", (code, reason) =>
    logger.debug(STORYTELLER_PLUG, `weboskcet close: ${code} ${Buffer.from(reason).toString()}`),
  );
  const wsConnection = new Promise((resolve) =>
    websocket.once("open", () => {
      logger.plugin(STORYTELLER_PLUG, `Websocket connected: ${config.url}`);
      resolve(undefined);
    }),
  );
  return {
    getWebsocket: async () => {
      await wsConnection;
      return websocket;
    },
  };
};
const executionId = v4();

export const storytellerPlugin = <TStepName extends string>(config: {
  testRunnerGetTestName?: TestRunnerNameGetters;
  websocketUrl?: string;
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
        storiesCreatedAmount: 0,
        storiesStartedAmount: 0,
        storiesFinishedAmount: 0,
        storiesErroredAmount: 0,
        storyId: "STORY_ID_NOT_SET",
        storyName: "STORY_NAME_NOT_SET",
        ws: config.websocketUrl !== undefined ? initializeWebsocketConnection({ url: config.websocketUrl }) : undefined,
      },
      steps: [],
      defaultStates: [],
    },
    actions: {
      storytellerCreateStep: (valueObject: StorytellerValueObject<TStepName>) => (step) => {
        const stepReference = { ...step, status: StorytellerStepStatus.created };
        const stepHandler = async (prevStepPromise: Promise<any>) => {
          await prevStepPromise;
          valueObject.getPlugin(STORYTELLER_PLUG).state.steps.push(stepReference);
          await valueObject.runHooks({
            name: StorytellerHookName.stepCreated,
            payload: {
              step: stepReference as any,
              storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
            },
          });
          stepReference.status = StorytellerStepStatus.started;
          await valueObject.runHooks({
            name: StorytellerHookName.stepStarted,
            payload: {
              step: stepReference as any,
              storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
            },
          });
          try {
            await step.handler(valueObject.actions);
            stepReference.status = StorytellerStepStatus.finished;
            await valueObject.runHooks({
              name: StorytellerHookName.stepFinished,
              payload: {
                step: stepReference as any,
                storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
              },
            });
          } catch (error) {
            stepReference.status = StorytellerStepStatus.errored;
            await valueObject.runHooks({
              name: StorytellerHookName.stepErrored,
              payload: {
                step: stepReference as any,
                error,
                storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
              },
            });
            throw error;
          }
        };
        stepHandler.handler = step.handler;
        return stepHandler;
      },
      storytellerCreateStory: (valueObject: StorytellerValueObject<TStepName>) =>
        function (story) {
          valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesCreatedAmount += 1;
          return async () => {
            valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesStartedAmount += 1;
            const storyName = (
              config.testRunnerGetTestName === undefined
                ? testRunnerNameGetters
                : [config.testRunnerGetTestName, ...testRunnerNameGetters]
            )
              .map((payload) => {
                try {
                  const name = payload.getStoryName();
                  if (name === undefined) {
                    throw Error("no story name");
                  }
                  logger.plugin(STORYTELLER_PLUG, `Test name received from "${payload.name}" test runner`);
                  return name;
                } catch (error) {
                  return undefined;
                }
              })
              .find((testName) => testName !== undefined);
            if (storyName === undefined) {
              throw errorPlugin("story name couldn`t be received from test runner");
            }
            valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyName = storyName;
            valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId = v4();
            try {
              await valueObject.runHooks({
                name: StorytellerHookName.storyStarted,
                payload: { storyName, storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId },
              });
              try {
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionStarted,
                  payload: {
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.arrange,
                  },
                });
                await story.arrange(valueObject.actions);
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionFinished,
                  payload: {
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.arrange,
                  },
                });
              } catch (error) {
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionErrored,
                  payload: {
                    error,
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.arrange,
                  },
                });
                throw error;
              }
              try {
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionStarted,
                  payload: {
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.act,
                  },
                });
                await story.act(valueObject.actions);
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionFinished,
                  payload: {
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.act,
                  },
                });
              } catch (error) {
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionErrored,
                  payload: {
                    error,
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.act,
                  },
                });
                throw error;
              }
              try {
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionStarted,
                  payload: {
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.assert,
                  },
                });
                await story.assert(valueObject.actions);
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionFinished,
                  payload: {
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.act,
                  },
                });
              } catch (error) {
                await valueObject.runHooks({
                  name: StorytellerHookName.sectionErrored,
                  payload: {
                    error,
                    storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId,
                    sectionName: SectionName.act,
                  },
                });
                throw error;
              }
              await valueObject.runHooks({
                name: StorytellerHookName.storyFinished,
                payload: { storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId },
              });
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesFinishedAmount += 1;
            } catch (error) {
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesErroredAmount += 1;
              await valueObject.runHooks({
                name: StorytellerHookName.storyErrored,
                payload: { error, storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId },
              });
              throw error;
            } finally {
              //? This setImmediate makes storyteller to run if condition after the next story is triggered or now if no story was left to trigger. This way condition is met only if last story is finished.
              setImmediate(async () => {
                if (
                  valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesStartedAmount ===
                  valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesErroredAmount +
                    valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesFinishedAmount
                ) {
                  await valueObject.runHooks({
                    name: StorytellerHookName.storytellerFinished,
                    payload: { storyId: valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyId },
                  });
                }
              });
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
            `step errored "${payload.step.name}" - ${
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
            `step finished "${payload.step.name}" - ${
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
            `step started "${payload.step.name}" - ${
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
        name: StorytellerHookName.sectionStarted,
        handler: () => async (payload) => {
          if (payload.sectionName === SectionName.arrange) {
            logger.ascent(STORYTELLER_PLUG, "section arrange started");
          } else if (payload.sectionName === SectionName.act) {
            logger.ascent(STORYTELLER_PLUG, "section act started");
          } else if (payload.sectionName === SectionName.assert) {
            logger.ascent(STORYTELLER_PLUG, "section assert started");
          }
        },
      },
      {
        name: StorytellerHookName.sectionFinished,
        handler: () => async (payload) => {
          if (payload.sectionName === SectionName.arrange) {
            logger.descent(STORYTELLER_PLUG, "section arrange finished");
          } else if (payload.sectionName === SectionName.act) {
            logger.descent(STORYTELLER_PLUG, "section act finished");
          } else if (payload.sectionName === SectionName.assert) {
            logger.descent(STORYTELLER_PLUG, "section assert finished");
          }
        },
      },
      {
        name: StorytellerHookName.sectionErrored,
        handler: () => async (payload) => {
          if (payload.sectionName === SectionName.arrange) {
            logger.descent(STORYTELLER_PLUG, `section arrange errored: ${payload.error.message}`);
          } else if (payload.sectionName === SectionName.act) {
            logger.descent(STORYTELLER_PLUG, `section act errored: ${payload.error.message}`);
          } else if (payload.sectionName === SectionName.assert) {
            logger.plugin(STORYTELLER_PLUG, `section assert errored: ${payload.error.message}`);
            logger.descent(STORYTELLER_PLUG, SectionName.assert);
          }
        },
      },
      {
        name: StorytellerHookName.storyFinished,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async () => {
          logger.descent(
            STORYTELLER_PLUG,
            `story finished \"${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyName}\" - ${
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesStartedAmount
            } finished, ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesCreatedAmount} created`,
          );
        },
      },
      {
        name: StorytellerHookName.storyStarted,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          const defaultStates = cloneDeep(valueObject.getPlugin(STORYTELLER_PLUG).state.defaultStates);
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
          valueObject.getPlugin(STORYTELLER_PLUG).state.defaultStates = defaultStates;
          logger.ascent(
            STORYTELLER_PLUG,
            `story started \"${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyName}\" - ${
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesStartedAmount
            } started, ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesCreatedAmount} created`,
          );
        },
      },
      {
        name: StorytellerHookName.storyErrored,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          logger.descent(
            STORYTELLER_PLUG,
            `story errored \"${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storyName}\" - ${
              valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesStartedAmount
            } errored, ${valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.storiesCreatedAmount} created: ${
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
            `Step appended "${payload.step.name}" - ${
              valueObject.getPlugin(STORYTELLER_PLUG).state.steps.length
            } index`,
          );
        },
      },
      {
        name: StorytellerHookName.storytellerCreated,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async () => {
          await valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.ws?.getWebsocket();
          valueObject.getPlugin(STORYTELLER_PLUG).state.defaultStates = valueObject.plugins.map((plugin) =>
            cloneDeep({ pluginName: plugin.name, state: plugin.state }),
          );
        },
      },
      {
        name: StorytellerHookName.storytellerFinished,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async () => {
          const websocket = await valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.ws?.getWebsocket();
          if (websocket !== undefined) {
            websocket.close();
          }
          valueObject.getPlugin(STORYTELLER_PLUG).state.defaultStates = valueObject.plugins.map((plugin) =>
            cloneDeep({ pluginName: plugin.name, state: plugin.state }),
          );
        },
      },
      {
        name: PrimaryHookName.beforeHook,
        handler: (valueObject: StorytellerValueObject<TStepName>) => async (payload) => {
          const websocket = await valueObject.getPlugin(STORYTELLER_PLUG).state.globalState.ws?.getWebsocket();
          if (websocket !== undefined) {
            //TODO make service usage optional (store events locally an if connection established send them)
            websocket.send(
              secureJsonStringify({
                eventName: "storytellerHookBefore",
                eventPayload: {
                  executionId,
                  hookName: payload.name,
                  hookPayload: payload.payload,
                  createdAt: DateTime.now().toISO(),
                },
              }),
            );
          }
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
    name: StorytellerHookName.storyStarted,
    handler: () => () => storytellerCreatedPromise,
  });
  return {
    runHooks: valueObject.runHooks,
    createStep: valueObject.actions.storytellerCreateStep as any,
    createStory: valueObject.actions.storytellerCreateStory as any,
    composeSection: pipelineUnary,
  };
};
