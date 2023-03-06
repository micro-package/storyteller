import { zod } from "../../shared/zod";
import { EventName, eventValidator } from "../event";

export const eventValidatorStorytellerStarted = eventValidator.extend({
  eventName: zod.literal(EventName.storytellerStarted),
  eventPayload: zod.object({
    plugins: zod.string().array(),
  }),
});
