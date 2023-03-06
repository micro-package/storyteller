import { zod } from "../shared/zod";

export const eventValidator = zod.object({
  eventName: zod.string(),
  eventPayload: zod.object({}),
});

export type Event = zod.infer<typeof eventValidator>;
