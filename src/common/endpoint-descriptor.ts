import type HTTPMethod from "http-method-enum";

export const buildEndpointDescription = (config: {
  apiName: string;
  endpointName: string;
  url: string;
  method: HTTPMethod;
}) => `${config.apiName} ${config.endpointName} ${config.method} ${config.url}`;
