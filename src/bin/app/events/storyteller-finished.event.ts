import { zod } from "../../shared/zod";
import { EventName, eventValidator } from "../event";

export const eventValidatorStorytellerFinished = eventValidator.extend({
  eventName: zod.literal(EventName.storytellerFinished),
  eventPayload: zod.object({
    storiesFinished: zod.string().array(),
  }),
});
