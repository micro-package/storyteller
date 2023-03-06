import { Events } from "../enum";
import { eventSubscriber } from "../event-subscriber";

export const eventSubscriberStorage = () =>
  eventSubscriber((functions) => [{ eventName: Events.storytellerStarted, eventFunction: functions.logStarted }], {
    logStarted: async (payload) => {
      console.log(`Message received ${JSON.stringify(payload)}`);
    },
  });
