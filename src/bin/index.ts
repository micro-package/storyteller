#! /usr/bin/env node

import { logger } from "./shared/logger";
import { container } from "./shared/container";

const port = 8010;
Object.keys(container.cradle).forEach((name) => container.resolve(name));
void new Promise((resolve) =>
  container.resolve("serverHttp").listen(port, () => {
    logger.debug("CLI server", `Server listening on port ${port}`);
    resolve(undefined);
  }),
);
