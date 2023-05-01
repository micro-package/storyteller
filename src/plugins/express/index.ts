import express, { Router } from "express";
import type { ErrorRequestHandler, RequestHandler } from "express-serve-static-core";
import { createPlugin } from "../../container/plugin";
import { logger } from "../../common/logger";
import type HTTPMethod from "http-method-enum";
import { errorPlugin } from "../../common/error";
import { pick } from "lodash";
import { EXPRESS_PLUG } from "./name";
import { StatusCodes } from "http-status-codes";
import { inspect } from "util";
import { buildEndpointDescription } from "../../common/endpoint-descriptor";
import { STORYTELLER_PLUG } from "../storyteller/name";
import type { StorytellerHookDefinition } from "../storyteller/types";
import { SectionName } from "../storyteller/types";
import { StorytellerHookName } from "../storyteller/types";
import type {
  ExpressPluginApiDefinition,
  ExpressActions,
  ExpressHookDefinition,
  ExpressMock,
  ExpressMockDefinitions,
  ExpressPlugin,
  ExpressValueObject,
} from "./types";
import { ExpressHookName } from "./types";

const notFoundHandlerMiddleware: RequestHandler = async (req, res) => {
  logger.plugin(
    EXPRESS_PLUG,
    `Not Found ${req.method} ${req.baseUrl} ${inspect({
      query: req.query,
      body: req.body,
      params: req.params,
      headers: req.headers,
    })}`,
  );
  res.status(StatusCodes.NOT_FOUND).send(`Page ${req.baseUrl} not found`);
};
const errorHandlerMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
  const message = `❗ Mock server call errored ${req.method} ${req.baseUrl} > ${inspect(error, false, Infinity)}`;
  logger.plugin(EXPRESS_PLUG, message);
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(message);
};

export const expressPlugin = <TExpressMock extends ExpressMock<ExpressPluginApiDefinition<string, string>>>(config: {
  port: number;
  mockDefinitions: (TExpressMock extends infer UExpressMock extends ExpressMock<
    ExpressPluginApiDefinition<string, string>
  >
    ? ExpressMockDefinitions<UExpressMock>
    : never)[];
}) => {
  const nonUniqueEndpointNames = config.mockDefinitions
    .map(({ endpointName }) => endpointName)
    .filter((e, i, a) => a.indexOf(e) !== i);
  if (nonUniqueEndpointNames.length > 0) {
    throw errorPlugin("mock definitions endpoint name must be unique in each definition", nonUniqueEndpointNames);
  }
  return createPlugin<
    typeof EXPRESS_PLUG,
    ExpressActions<TExpressMock>,
    ExpressHookDefinition | StorytellerHookDefinition,
    ExpressPlugin<TExpressMock>
  >({
    name: EXPRESS_PLUG,
    requiredPlugins: [STORYTELLER_PLUG],
    actions: {
      expressGetMock: (valueObject: ExpressValueObject<TExpressMock>) => (payload) => {
        const mock = valueObject
          .getPlugin(EXPRESS_PLUG)
          .state.mockDefinitions.find(({ endpointName }) => endpointName === payload.endpointName);
        if (mock === undefined) {
          throw errorPlugin("missing mock");
        }
        return payload.paths === undefined ? mock : (pick(mock, payload.paths) as typeof mock);
      },
      expressGetExecutions: (valueObject: ExpressValueObject<TExpressMock>) => (payload) =>
        valueObject
          .getPlugin(EXPRESS_PLUG)
          .state.executions.filter(({ endpointName }) => endpointName === payload.endpointName)
          .map((execution) => (payload.paths === undefined ? execution : pick(execution, payload.paths))) as any,
      expressMock: (valueObject: ExpressValueObject<TExpressMock>) => async (payload) => {
        const mockDefinition =
          payload?.apiDefinition ||
          config.mockDefinitions.find(({ endpointName: mockName }) => mockName === payload.endpointName);
        if (mockDefinition === undefined) {
          await valueObject.runHooks({ name: ExpressHookName.mockWithoutDefintitionFailed });
          throw errorPlugin("missing mock definition");
        }
        const mock = {
          ...mockDefinition,
          url: `${new URL(mockDefinition.url).origin}/${mockDefinition.apiName}${new URL(mockDefinition.url).pathname}`,
        };
        await valueObject.runHooks({ name: ExpressHookName.mockHandlerCreationStarted, payload: { payload, mock } });

        let index = 0;
        valueObject
          .getPlugin(EXPRESS_PLUG)
          .state.globalState.router[mock.method.toLowerCase() as Lowercase<HTTPMethod>](
            new URL(mock.url).pathname,
            ...payload.handlers[index].slice(0, -1),
            async (req, res, next) => {
              await valueObject.runHooks({
                name: ExpressHookName.mockHandlerExecutionStarted,
                payload: { payload, mock, index, req, res },
              });
              if (index >= payload.handlers.length) {
                await valueObject.runHooks({
                  name: ExpressHookName.mockHandlersUsageExceeded,
                  payload: { payload, mock, index, req, res },
                });
                res
                  .status(StatusCodes.IM_A_TEAPOT)
                  .send({ message: "handlers usage exceeded", lastIndex: index, payload });
              } else {
                const handler = payload.handlers[index][payload.handlers[index].length - 1];
                await handler(req, res, next);
              }
              await valueObject.runHooks({
                name: ExpressHookName.mockHandlerExecutionFinished,
                payload: { payload, mock, index, req, res },
              });
              valueObject.getPlugin(EXPRESS_PLUG).state.executions.push({ ...mock, response: res, request: req });
              index += 1;
            },
          );
        valueObject.getPlugin(EXPRESS_PLUG).state.mockDefinitions.push({
          handlers: payload.handlers,
          ...mock,
        });
        await valueObject.runHooks({ name: ExpressHookName.mockHandlerCreationFinished, payload: { payload, mock } });
      },
    },
    state: {
      mockDefinitions: [],
      executions: [],
      globalState: {
        express: express(),
        server: null as any,
        router: Router(),
      },
    },
    hooks: [
      {
        name: StorytellerHookName.sectionStarted,
        handler:
          (valueObject: ExpressValueObject<ExpressMock<ExpressPluginApiDefinition<string, string>>>) =>
          async (payload) => {
            if (payload.sectionName === SectionName.arrange) {
              valueObject.getPlugin(EXPRESS_PLUG).state.globalState.router = Router();
              await valueObject.runHooks({ name: ExpressHookName.routesCleared });
            }
          },
      },
      {
        name: StorytellerHookName.sectionFinished,
        handler: (valueObject: ExpressValueObject<TExpressMock>) => async (payload) => {
          if (payload.sectionName === SectionName.arrange) {
            valueObject.getPlugin(EXPRESS_PLUG).state.globalState.router.use(notFoundHandlerMiddleware);
            await valueObject.runHooks({
              name: ExpressHookName.globalMiddlewareAdded,
              payload: { middlewareName: notFoundHandlerMiddleware.name },
            });
            valueObject.getPlugin(EXPRESS_PLUG).state.globalState.router.use(errorHandlerMiddleware);
            await valueObject.runHooks({
              name: ExpressHookName.globalMiddlewareAdded,
              payload: { middlewareName: errorHandlerMiddleware.name },
            });
          }
        },
      },
      {
        name: StorytellerHookName.storytellerCreated,
        handler: (valueObject: ExpressValueObject<TExpressMock>) => async () => {
          valueObject.getPlugin(EXPRESS_PLUG).state.globalState.express.use(function (req, res, next) {
            valueObject.getPlugin(EXPRESS_PLUG).state.globalState.router(req, res, next);
          });
          valueObject.getPlugin(EXPRESS_PLUG).state.globalState.server = valueObject
            .getPlugin(EXPRESS_PLUG)
            .state.globalState.express.listen(config.port);
          await valueObject.runHooks({ name: ExpressHookName.serverListening, payload: { port: config.port } });
        },
      },
      {
        name: StorytellerHookName.storytellerFinished,
        handler: (valueObject: ExpressValueObject<TExpressMock>) => async () => {
          valueObject.getPlugin(EXPRESS_PLUG).state.globalState.server.close();
          await valueObject.runHooks({ name: ExpressHookName.serverClosed });
        },
      },
      {
        name: ExpressHookName.routesCleared,
        handler: () => async () => {
          logger.plugin(EXPRESS_PLUG, "routes cleared");
        },
      },
      {
        name: ExpressHookName.globalMiddlewareAdded,
        handler: () => async (payload) => {
          logger.plugin(EXPRESS_PLUG, `global middleware added: ${payload.middlewareName}`);
        },
      },
      {
        name: ExpressHookName.serverListening,
        handler: () => async (payload) => {
          logger.plugin(EXPRESS_PLUG, `plugin listening on port: ${payload.port}`);
        },
      },
      {
        name: ExpressHookName.serverClosed,
        handler: () => async () => {
          logger.plugin(EXPRESS_PLUG, "server closed");
        },
      },
      {
        name: ExpressHookName.mockHandlerCreationStarted,
        handler: () => async (payload) => {
          logger.plugin(
            EXPRESS_PLUG,
            `mock creation started - ${payload.payload.handlers.length} executions ${buildEndpointDescription({
              ...payload.mock,
              url: `http://localhost:${config.port}`,
            })}`,
          );
        },
      },
      {
        name: ExpressHookName.mockHandlerCreationFinished,
        handler: () => async (payload) => {
          logger.plugin(
            EXPRESS_PLUG,
            `mocked creation finished - ${payload.payload.handlers.length} executions ${buildEndpointDescription(
              payload.mock,
            )}`,
          );
        },
      },
      {
        name: ExpressHookName.mockHandlerExecutionStarted,
        handler: () => async (payload) => {
          logger.plugin(
            EXPRESS_PLUG,
            `execution started ${payload.index + 1}/${payload.payload.handlers.length} ${buildEndpointDescription(
              payload.mock,
            )}`,
          );
        },
      },
      {
        name: ExpressHookName.mockHandlerExecutionFinished,
        handler: () => async (payload) => {
          logger.plugin(
            EXPRESS_PLUG,
            `execution finished ${payload.index + 1}/${payload.payload.handlers.length} ${buildEndpointDescription(
              payload.mock,
            )}`,
          );
        },
      },
      {
        name: ExpressHookName.mockHandlersUsageExceeded,
        handler: () => async () => {
          logger.error(EXPRESS_PLUG, "handlers usage exceeded");
        },
      },
    ],
  });
};
