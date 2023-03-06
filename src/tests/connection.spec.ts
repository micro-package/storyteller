import type { connection as Connection } from "websocket";
import { client } from "websocket";
import { logger } from "../bin/shared/logger";
const websocket = new client({});

jest.setTimeout(1000 * 1000);

it("websocket connection", async () => {
  const connection: Connection = await new Promise((resolve) =>
    websocket.on("connect", (conn) => {
      logger.debug("connection opened");
      resolve(conn);
    }),
  );
  setTimeout(() => connection.close(), 1000 * 15);
  connection.on("message", (message) => logger.debug("connection message received", message));
  connection.on("close", (code) => logger.debug(`connection closed - ${code}`));
});

websocket.connect("http://localhost:8010/websocket/websocket");
