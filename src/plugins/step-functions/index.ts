import { StepFunctions } from "aws-sdk";
import type { ExpressValueObject } from "../express/types";
import { StatusCodes } from "http-status-codes";
import HTTPMethod from "http-method-enum";
import express from "express";
import { ExponentialBackoff, handleWhen, retry } from "cockatiel";
import { createPlugin } from "../../container/plugin";
import { errorPlugin } from "../../common/error";
import { isPolicyContinuationToken, policyContinuationError } from "../../common/policy";
import { STEP_FUNCTIONS_PLUG } from "./name";
import { EXPRESS_PLUG } from "../express/name";
import type {
  StepFunctionsActions,
  StepFunctionsHookDefinition,
  StepFunctionsPlugin,
  StepFunctionsValueObject,
} from "./types";
import { StepFunctionsHookName } from "./types";

export const endpointName = "startExecution";
export const stepFunctionsPlugin = (config: { options: StepFunctions.Types.ClientConfiguration }) =>
  createPlugin<typeof STEP_FUNCTIONS_PLUG, StepFunctionsActions, StepFunctionsHookDefinition, StepFunctionsPlugin>({
    name: STEP_FUNCTIONS_PLUG,
    requiredPlugins: [EXPRESS_PLUG],
    state: {
      globalState: {
        stepFunctions: new StepFunctions(config.options),
      },
    },
    actions: {
      stepFunctionsMock: (valueObject: ExpressValueObject<any> & StepFunctionsValueObject) => async (payload) => {
        const handlerAmount = payload.handlerAmount || 10;
        const apiDefinition = {
          apiName: "stepFunctions",
          endpointName,
          method: HTTPMethod.POST,
          url: `http://localhost/stepFunctions/${endpointName}`,
        };
        await valueObject.actions.expressMock({
          endpointName,
          apiDefinition,
          //@ts-expect-error - this error is caused by passing any into ExpressValueObject
          handlers: Array.from({ length: handlerAmount }, (_element, index) => [
            express.json(),
            async (req: any, res: any) => {
              const exhaustedAmount = index + 1;
              await valueObject.runHooks({
                name: StepFunctionsHookName.intercepted,
                payload: {
                  apiDefinition,
                  exhaustedAmount,
                  handlerAmount,
                  payload: req.body,
                },
              });
              res.sendStatus(StatusCodes.OK);
            },
          ]),
        });
        await valueObject.runHooks({ name: StepFunctionsHookName.mocked, payload: { apiDefinition } });
      },
      stepFunctionsUnleash: (valueObject: ExpressValueObject<any> & StepFunctionsValueObject) => async (payload) => {
        const filteredExecutions = (() => {
          const executions = valueObject.actions.expressGetExecutions({ endpointName });
          if (payload.filter === undefined) {
            return executions;
          }
          return executions.filter(payload.filter);
        })();
        await Promise.all(
          filteredExecutions.map(async (execution) => {
            await valueObject
              .getPlugin(STEP_FUNCTIONS_PLUG)
              .state.globalState.stepFunctions.startExecution(execution.request.body)
              .promise();
          }),
        );
        await valueObject.runHooks({
          name: StepFunctionsHookName.unleashed,
          payload: { executions: filteredExecutions },
        });
      },
      stepFunctionsAwait: (valueObject: ExpressValueObject<any> & StepFunctionsValueObject) => async (payload) => {
        const filteredExecutions = (() => {
          const executions = valueObject.actions.expressGetExecutions({ endpointName });
          if (payload.filter === undefined) {
            return executions;
          }
          return executions.filter(payload.filter);
        })();
        const retryPolicy = retry(handleWhen(isPolicyContinuationToken), {
          maxAttempts: 5,
          backoff: new ExponentialBackoff(),
        });
        retryPolicy.onGiveUp((reason) => {
          throw errorPlugin("cannot await running step functions", reason);
        });
        await Promise.all(
          filteredExecutions.map((execution) =>
            retryPolicy.execute(async () => {
              const stepFunctionsExecutions = await valueObject.actions.stepFunctionsListExecutions({
                stateMachineArn: execution.request.body.stateMachineArn,
              });
              const runningExecutions = stepFunctionsExecutions.filter(({ status }) => status === "RUNNING");
              if (runningExecutions.length > 0) {
                throw policyContinuationError(runningExecutions);
              }
            }),
          ),
        );
        await valueObject.runHooks({
          name: StepFunctionsHookName.awaited,
          payload: { executions: filteredExecutions, retryPolicy },
        });
      },
      stepFunctionsListExecutions: (valueObject: StepFunctionsValueObject) => async (payload) => {
        payload.executions = payload.executions || [];
        const executionList = await valueObject
          .getPlugin(STEP_FUNCTIONS_PLUG)
          .state.globalState.stepFunctions.listExecutions({
            stateMachineArn: payload.stateMachineArn,
            nextToken: payload.nextToken,
          })
          .promise();
        // eslint-disable-next-line no-param-reassign
        payload.executions = [...payload.executions, ...executionList.executions];
        if (payload.nextToken !== undefined) {
          return valueObject.actions.stepFunctionsListExecutions(payload);
        }
        return payload.executions;
      },
    },
    hooks: [],
  });
