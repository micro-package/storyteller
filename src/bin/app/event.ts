import { zod } from "../shared/zod";

export const eventValidator = zod.object({
  eventName: zod.string() as unknown as zod.ZodLiteral<unknown>,
  eventPayload: zod.any() as unknown as zod.ZodObject<any>,
});

export enum Events {
  storytellerStarted = "storytellerStarted",
}
