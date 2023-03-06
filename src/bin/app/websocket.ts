/* eslint-disable no-console */
import type { Server } from "http";
import { createServer } from "sockjs";
import { logger } from "../shared/logger";
import type { EventDispatcher } from "./event-dispatcher";
import { eventValidator } from "./validators";

export const createWebsocketServer = (config: { httpServer: Server; eventDispatcher: EventDispatcher }) => {
  const websocketServer = createServer({
    websocket: true,
  });
  websocketServer.on("connection", (connection) => {
    logger.debug("CLI server", `Connection established with [${connection.id}]`);
    connection.on("data", async (message) => {
      const eventValidationResult = eventValidator.safeParse(JSON.parse(message));
      if (eventValidationResult.success === false) {
        logger.debug("CLI server", `invalid message received [${connection.id}] ${message}`);
        return;
      }
      await config.eventDispatcher.dispatch(eventValidationResult.data);
      logger.debug("CLI server", `message received [${connection.id}] ${message}`);
    });
    connection.on("close", () => {
      // connection.close();
      logger.debug("CLI server", `Connection closed with [${connection.id}]`);
    });
  });

  websocketServer.installHandlers(config.httpServer, { prefix: "/websocket" });
};
