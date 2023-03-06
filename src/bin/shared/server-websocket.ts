/* eslint-disable no-console */
import type { Server } from "http";
import { createServer } from "sockjs";
import { logger } from "./logger";
import type { EventDispatcher } from "./event-dispatcher";
import { eventValidator } from "../app/event";

export const createServerWebsocket = (serverHttp: Server, eventDispatcher: EventDispatcher) => {
  const websocketServer = createServer({
    websocket: true,
  });
  websocketServer.on("connection", (connection) => {
    logger.debug("CLI server", `Connection established with [${connection.id}]`);
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
      // connection.close();
      logger.debug("CLI server", `Connection closed with [${connection.id}]`);
    });
  });

  websocketServer.installHandlers(serverHttp, { prefix: "/websocket" });
  return websocketServer;
};
