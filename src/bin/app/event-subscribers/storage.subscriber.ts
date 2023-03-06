import { eventSubscriber } from "../../shared/event-subscriber";
import { eventValidatorStorytellerStarted } from "../events/storyteller-started.event";

export const eventSubscriberStorage = () =>
  eventSubscriber(
    (functions) => [{ eventValidator: eventValidatorStorytellerStarted, eventFunction: functions.logStarted }],
    {
      logStarted: async () => {},
    },
  );
