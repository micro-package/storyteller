import { axiosPlugin } from ".";
import HTTPMethod from "http-method-enum";
import { expect } from "@jest/globals";
import { compose, storytellerHelper } from "../storyteller/index";
import { createValueObject, forgeValueObject } from "../../container/value-object";
import { storytellerPlugin } from "../storyteller";
enum ApiName {
  google = "google",
  api2 = "api2",
}

enum EndpointName {
  googleMainPage = "googleMainPage",
  otherEndpoint = "otherEndpoint",
}

enum StepName {
  stepArrange = "stepArrange",
  stepAct = "stepAct",
  stepAssert = "stepAssert",
}
const apiDefinitions = [
  {
    endpointName: EndpointName.googleMainPage,
    apiName: ApiName.google,
    method: HTTPMethod.GET,
    url: "http://google.com",
  } as const,
  {
    endpointName: EndpointName.otherEndpoint,
    apiName: ApiName.google,
    method: HTTPMethod.GET,
    url: "http://youtube.com",
  } as const,
];

const testFramework = compose(
  createValueObject(),
  storytellerPlugin<StepName>({}),
  axiosPlugin<
    | {
        endpointName: EndpointName.googleMainPage;
        apiName: ApiName.google;
        requestData: { requestDataField1: string };
        requestQueryParams: {};
        responseData: { responseDataField1: string };
        requestHeaders: {};
      }
    | {
        endpointName: EndpointName.otherEndpoint;
        apiName: ApiName.google;
        requestData: { requestDataField2: string };
        requestQueryParams: {};
        responseData: { responseDataField2: string };
        requestHeaders: {};
      }
  >({ apiDefinitions }),
  forgeValueObject({ debug: false }),
  storytellerHelper,
);

describe("axios plugin", () => {
  it("axios perform request and store it correctly", async () => {
    const responses: any[] = [];
    await testFramework.createStory({
      arrange: testFramework.createStep({
        name: StepName.stepArrange,
        handler: async () => {},
      }),
      act: testFramework.createStep({
        name: StepName.stepAct,
        handler: async (valueObject) => {
          const axiosResponse = await valueObject.axiosRequest({
            endpointName: EndpointName.googleMainPage,
            config: async (payload) => ({
              url: payload.url,
              method: payload.method,
              data: { requestDataField1: "asd" },
            }),
          });
          responses.push(axiosResponse);
        },
      }),
      assert: testFramework.createStep({
        name: StepName.stepAssert,
        handler: async (valueObject) => {
          const axiosResponse = valueObject.axiosGetResponses({
            endpointName: EndpointName.googleMainPage,
            paths: ["response", "apiName", "endpointName", "method", "url"],
          });
          expect(axiosResponse).toStrictEqual(responses);
        },
      }),
    })();
  });
});
