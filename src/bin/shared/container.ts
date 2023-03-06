import * as awilix from "awilix";
import { commandStartTestContainer } from "../app/commands/start-test-container.command";
import { commandStoreStorytellerEvent } from "../app/commands/store-storyteller-event.command";
import { eventSubscriberStorage } from "../app/event-subscribers/storage.subscriber";
import { authorizer } from "./authorizer";
import { createCommandBus } from "./command-bus";
import { createEventDispatcher } from "./event-dispatcher";
import { integrationCLI } from "./integration/cli";
import { createServerHttp } from "./server-http";
import { createServerWebsocket } from "./server-websocket";

export const asArray = <T>(resolvers: awilix.Resolver<T>[]): awilix.Resolver<T[]> => ({
  resolve: (container) => resolvers.map((resolver) => container.build(resolver)),
});

export const container = awilix.createContainer({ injectionMode: awilix.InjectionMode.CLASSIC });
container.register({
  serverHttp: awilix.asFunction(createServerHttp).singleton(),
  subscribers: asArray<any>([awilix.asFunction(eventSubscriberStorage)]),
  commandHandlers: asArray<any>([
    awilix.asFunction(commandStoreStorytellerEvent),
    awilix.asFunction(commandStartTestContainer),
  ]),
  commandBus: awilix.asFunction(createCommandBus).singleton(),
  eventDispatcher: awilix.asFunction(createEventDispatcher).singleton(),
  serverWebsocket: awilix.asFunction(createServerWebsocket).singleton(),
  integrationCLI: awilix.asFunction(integrationCLI),
  authorizer: awilix.asFunction(authorizer),
});
