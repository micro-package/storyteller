import { createServer } from "http";
import { StatusCodes } from "http-status-codes";
import { inspect } from "util";
import { eventSubscriberStorage } from "../app/event-subscribers/storage.subscriber";
import { logger } from "../shared/logger";
import { createEventDispatcher } from "./event-dispatcher";
import { createWebsocketServer } from "./websocket";

export const createHttpServer = async (config: { port: number }) => {
  logger.debug("CLI server", `Server starting with config ${inspect(config.port)}`);
  const httpServer = createServer((req, res) => {
    if (req.url?.includes("client") === true) {
      res.writeHead(StatusCodes.NOT_IMPLEMENTED);
      res.end();
      return;
    }
    res.writeHead(StatusCodes.NOT_FOUND);
    res.end();
  });
  const eventDispatcher = createEventDispatcher({
    subscribers: [eventSubscriberStorage()],
  });
  createWebsocketServer({ httpServer, eventDispatcher });
  await new Promise((resolve) => httpServer.listen(config.port, () => resolve(undefined)));
  logger.debug("CLI server", `Server listening on port ${config.port}`);
};
void createHttpServer({ port: 8010 });
