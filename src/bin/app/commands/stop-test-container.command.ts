import { createCommand } from "../../shared/command-bus";
import type { IntegrationCLI } from "../../shared/integration/cli";
import { zod } from "../../shared/zod";
import { CommandName } from "../command";

export const commandStopTestContainer = (integrationCLI: IntegrationCLI) =>
  createCommand({
    commandValidator: zod.object({
      commandName: zod.literal(CommandName.stopTestContainer),
      commandPayload: zod.object({}),
    }),
    commandHandler: async () => {
      await integrationCLI.killTestContainer();
      await integrationCLI.removeTestContainer();
    },
  });
