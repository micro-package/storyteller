import { zod } from "../../shared/zod";
import { Events } from "../enum";
import { eventValidator } from "../validators";

export const eventValidatorStorytellerStarted = eventValidator.extend({
  eventName: zod.literal(Events.storytellerStarted),
  eventPayload: zod.object({
    plugins: zod.string().array(),
  }),
});

export type EventStorytellerStarted = zod.infer<typeof eventValidatorStorytellerStarted>;
