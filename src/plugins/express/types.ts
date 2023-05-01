import type { Request, Router } from "express";
import type { Express, NextFunction, ParamsDictionary, Response } from "express-serve-static-core";
import type { Server } from "http";
import type { ParsedQs } from "qs";
import type { Plugin, PluginAction } from "../../container/plugin";
import type { Status, ValueObject } from "../../container/value-object";
import type HTTPMethod from "http-method-enum";
import type { DotNotation } from "../../common/dot-notation";
import type { EXPRESS_PLUG } from "./name";
import type { StorytellerHookDefinition } from "../storyteller/types";
import type { HookDefinition } from "../../container/hook";

export interface ExpressPluginApiDefinition<TApiName extends string, TEndpointName extends string> {
  apiName: TApiName;
  endpointName: TEndpointName;
}
export type ExpressMockDefinitions<TApiDefinition extends ExpressPluginApiDefinition<string, string>> = Pick<
  TApiDefinition,
  keyof ExpressPluginApiDefinition<string, string>
> & {
  method: HTTPMethod;
  url: string;
};

export type ExpressMock<TApiDefinition extends ExpressPluginApiDefinition<string, string>> = TApiDefinition & {
  requestParameter: ParamsDictionary;
  responseBody: any;
  requestBody: any;
  requestQuery: ParsedQs;
};

export type ExpressMockExecution<TExpressMock extends ExpressMock<ExpressPluginApiDefinition<string, string>>> =
  ExpressMockDefinitions<TExpressMock> & {
    response: Response<TExpressMock["responseBody"]>;
    request: Request<
      TExpressMock["requestParameter"],
      TExpressMock["responseBody"],
      TExpressMock["requestBody"],
      TExpressMock["requestQuery"]
    >;
  };

export type ExpressMockPayload<TExpressMock extends ExpressMock<ExpressPluginApiDefinition<string, string>>> = {
  endpointName: TExpressMock["endpointName"];
  handlers: ((
    request: Request<
      TExpressMock["requestParameter"],
      TExpressMock["responseBody"],
      TExpressMock["requestBody"],
      TExpressMock["requestQuery"]
    >,
    response: Response<TExpressMock["responseBody"]>,
    next: NextFunction,
  ) => Promise<void> | void)[][];
};

export enum ExpressHookName {
  routesCleared = "routesCleared",
  globalMiddlewareAdded = "globalMiddlewareAdded",
  serverListening = "serverListening",
  serverClosed = "serverClosed",
  mockHandlerCreationStarted = "mockHandlerCreationStarted",
  mockHandlerCreationFinished = "mockHandlerCreationFinished",
  mockHandlerExecutionStarted = "mockHandlerExecutionStarted",
  mockHandlerExecutionFinished = "mockHandlerExecutionFinished",
  mockWithoutDefintitionFailed = "mockWithoutDefintitionFailed",
  mockHandlersUsageExceeded = "mockHandlersUsageExceeded",
}
export type ExpressHookDefinition =
  | HookDefinition<ExpressHookName.routesCleared, {}>
  | HookDefinition<ExpressHookName.globalMiddlewareAdded, { middlewareName: string }>
  | HookDefinition<ExpressHookName.serverListening, { port: number }>
  | HookDefinition<ExpressHookName.serverClosed, {}>
  | HookDefinition<
      ExpressHookName.mockHandlerCreationStarted,
      {
        payload: ExpressMockPayload<any>;
        mock: ExpressMockDefinitions<any> & { url: string };
      }
    >
  | HookDefinition<
      ExpressHookName.mockHandlerCreationFinished,
      {
        payload: ExpressMockPayload<any>;
        mock: ExpressMockDefinitions<any> & { url: string };
      }
    >
  | HookDefinition<
      ExpressHookName.mockHandlerExecutionStarted,
      {
        payload: ExpressMockPayload<any>;
        mock: ExpressMockDefinitions<any> & { url: string };
        index: number;
        req: Request;
        res: Response;
      }
    >
  | HookDefinition<
      ExpressHookName.mockHandlerExecutionFinished,
      {
        payload: ExpressMockPayload<any>;
        mock: ExpressMockDefinitions<any> & { url: string };
        index: number;
        req: Request;
        res: Response;
      }
    >
  | HookDefinition<ExpressHookName.mockWithoutDefintitionFailed, {}>
  | HookDefinition<
      ExpressHookName.mockHandlersUsageExceeded,
      {
        payload: ExpressMockPayload<any>;
        mock: ExpressMockDefinitions<any> & { url: string };
        index: number;
        req: Request;
        res: Response;
      }
    >;
export interface ExpressState<TExpressMock extends ExpressMock<ExpressPluginApiDefinition<string, string>>> {
  mockDefinitions: (ExpressMockDefinitions<TExpressMock> & ExpressMockPayload<TExpressMock>)[];
  executions: ExpressMockExecution<TExpressMock>[];
  globalState: {
    express: Express;
    server: Server;
    router: Router;
  };
}
/**
 *
 *               logger.plugin(EXPRESS_PLUG, "routes cleared");
            logger.plugin(EXPRESS_PLUG, "global middleware added: not found handler");
            logger.plugin(EXPRESS_PLUG, "global middleware added: error handler");
          logger.plugin(EXPRESS_PLUG, `plugin listening on port: ${config.port}`);
          logger.plugin(EXPRESS_PLUG, "server closed");
 */

export interface ExpressActions<TExpressMock extends ExpressMock<ExpressPluginApiDefinition<string, string>>>
  extends PluginAction<string, any, any> {
  expressMock: (
    payload: ExpressMockPayload<TExpressMock> & {
      apiDefinition?: ExpressMockDefinitions<ExpressPluginApiDefinition<string, string>>;
    },
  ) => Promise<void>;
  expressGetMock: <
    TPayloadEndpointName extends TExpressMock["endpointName"],
    TPath extends
      | DotNotation<
          ExpressMockPayload<TExpressMock> &
            ExpressMockDefinitions<TExpressMock> & { endpointName: TPayloadEndpointName }
        >
      | "handlers",
  >(payload: {
    endpointName: TPayloadEndpointName;
    paths?: TPath[];
  }) => ExpressMockPayload<TExpressMock> &
    ExpressMockDefinitions<TExpressMock> & { endpointName: TExpressMock["endpointName"] };
  expressGetExecutions: <
    TPayloadEndpointName extends TExpressMock["endpointName"],
    TPath extends DotNotation<ExpressMockExecution<TExpressMock> & { endpointName: TExpressMock["endpointName"] }>,
  >(payload: {
    endpointName: TPayloadEndpointName;
    paths?: TPath[];
  }) => ExpressMockExecution<TExpressMock>[];
}
export interface ExpressPlugin<TExpressMock extends ExpressMock<ExpressPluginApiDefinition<string, string>>>
  extends Plugin<
    typeof EXPRESS_PLUG,
    ExpressState<TExpressMock>,
    ExpressActions<TExpressMock>,
    ExpressHookDefinition | StorytellerHookDefinition
  > {}

export interface ExpressValueObject<TExpressMock extends ExpressMock<ExpressPluginApiDefinition<string, string>>>
  extends ValueObject<Status.forged, ExpressHookDefinition | StorytellerHookDefinition, ExpressPlugin<TExpressMock>> {}
