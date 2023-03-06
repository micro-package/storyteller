import { zod } from "../../shared/zod";
import { Events, eventValidator } from "../event";

export const eventValidatorStorytellerStarted = eventValidator.extend({
  eventName: zod.literal(Events.storytellerStarted),
  eventPayload: zod.object({
    plugins: zod.string().array(),
  }),
});
