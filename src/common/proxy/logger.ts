import type { OnErrorPayload, OnSuccessPayload, OnNonFunctionPayload } from "generic-interceptor";
import { interceptor, ProcessingResult } from "generic-interceptor";
import type { LoggingLevel } from "../enum";
import { logger } from "../logger";
import { secureJsonStringify } from "../parser/secure-json";

export interface Options {
  dependencyName: string;
  loggerLevel: LoggingLevel.debug | LoggingLevel.plugin;
}

export const buildFunctionMessage = (payload: OnErrorPayload | OnSuccessPayload) =>
  `(${secureJsonStringify(payload.functionArgs)}) => ${payload.processingStrategy}#${
    payload.processingResult
  }:${secureJsonStringify(
    payload.processingResult === ProcessingResult.failed ? payload.functionError : payload.functionResult,
  )}`;

export const buildMessage = (payload: OnErrorPayload | OnSuccessPayload | OnNonFunctionPayload, options: Options) =>
  `${options.dependencyName}.<${payload.fieldValueType}>${String(payload.fieldKey)}${
    "processingResult" in payload ? buildFunctionMessage(payload) : ""
  }`;

export const loggerProxyHandler = (options: Options): ProxyHandler<any> => {
  return interceptor({
    onError: (payload) => {
      logger[options.loggerLevel]("interceptor", buildMessage(payload, options));
    },
    onSuccess: (payload) => {
      logger[options.loggerLevel]("interceptor", buildMessage(payload, options));
    },
    onNonFunction: () => {},
  });
};
