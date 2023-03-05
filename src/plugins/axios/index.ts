import axios from "axios";
import { pick } from "lodash";
import { buildEndpointDescription } from "../../common/endpoint-descriptor";
import { errorPlugin } from "../../common/error";
import { logger } from "../../common/logger";
import { createPlugin } from "../../container/plugin";
import { STORYTELLER_PLUG } from "../storyteller/name";
import type { StorytellerHookDefinition, StorytellerValueObject } from "../storyteller/types";
import { AXIOS_PLUG } from "./name";
import type {
  ApiDefinition,
  AxiosActions,
  AxiosApiDefinition,
  AxiosHookDefinition,
  AxiosPlugin,
  AxiosPluginRequest,
  AxiosPluginResponse,
  AxiosValueObject,
} from "./types";
import { AxiosHookName } from "./types";

export const axiosPlugin = <TAxiosPluginRequest extends AxiosPluginRequest<ApiDefinition<string, string>>>(config: {
  apiDefinitions: (TAxiosPluginRequest extends infer UAxiosPluginRequest extends AxiosPluginRequest<
    ApiDefinition<string, string>
  >
    ? AxiosApiDefinition<UAxiosPluginRequest>
    : never)[];
}) => {
  const nonUniquePluginNames = config.apiDefinitions
    .map(({ endpointName }) => endpointName)
    .filter((e, i, a) => a.indexOf(e) !== i);
  if (nonUniquePluginNames.length > 0) {
    throw errorPlugin("api definitions endpoint name must be unique in each definition", nonUniquePluginNames);
  }
  return createPlugin<
    typeof AXIOS_PLUG,
    AxiosActions<
      TAxiosPluginRequest,
      TAxiosPluginRequest extends infer UAxiosPluginRequest extends AxiosPluginRequest<ApiDefinition<string, string>>
        ? AxiosApiDefinition<UAxiosPluginRequest>
        : never
    >,
    AxiosHookDefinition<TAxiosPluginRequest> | StorytellerHookDefinition,
    AxiosPlugin<TAxiosPluginRequest, AxiosApiDefinition<TAxiosPluginRequest>>
  >({
    name: AXIOS_PLUG,
    requiredPlugins: [STORYTELLER_PLUG],
    state: { axios: axios.create({ validateStatus: () => true }), responses: [] },
    actions: {
      axiosGetResponses:
        (valueObject: AxiosValueObject<TAxiosPluginRequest, AxiosApiDefinition<TAxiosPluginRequest>>) => (payload) =>
          valueObject
            .getPlugin(AXIOS_PLUG)
            .state.responses.filter((response) => response.endpointName === payload.endpointName)
            .map((response) => (payload.paths === undefined ? response : pick(response, payload.paths))) as any,
      axiosRequest:
        (
          valueObject: AxiosValueObject<TAxiosPluginRequest, AxiosApiDefinition<TAxiosPluginRequest>> &
            StorytellerValueObject<string>,
        ) =>
        async (payload) => {
          const apiDefinition = config.apiDefinitions.find(({ endpointName }) => endpointName === payload.endpointName);
          if (apiDefinition === undefined) {
            throw errorPlugin("missing api definition", {
              received: config.apiDefinitions.map(({ endpointName }) => endpointName),
              expected: payload.endpointName,
            });
          }
          await valueObject.runHooks({
            name: AxiosHookName.axiosRequestStarted,
            payload: { apiDefinition },
          });
          const axiosConfig = await payload.config(apiDefinition as any);
          await valueObject.runHooks({
            name: AxiosHookName.axiosRequestConfigured,
            payload: { apiDefinition, config: axiosConfig },
          });
          try {
            const response = await valueObject.getPlugin(AXIOS_PLUG).state.axios({ ...apiDefinition, ...axiosConfig });
            //! this await for 10ms ensure that each axios request will not execute at the same time (so if some data is saved in database, createdAt will not be the same)
            await new Promise((resolve) => setTimeout(resolve, 10));
            const pluginResponse: AxiosPluginResponse<TAxiosPluginRequest> = { response, ...apiDefinition };
            valueObject.getPlugin(AXIOS_PLUG).state.responses.push({ response, ...apiDefinition });
            await valueObject.runHooks({ name: AxiosHookName.axiosRequestFinished, payload: pluginResponse });
            return pluginResponse as any;
          } catch (error) {
            await valueObject.runHooks({
              name: AxiosHookName.axiosRequestErrored,
              payload: { error, apiDefinition },
            });
            throw error;
          }
        },
    },
    hooks: [
      {
        name: AxiosHookName.axiosRequestStarted,
        handler: () => async (payload) => {
          logger.ascent(AXIOS_PLUG, `request started ${buildEndpointDescription(payload.apiDefinition)}`);
        },
      },
      {
        name: AxiosHookName.axiosRequestFinished,
        handler: () => async (payload) => {
          logger.descent(
            AXIOS_PLUG,
            `request finished ${payload.response.status} ${buildEndpointDescription(payload)}`,
          );
        },
      },
      {
        name: AxiosHookName.axiosRequestErrored,
        handler: () => async (payload) => {
          logger.descent(
            AXIOS_PLUG,
            `request errored ${payload.error.message} ${buildEndpointDescription(payload.apiDefinition)}`,
          );
          throw errorPlugin("request errored", payload);
        },
      },
    ],
  });
};
