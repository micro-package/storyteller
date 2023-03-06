import { zod } from "../../shared/zod";
import { EventName, eventValidator } from "../event";

export const eventValidatorTestStartRequested = eventValidator.extend({
  eventName: zod.literal(EventName.storytellerFinished),
  eventPayload: zod.object({
    testNames: zod.string().array(),
  }),
});
