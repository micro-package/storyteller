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

export interface ApiDefinition<TApiName extends string, TEndpointName extends string> {
  apiName: TApiName;
  endpointName: TEndpointName;
}
export type ExpressMockDefinitions<TApiDefinition extends ApiDefinition<string, string>> = Pick<
  TApiDefinition,
  keyof ApiDefinition<string, string>
> & {
  method: HTTPMethod;
  url: string;
};

export type ExpressMock<TApiDefinition extends ApiDefinition<string, string>> = TApiDefinition & {
  requestParameter: ParamsDictionary;
  responseBody: any;
  requestBody: any;
  requestQuery: ParsedQs;
};

export type ExpressMockExecution<TExpressMock extends ExpressMock<ApiDefinition<string, string>>> =
  ExpressMockDefinitions<TExpressMock> & {
    response: Response<TExpressMock["responseBody"]>;
    request: Request<
      TExpressMock["requestParameter"],
      TExpressMock["responseBody"],
      TExpressMock["requestBody"],
      TExpressMock["requestQuery"]
    >;
  };

export type ExpressMockPayload<TExpressMock extends ExpressMock<ApiDefinition<string, string>>> = {
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

export enum ExpressHookName {}
export type ExpressHookDefinition = never;
export interface ExpressState<TExpressMock extends ExpressMock<ApiDefinition<string, string>>> {
  mockDefinitions: (ExpressMockDefinitions<TExpressMock> & ExpressMockPayload<TExpressMock>)[];
  executions: ExpressMockExecution<TExpressMock>[];
  globalState: {
    express: Express;
    server: Server;
    router: Router;
  };
}

export interface ExpressActions<TExpressMock extends ExpressMock<ApiDefinition<string, string>>>
  extends PluginAction<string, any, any> {
  expressMock: (
    payload: ExpressMockPayload<TExpressMock> & {
      apiDefinition?: ExpressMockDefinitions<ApiDefinition<string, string>>;
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
export interface ExpressPlugin<TExpressMock extends ExpressMock<ApiDefinition<string, string>>>
  extends Plugin<
    typeof EXPRESS_PLUG,
    ExpressState<TExpressMock>,
    ExpressActions<TExpressMock>,
    ExpressHookDefinition | StorytellerHookDefinition
  > {}

export interface ExpressValueObject<TExpressMock extends ExpressMock<ApiDefinition<string, string>>>
  extends ValueObject<Status.forged, ExpressHookDefinition | StorytellerHookDefinition, ExpressPlugin<TExpressMock>> {}
