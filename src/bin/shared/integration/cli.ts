import { exec } from "child_process";
import { logger } from "../logger";

export interface IntegrationCLI {
  startTestContainer: (payload: { testNames: string[]; timeout: number }) => void;
  killTestContainer: () => Promise<void>;
  removeTestContainer: () => Promise<void>;
}

export const executeCommand = async (command: string) => {
  logger.debug(`Command execution started: [${command}]`);
  await new Promise((resolve, reject) =>
    exec(command, (error, stdout, stderr) => {
      if (error === null) {
        logger.debug(`Command execution finished: [${command}]`);
        resolve(stdout);
      } else {
        logger.debug(`Command execution errored: [${command}]`);
        reject(stderr);
      }
    }),
  );
};

export const integrationCLI = (): IntegrationCLI => ({
  startTestContainer: async (payload) => {
    await executeCommand(
      `docker-compose --env-file=.env run storyteller ./node_modules/.bin/jest --runInBand --testNamePattern=/${payload.testNames.join(
        "|",
      )}/g --testTimeout=${payload.timeout} --config jest.config.json`,
    );
  },
  killTestContainer: async () => {
    await executeCommand("docker kill $(docker ps -q)");
  },
  removeTestContainer: async () => {
    await executeCommand("docker rm $(docker ps -a -q)");
  },
});
