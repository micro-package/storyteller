import { secureJsonStringify } from "./parser/secure-json";

const commonError = (message: string, data?: any) => Error(`${message}: ${secureJsonStringify(data)}`);

export const errorValueObject = (
  message:
    | "action name must starts with plugin name"
    | "missing plugin"
    | "mock handler called without step"
    | "cannot close server if not exists"
    | `missing ${"endpoint" | "mock"} action`,
  data?: any,
) => commonError(message, data);
export const errorTestFramework = (message: string, data?: any) => commonError(message, data);
export const errorPlugin = (
  message:
    | "cannot await running step functions"
    | "data source chains are missing"
    | "could not establish connection to all data sources"
    | "missing data source"
    | "story name couldn`t be received from test runner"
    | "handlers usage exceeded"
    | `${"api" | "mock"} definitions endpoint name must be unique in each definition`
    | "request errored"
    | "missing mock"
    | "missing mock definition"
    | "steps array is empty"
    | "missing plugin default state"
    | "missing endpoint action"
    | "missing mock route"
    | "step created without test"
    | "action executed without step"
    | "action executed without mock"
    | "mock handler called without step"
    | "missing api definition",
  data?: any,
) => commonError(message, data);
