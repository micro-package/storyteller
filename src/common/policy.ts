import { inspect } from "util";

export const policyContinuationErrorPrefix = "POLICY CONTINUATION ERROR";
export const isPolicyContinuationToken = (error: any) => error.message.includes(policyContinuationErrorPrefix);
export const policyContinuationError = (data: any) =>
  // eslint-disable-next-line no-restricted-globals
  Error(`${policyContinuationErrorPrefix} ${inspect(data, false, Infinity)}`);
