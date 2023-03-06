import { createCommand } from "../../shared/command-bus";
import type { IntegrationCLI } from "../../shared/integration/cli";
import { zod } from "../../shared/zod";
import { CommandName } from "../command";

export const commandStartTestContainer = (integrationCLI: IntegrationCLI) =>
  createCommand({
    commandValidator: zod.object({
      commandName: zod.literal(CommandName.startTestContainer),
      commandPayload: zod.object({
        testNames: zod.string().array(),
      }),
    }),
    commandHandler: async (command) => {
      void integrationCLI.startTestContainer({ testNames: command.commandPayload.testNames, timeout: 5000 });
    },
  });
