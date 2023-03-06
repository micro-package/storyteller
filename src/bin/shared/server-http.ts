import { createServer } from "http";
import { StatusCodes } from "http-status-codes";

export const createServerHttp = () => {
  const httpServer = createServer((req, res) => {
    if (req.url?.includes("client") === true) {
      res.writeHead(StatusCodes.NOT_IMPLEMENTED);
      res.end();
      return;
    }
    res.writeHead(StatusCodes.NOT_FOUND);
    res.end();
  });

  return httpServer;
};
