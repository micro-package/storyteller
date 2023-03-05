import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import type HTTPMethod from "http-method-enum";
import type { DotNotation } from "../../common/dot-notation";
import type { HookDefinition } from "../../container/hook";
import type { Plugin, PluginAction } from "../../container/plugin";
import type { Status, ValueObject } from "../../container/value-object";
import type { StorytellerHookDefinition } from "../storyteller/types";
import type { AXIOS_PLUG } from "./name";

export interface AxiosPluginApiDefinition<TApiName extends string, TEndpointName extends string> {
  apiName: TApiName;
  endpointName: TEndpointName;
}

export type AxiosPluginRequest<TApiDefinition extends AxiosPluginApiDefinition<string, string>> = Pick<
  TApiDefinition,
  keyof AxiosPluginApiDefinition<string, string>
> & {
  requestData: any;
  requestHeaders: any;
  requestQueryParams: any;
  responseData: any;
};

export type AxiosApiDefinition<TApiDefinition extends AxiosPluginApiDefinition<string, string>> = Pick<
  TApiDefinition,
  keyof AxiosPluginApiDefinition<string, string>
> & {
  method: HTTPMethod;
  url: string;
};

export type AxiosPluginResponse<
  TAxiosPluginRequest extends AxiosPluginRequest<AxiosPluginApiDefinition<string, string>>,
> = AxiosApiDefinition<TAxiosPluginRequest> & {
  response: AxiosResponse<
    TAxiosPluginRequest["responseData"],
    TAxiosPluginRequest["requestData"] & { headers: TAxiosPluginRequest["requestHeaders"] }
  >;
};

export enum AxiosHookName {
  axiosRequestStarted = "axiosRequestStarted",
  axiosRequestConfigured = "axiosRequestConfigured",
  axiosRequestFinished = "axiosRequestFinished",
  axiosRequestErrored = "axiosRequestErrored",
}

export type AxiosHookDefinition<
  TAxiosPluginRequest extends AxiosPluginRequest<AxiosPluginApiDefinition<string, string>>,
> =
  | HookDefinition<
      AxiosHookName.axiosRequestStarted,
      { apiDefinition: AxiosApiDefinition<AxiosPluginApiDefinition<string, string>> }
    >
  | HookDefinition<
      AxiosHookName.axiosRequestConfigured,
      { config: AxiosRequestConfig<any>; apiDefinition: AxiosApiDefinition<AxiosPluginApiDefinition<string, string>> }
    >
  | HookDefinition<AxiosHookName.axiosRequestFinished, AxiosPluginResponse<TAxiosPluginRequest>>
  | HookDefinition<
      AxiosHookName.axiosRequestErrored,
      { error: Error; apiDefinition: AxiosApiDefinition<AxiosPluginApiDefinition<string, string>> }
    >;

export interface AxiosState<TAxiosPluginRequest extends AxiosPluginRequest<AxiosPluginApiDefinition<string, string>>> {
  axios: AxiosInstance;
  responses: AxiosPluginResponse<TAxiosPluginRequest>[];
}

export interface AxiosActions<
  TAxiosPluginRequest extends AxiosPluginRequest<AxiosPluginApiDefinition<string, string>>,
  TAxiosApiDefinition extends AxiosApiDefinition<TAxiosPluginRequest>,
> extends PluginAction<any, any, any> {
  axiosRequest: <TAxiosEndpointName extends TAxiosPluginRequest["endpointName"]>(payload: {
    endpointName: TAxiosEndpointName;
    config: (payload: TAxiosApiDefinition) => Promise<
      (keyof (TAxiosPluginRequest & { endpointName: TAxiosEndpointName })["requestData"] extends never
        ? AxiosRequestConfig<(TAxiosPluginRequest & { endpointName: TAxiosEndpointName })["requestData"]>
        : Required<
            Pick<
              AxiosRequestConfig<(TAxiosPluginRequest & { endpointName: TAxiosEndpointName })["requestData"]>,
              "data"
            >
          >) &
        (keyof (TAxiosPluginRequest & { endpointName: TAxiosEndpointName })["requestHeaders"] extends never
          ? {}
          : {
              headers: (TAxiosPluginRequest & { endpointName: TAxiosEndpointName })["requestHeaders"];
            }) &
        (keyof (TAxiosPluginRequest & { endpointName: TAxiosEndpointName })["requestQueryParams"] extends never
          ? {}
          : {
              params: (TAxiosPluginRequest & { endpointName: TAxiosEndpointName })["requestQueryParams"];
            })
    >;
  }) => Promise<AxiosPluginResponse<TAxiosPluginRequest & { endpointName: TAxiosEndpointName }>>;
  axiosGetResponses: <
    TAxiosEndpointName extends TAxiosPluginRequest["endpointName"],
    TPath extends DotNotation<AxiosPluginResponse<TAxiosPluginRequest & { endpointName: TAxiosEndpointName }>>,
  >(payload: {
    endpointName: TAxiosEndpointName;
    paths?: TPath[];
  }) => AxiosPluginResponse<TAxiosPluginRequest & { endpointName: TAxiosEndpointName }>[];
}

export interface AxiosPlugin<
  TAxiosPluginRequest extends AxiosPluginRequest<AxiosPluginApiDefinition<string, string>>,
  TAxiosApiDefinition extends AxiosApiDefinition<TAxiosPluginRequest>,
> extends Plugin<
    typeof AXIOS_PLUG,
    AxiosState<TAxiosPluginRequest>,
    AxiosActions<TAxiosPluginRequest, TAxiosApiDefinition>,
    AxiosHookDefinition<TAxiosPluginRequest> | StorytellerHookDefinition
  > {}
export interface AxiosValueObject<
  TAxiosPluginRequest extends AxiosPluginRequest<AxiosPluginApiDefinition<string, string>>,
  TAxiosApiDefinition extends AxiosApiDefinition<TAxiosPluginRequest>,
> extends ValueObject<
    Status.forged,
    AxiosHookDefinition<TAxiosPluginRequest> | StorytellerHookDefinition,
    AxiosPlugin<TAxiosPluginRequest, TAxiosApiDefinition>
  > {}
