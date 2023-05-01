import type { DataSource, EntityManager } from "typeorm";
import { inspect } from "util";
import { errorPlugin } from "../../common/error";
import { logger } from "../../common/logger";
import { createPlugin } from "../../container/plugin";
import { StorytellerHookName } from "../storyteller/types";
import type { StorytellerHookDefinition } from "../storyteller/types";
import { TYPEORM_PLUG } from "./name";
import type {
  TypeormActions,
  TypeormDataSource,
  TypeormHookDefinition,
  TypeormPlugin,
  TypeormValueObject,
} from "./types";
import { TypeormPluginLogger } from "./logger";

export const typeormPlugin = <TDataSourceName extends string>(config: {
  dataSources: TypeormDataSource<TDataSourceName>[];
}) =>
  createPlugin<
    typeof TYPEORM_PLUG,
    TypeormActions<TDataSourceName>,
    TypeormHookDefinition | StorytellerHookDefinition,
    TypeormPlugin<TDataSourceName>
  >({
    name: TYPEORM_PLUG,
    state: {
      globalState: {
        dataSources: config.dataSources,
      },
      dataSourceChains: [],
    },
    actions: {
      typeormGetManager: (valueObject: TypeormValueObject<TDataSourceName>) => (payload) => {
        const container = valueObject
          .getPlugin(TYPEORM_PLUG)
          .state.globalState.dataSources.find(({ name }) => payload.name === name);
        if (container === undefined) {
          throw errorPlugin("missing data source");
        }
        return container.dataSource.manager;
      },
      typeormGetChains: (valueObject: TypeormValueObject<TDataSourceName>) => (payload) =>
        valueObject
          .getPlugin(TYPEORM_PLUG)
          .state.dataSourceChains.filter(({ name }) => name === payload.name)
          .map(({ chains }) => chains),
    },
    hooks: [
      {
        name: StorytellerHookName.storytellerFinished,
        handler: (valueObject: TypeormValueObject<TDataSourceName>) => async () => {
          const result = await Promise.allSettled(
            valueObject
              .getPlugin(TYPEORM_PLUG)
              .state.globalState.dataSources.map(async (container) => container.dataSource.destroy()),
          );
          result.forEach((element, index) => {
            if (element.status === "fulfilled") {
              logger.plugin(
                TYPEORM_PLUG,
                `Connection to '${
                  valueObject.getPlugin(TYPEORM_PLUG).state.globalState.dataSources[index].name
                }' destroyed`,
              );
            } else {
              logger.plugin(
                TYPEORM_PLUG,
                `Connection to '${
                  valueObject.getPlugin(TYPEORM_PLUG).state.globalState.dataSources[index].name
                }' could not be destroyed: ${inspect(element.reason)}`,
              );
            }
          });
        },
      },
      {
        name: StorytellerHookName.storytellerCreated,
        handler: (valueObject: TypeormValueObject<TDataSourceName>) => async () => {
          const connections = await Promise.allSettled(
            valueObject
              .getPlugin(TYPEORM_PLUG)
              .state.globalState.dataSources.map((dataSource) =>
                dataSource.dataSource
                  .setOptions({ logger: new TypeormPluginLogger(valueObject, dataSource) })
                  .initialize(),
              ),
          );
          connections.forEach((connection, index) =>
            logger.plugin(
              TYPEORM_PLUG,
              `Connection to '${
                valueObject.getPlugin(TYPEORM_PLUG).state.globalState.dataSources[index].name
              }' data source settled - ${connection.status}${
                connection.status === "fulfilled"
                  ? `: isInitialized - ${connection.value.isInitialized}`
                  : `: ${connection.reason}`
              }`,
            ),
          );
          if (connections.some(({ status }) => status === "rejected")) {
            throw errorPlugin(
              "could not establish connection to all data sources",
              connections.filter(({ status }) => status === "rejected"),
            );
          }
          valueObject.getPlugin(TYPEORM_PLUG).state.globalState.dataSources = await Promise.all(
            valueObject.getPlugin(TYPEORM_PLUG).state.globalState.dataSources.map(({ name }, index) => {
              const matchingConnection: PromiseSettledResult<DataSource> = connections[index];
              if (matchingConnection.status === "rejected") {
                throw errorPlugin("could not establish connection to all data sources", matchingConnection);
              }
              return { name, dataSource: matchingConnection.value };
            }),
          );
          const typeormTracker = (
            dataSourceName: TDataSourceName,
            manager: EntityManager,
            root: boolean,
          ): TypeormDataSource<TDataSourceName> =>
            Object.getOwnPropertyNames(Object.getPrototypeOf(manager)).reduce(
              (acc, name) => ({
                ...acc,
                //@ts-ignore
                [name]:
                  //@ts-ignore
                  typeof manager[name] !== "function"
                    ? //@ts-ignore
                      manager[name]
                    : (...args: any) => {
                        const chainIndex =
                          valueObject.getPlugin(TYPEORM_PLUG).state.dataSourceChains.length - (root === true ? 0 : 1);
                        if (valueObject.getPlugin(TYPEORM_PLUG).state.dataSourceChains[chainIndex] === undefined) {
                          valueObject.getPlugin(TYPEORM_PLUG).state.dataSourceChains[chainIndex] = {
                            name: dataSourceName,
                            chains: [],
                          };
                          logger.plugin(
                            TYPEORM_PLUG,
                            `${dataSourceName}.${name}(${args.map((arg: any) => inspect(arg)).join(",")})`,
                          );
                        } else {
                          logger.plugin(
                            TYPEORM_PLUG,
                            `${Array.from({ length: `${dataSourceName}`.length + 2 }).join(" ")} .${name}(${args
                              .map((arg: any) => inspect(arg))
                              .join(",")})`,
                          );
                        }
                        valueObject
                          .getPlugin(TYPEORM_PLUG)
                          .state.dataSourceChains[chainIndex].chains.push({ name, args });
                        //@ts-ignore
                        const result = manager[name].bind(manager)(...args);
                        if (result instanceof Promise) {
                          return result;
                        }
                        return typeormTracker(dataSourceName, result, false);
                      },
              }),
              {} as any,
            );
          valueObject.getPlugin(TYPEORM_PLUG).state.globalState.dataSources = valueObject
            .getPlugin(TYPEORM_PLUG)
            .state.globalState.dataSources.map((container) => ({
              name: container.name,
              dataSource: Object.assign(container.dataSource, {
                manager: typeormTracker(container.name, container.dataSource.manager, true),
              }),
            }));
        },
      },
    ],
  });
