import { createLogger, format, transports } from "winston";
import { LEVEL } from "triple-beam";
import { errorTestFramework } from "./error";
import { secureJsonStringify } from "./parser/secure-json";
import { LoggingLevel, LoggingSource } from "./enum";
import type { Chalk } from "chalk";
import chalk from "chalk";
// import { EXPRESS_PLUG } from "../../express/src/name";
// import { AXIOS_PLUG } from "../../axios/src/name";
// import { STORYTELLER_PLUG } from "@micro-package/storyteller/.dist/name";
global.console = require("console");

const logLevelColorizer: { [key in LoggingLevel]: Chalk } = {
  [LoggingLevel.error]: chalk.red,
  [LoggingLevel.debug]: chalk.green,
  [LoggingLevel.descent]: chalk.blue,
  [LoggingLevel.plugin]: chalk.grey,
  [LoggingLevel.ascent]: chalk.blue,
};
const pluginNameColorizer: { [key: string]: Chalk } = {
  // [EXPRESS_PLUG]: chalk.magenta,
  // [AXIOS_PLUG]: chalk.cyan,
  // [STORYTELLER_PLUG]: chalk.italic,
};

const maxLoggingLevelNameLength =
  1 +
  [LoggingLevel, LoggingSource].reduce(
    (acc, currentValue) => acc + Object.values(currentValue).sort((a, b) => b.length - a.length)[0].length,
    0,
  );
export const winstonLogger = createLogger({
  level: LoggingLevel.plugin,
  levels: {
    [LoggingLevel.error]: 0,
    [LoggingLevel.descent]: 1,
    [LoggingLevel.ascent]: 2,
    [LoggingLevel.plugin]: 3,
    [LoggingLevel.debug]: 4,
  },
  format: format.combine(
    format.printf((info) => {
      const colorizer =
        pluginNameColorizer[info.sourceName] !== undefined
          ? pluginNameColorizer[info.sourceName]
          : logLevelColorizer[info.level as LoggingLevel] !== undefined
          ? logLevelColorizer[info.level as LoggingLevel]
          : chalk.underline;
      const colorizedSourceName = colorizer(
        `${info.sourceName.split("@")[0]} -`.padEnd(maxLoggingLevelNameLength, "-"),
      );
      info.message = `${colorizedSourceName} ${
        // info.sourceName === STORYTELLER_PLUG ? chalk.gray(info.message) :
        info.message
      }`;
      return info.message;
    }),
  ),
  transports: [
    new transports.Console({
      log(info, next) {
        switch (info[LEVEL]) {
          case LoggingLevel.ascent:
            // eslint-disable-next-line no-console
            console.group(info.message);
            break;
          case LoggingLevel.descent:
            // eslint-disable-next-line no-console
            console.groupEnd();
            // eslint-disable-next-line no-console
            console.log(info.message);
            break;
          case LoggingLevel.error:
          case LoggingLevel.debug:
          case LoggingLevel.plugin:
            // eslint-disable-next-line no-console
            console.log(info.message);
            break;
          default:
            throw errorTestFramework(`Inappropriate logging level: ${info.message}`);
        }
        next();
      },
    }),
  ],
});

export type Logger = { [key in LoggingLevel]: (sourceName: string, message: any) => void };

export const logger: Logger = Object.values(LoggingLevel).reduce(
  (acc: Logger, loggingLevel) => ({
    ...acc,
    [loggingLevel]: (sourceName: LoggingSource, message: any) =>
      winstonLogger[loggingLevel as keyof typeof winstonLogger](secureJsonStringify(message), { sourceName }),
  }),
  {} as Logger,
) as unknown as Logger;
