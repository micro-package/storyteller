/* eslint-disable no-console */
import type { Server } from "http";
import type { Connection, Server as WebsocketServer } from "sockjs";
import { createServer } from "sockjs";
import { logger } from "./logger";
import type { EventDispatcher } from "./event-dispatcher";
import { eventValidator } from "../app/event";
import type { Authorizer, jsonWebTokenPayloadValidator } from "./authorizer";
import { UserType } from "./authorizer";
import type { zod } from "./zod";

export enum Headers {
  "xAccessToken" = "x-access-token",
}
export interface ConnectionHeaders {
  [Headers.xAccessToken]?: string;
}

export type WebsocketConnection = Connection & {
  headers: ConnectionHeaders;
  jsonWebTokenPayload: zod.infer<typeof jsonWebTokenPayloadValidator>;
};

export interface ServerWebsocket {
  websocketServer: WebsocketServer;
  getPanelConnections: () => WebsocketConnection[];
  getStorytellerConnections: () => WebsocketConnection[];
}

export const createServerWebsocket = (
  serverHttp: Server,
  eventDispatcher: EventDispatcher,
  authorizer: Authorizer,
): ServerWebsocket => {
  const connections: WebsocketConnection[] = [];
  const websocketServer = createServer({
    websocket: true,
  });
  websocketServer.on("connection", (connection: WebsocketConnection) => {
    const authorizationResult = authorizer.authorize({
      accessToken: connection.headers[Headers.xAccessToken],
    });
    if (authorizationResult.success === false) {
      connection.close();
      return;
    }
    connection.jsonWebTokenPayload = authorizationResult.jsonWebTokenPayload;
    logger.debug("CLI server", `Connection established with [${connection.id}]`);
    connections.push(connection);
    connection.on("data", async (message) => {
      const parsedMessage: { success: true; message: any } | { success: false; error: Error } = (() => {
        try {
          return { success: true, message: JSON.parse(message) };
        } catch (error) {
          return { success: false, error };
        }
      })();
      if (parsedMessage.success === false) {
        logger.debug("CLI server", `invalid message received [${connection.id}] ${message} - must be json`);
        return;
      }
      const eventValidationResult = eventValidator.safeParse(JSON.parse(message));
      if (eventValidationResult.success === false) {
        logger.debug(
          "CLI server",
          `invalid message received [${connection.id}] ${message} - must have event structure`,
        );
        return;
      }
      await eventDispatcher.dispatch(eventValidationResult.data);
      logger.debug("CLI server", `message received [${connection.id}] ${message}`);
    });
    connection.on("close", () => {
      connection.close();
      const indexToDelete = connections.findIndex(({ id }) => id === connection.id);
      if (indexToDelete !== -1) {
        connections.splice(indexToDelete, 1);
      }
      logger.debug("CLI server", `Connection closed with [${connection.id}]`);
    });
  });

  websocketServer.installHandlers(serverHttp, { prefix: "/websocket" });
  return {
    websocketServer,
    getPanelConnections: () =>
      connections.filter((connection) => connection.jsonWebTokenPayload.userType === UserType.panel),
    getStorytellerConnections: () =>
      connections.filter((connection) => connection.jsonWebTokenPayload.userType === UserType.storyteller),
  };
};
