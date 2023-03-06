import * as lodash from "lodash";
import type { commandValidator } from "../app/command";
import { logger } from "./logger";
import type { zod } from "./zod";

export interface CommandHandler<TCommandName extends string, TCommandPayload extends any> {
  commandName: string;
  commandHandler: (command: Command<TCommandName, TCommandPayload>) => Promise<void>;
  commandValidator: zod.AnyZodObject;
}

export const createCommand = <TCommandName extends string, TCommandHandler extends typeof commandValidator>(config: {
  commandValidator: TCommandHandler;
  commandHandler: CommandHandler<TCommandName, zod.infer<TCommandHandler>>["commandHandler"];
}): CommandHandler<TCommandName, zod.infer<TCommandHandler>> => ({
  commandName: config.commandValidator.shape.commandName._def.value,
  commandHandler: config.commandHandler,
  commandValidator: config.commandValidator,
});

export interface Command<TCommandName extends string, TCommandPayload extends any> {
  commandName: TCommandName;
  commandPayload: TCommandPayload;
}

export const createCommandBus =
  <TCommandName extends string>() =>
  <TCommandHandlers extends CommandHandler<TCommandName, any>>(config: {
    commandHandlers: TCommandHandlers[];
  }): {
    execute: (
      command: Command<
        TCommandName,
        TCommandHandlers extends CommandHandler<TCommandName, { commandPayload: infer UPayload }> ? UPayload : never
      >,
    ) => Promise<void>;
  } => {
    const duplicated = lodash.filter(
      config.commandHandlers.map((command) => command.commandName),
      (commandName, index, array) => lodash.includes(array, commandName, index + 1),
    );
    if (duplicated.length > 0) {
      throw Error(`Commands with duplicated names: [${duplicated.join(", ")}]`);
    }
    return {
      execute: async (command) => {
        const matchingCommandHandler = config.commandHandlers.find(
          ({ commandName: name }) => name === command.commandName,
        );
        if (matchingCommandHandler === undefined) {
          logger.warn("CLI server", `There is no command handler for command with name [${command.commandName}]`);
          return;
        }
        const validatedCommand = matchingCommandHandler.commandValidator.safeParse(command);
        if (validatedCommand.success === false) {
          logger.error(
            "CLI server",
            `Command [${command.commandName}] received invalid payload [${JSON.stringify(command.commandPayload)}]`,
          );
          return;
        }
        logger.debug(
          "CLI server",
          `Command [${command.commandName}] started with payload [${JSON.stringify(command.commandPayload)}]`,
        );
        try {
          const commandHandlerResult = await matchingCommandHandler.commandHandler(command);
          logger.debug(
            "CLI server",
            `Command [${command.commandName}] finished ${JSON.stringify(commandHandlerResult)}`,
          );
        } catch (error) {
          logger.error("CLI server", `Command [${command.commandName}] errored ${error.toString()}`);
        }
      },
    };
  };
