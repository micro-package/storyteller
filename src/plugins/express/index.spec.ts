/* eslint-disable no-console */
import { expressPlugin } from ".";
import HTTPMethod from "http-method-enum";
import { StatusCodes } from "http-status-codes";
import axios from "axios";
import { createValueObject, forgeValueObject } from "../../container/value-object";
import { expect } from "@jest/globals";
import { storytellerPlugin, compose, storytellerHelper } from "../storyteller";

enum ApiName {
  google = "google",
  api2 = "api2",
}

enum EndpointName {
  googleMainPage = "googleMainPage",
  otherEndpoint = "otherEndpoint",
}
const port = 5245;
const mockDefinitions = [
  {
    apiName: ApiName.google,
    endpointName: EndpointName.googleMainPage,
    method: HTTPMethod.GET,
    url: `http://localhost:${port}/main-page`,
  } as const,
  {
    apiName: ApiName.api2,
    endpointName: EndpointName.otherEndpoint,
    method: HTTPMethod.GET,
    url: `http://localhost:${port}/othe-endpoint`,
  } as const,
];

const testFramework = compose(
  createValueObject(),
  expressPlugin<
    | {
        apiName: ApiName.google;
        endpointName: EndpointName.googleMainPage;
        requestParameter: { paramMainPage: string };
        responseBody: {};
        requestBody: {};
        requestQuery: {};
      }
    | {
        apiName: ApiName.api2;
        endpointName: EndpointName.otherEndpoint;
        requestParameter: { paramOther: string };
        responseBody: {};
        requestBody: {};
        requestQuery: {};
      }
  >({
    port,
    mockDefinitions,
  }),
  storytellerPlugin({}),
  forgeValueObject({ debug: false }),
  storytellerHelper,
);

const realUrl = `${new URL(mockDefinitions[0].url).origin}/${ApiName.google}${
  new URL(mockDefinitions[0].url).pathname
}`;

describe("express plugin", () => {
  it("express perform request and store it correctly", async () => {
    await testFramework.createScenario({
      arrange: testFramework.createStep({
        name: "stepArrange",
        handler: async (valueObject) => {
          await valueObject.expressMock({
            endpointName: EndpointName.googleMainPage,
            handlers: [
              [
                (req, res) => {
                  //? headers object needs to be copied in order to not timeout while using `toStrictEqual` for some reason
                  expect({ ...req.headers }).toStrictEqual({
                    accept: "application/json, text/plain, */*",
                    "user-agent": expect.any(String),
                    "accept-encoding": "gzip, deflate, br",
                    host: expect.any(String),
                    connection: "close",
                  });
                  res.sendStatus(StatusCodes.OK);
                },
              ],
            ],
          });
        },
      }),
      act: testFramework.createStep({
        name: "stepAct",
        handler: async () => {
          await axios({
            url: realUrl,
          });
        },
      }),
      assert: testFramework.createStep({
        name: "stepAssert",
        handler: async (valueObject) => {
          const mock = valueObject.expressGetMock({ endpointName: EndpointName.googleMainPage });
          const executions = valueObject.expressGetExecutions({
            endpointName: EndpointName.googleMainPage,
            paths: ["response.statusCode"],
          });
          expect(executions).toStrictEqual([{ response: { statusCode: StatusCodes.OK } }]);
          expect(mock).toStrictEqual({
            ...mockDefinitions[0],
            url: realUrl,
            endpointName: EndpointName.googleMainPage,
            handlers: [[expect.any(Function)]],
          });
        },
      }),
    })();
  });
  it("second test identical to check if both will be executed successfully", async () => {
    await testFramework.createScenario({
      arrange: testFramework.createStep({
        name: "stepArrange",
        handler: async (valueObject) => {
          await valueObject.expressMock({
            endpointName: EndpointName.googleMainPage,
            handlers: [
              [
                (req, res) => {
                  expect({ ...req.headers }).toStrictEqual({
                    accept: "application/json, text/plain, */*",
                    "user-agent": expect.any(String),
                    "accept-encoding": "gzip, deflate, br",
                    host: expect.any(String),
                    connection: "close",
                  });
                  res.sendStatus(StatusCodes.OK);
                },
              ],
            ],
          });
        },
      }),
      act: testFramework.createStep({
        name: "stepAct",
        handler: async () => {
          await axios({
            url: realUrl,
          });
        },
      }),
      assert: testFramework.createStep({
        name: "stepAssert",
        handler: async (valueObject) => {
          const mock = valueObject.expressGetMock({ endpointName: EndpointName.googleMainPage });
          const executions = valueObject.expressGetExecutions({
            endpointName: EndpointName.googleMainPage,
            paths: ["response.statusCode"],
          });
          expect(executions).toStrictEqual([{ response: { statusCode: StatusCodes.OK } }]);
          expect(mock).toStrictEqual({
            ...mockDefinitions[0],
            url: realUrl,
            endpointName: EndpointName.googleMainPage,
            handlers: [[expect.any(Function)]],
          });
        },
      }),
    })();
  });
});
