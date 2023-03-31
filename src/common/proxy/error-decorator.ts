import type { OnErrorPayload } from "generic-interceptor";
import { interceptor } from "generic-interceptor";

interface Options {
  dependencyName: string;
}

export const buildMessage = (payload: OnErrorPayload, options: Options) =>
  `${options.dependencyName}.${payload.fieldKey} > `;

export const errorDecoratorProxyHandler = (options: Options) =>
  interceptor({
    onBefore: () => {},
    onSuccess: () => {},
    onNonFunction: () => {},
    onError: (payload) => {
      // eslint-disable-next-line no-restricted-globals
      (payload.functionError as Error & { decoration: string }).decoration = buildMessage(payload, options);
      return payload.functionError;
    },
  });
