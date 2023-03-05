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
import { StorytellerHookName } from "../storyteller/types";
import type {
  ApiDefinition,
  ExpressActions,
  ExpressHookDefinition,
  ExpressMock,
  ExpressMockDefinitions,
  ExpressPlugin,
  ExpressValueObject,
} from "./types";

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

export const expressPlugin = <TExpressMock extends ExpressMock<ApiDefinition<string, string>>>(config: {
  port: number;
  mockDefinitions: (TExpressMock extends infer UExpressMock extends ExpressMock<ApiDefinition<string, string>>
    ? ExpressMockDefinitions<UExpressMock>
    : never)[];
}) => {
  const nonUniquePluginNames = config.mockDefinitions
    .map(({ endpointName }) => endpointName)
    .filter((e, i, a) => a.indexOf(e) !== i);
  if (nonUniquePluginNames.length > 0) {
    throw errorPlugin("mock definitions endpoint name must be unique in each definition", nonUniquePluginNames);
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
          throw errorPlugin("missing mock definition");
        }
        const mock = {
          ...mockDefinition,
          url: `${new URL(mockDefinition.url).origin}/${mockDefinition.apiName}${new URL(mockDefinition.url).pathname}`,
        };
        logger.plugin(
          EXPRESS_PLUG,
          `mock creation started - ${payload.handlers.length} executions ${buildEndpointDescription({
            ...mock,
            url: `http://localhost:${config.port}`,
          })}`,
        );
        let index = 0;
        valueObject
          .getPlugin(EXPRESS_PLUG)
          .state.globalState.router[mock.method.toLowerCase() as Lowercase<HTTPMethod>](
            new URL(mock.url).pathname,
            ...payload.handlers[index].slice(0, -1),
            async (req, res, next) => {
              logger.plugin(
                EXPRESS_PLUG,
                `execution started ${index + 1}/${payload.handlers.length} ${buildEndpointDescription(mock)}`,
              );
              if (index >= payload.handlers.length) {
                logger.error(EXPRESS_PLUG, "handlers usage exceeded");
                res
                  .status(StatusCodes.IM_A_TEAPOT)
                  .send({ message: "handlers usage exceeded", lastIndex: index, payload });
              } else {
                const handler = payload.handlers[index][payload.handlers[index].length - 1];
                await handler(req, res, next);
              }
              logger.plugin(
                EXPRESS_PLUG,
                `execution finished ${index + 1}/${payload.handlers.length} ${buildEndpointDescription(mock)}`,
              );
              valueObject.getPlugin(EXPRESS_PLUG).state.executions.push({ ...mock, response: res, request: req });
              index += 1;
            },
          );
        valueObject.getPlugin(EXPRESS_PLUG).state.mockDefinitions.push({
          handlers: payload.handlers,
          ...mock,
        });
        logger.plugin(
          EXPRESS_PLUG,
          `mocked creation finished - ${payload.handlers.length} executions ${buildEndpointDescription(mock)}`,
        );
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
        name: StorytellerHookName.arrangeStarted,
        handler: (valueObject: ExpressValueObject<ExpressMock<ApiDefinition<string, string>>>) => async () => {
          valueObject.getPlugin(EXPRESS_PLUG).state.globalState.router = Router();
          logger.plugin(EXPRESS_PLUG, "routes cleared");
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
          logger.plugin(EXPRESS_PLUG, `plugin listening on port: ${config.port}`);
        },
      },
      {
        name: StorytellerHookName.arrangeFinished,
        handler: (valueObject: ExpressValueObject<TExpressMock>) => async () => {
          valueObject.getPlugin(EXPRESS_PLUG).state.globalState.router.use(notFoundHandlerMiddleware);
          logger.plugin(EXPRESS_PLUG, "global middleware added: not found handler");
          valueObject.getPlugin(EXPRESS_PLUG).state.globalState.router.use(errorHandlerMiddleware);
          logger.plugin(EXPRESS_PLUG, "global middleware added: error handler");
        },
      },
      {
        name: StorytellerHookName.storytellerFinished,
        handler: (valueObject: ExpressValueObject<TExpressMock>) => async () => {
          valueObject.getPlugin(EXPRESS_PLUG).state.globalState.server.close();
          logger.plugin(EXPRESS_PLUG, "server closed");
        },
      },
    ],
  });
};
