import { logger } from "./logger";
import { decode } from "jsonwebtoken";
import { zod } from "./zod";

export enum UserType {
  storyteller = "storyteller",
  panel = "panel",
}

export const jsonWebTokenPayloadValidator = zod.object({
  userType: zod.nativeEnum(UserType),
  userId: zod.string(),
});

export interface Authorizer {
  authorize: (payload: {
    accessToken?: string;
  }) => { success: false } | { success: true; jsonWebTokenPayload: zod.infer<typeof jsonWebTokenPayloadValidator> };
}

export const authorizer = (): Authorizer => ({
  authorize: (payload) => {
    if (payload.accessToken === undefined) {
      logger.debug("CLI server", "Authorization failed - missing access token");
      return { success: false };
    }

    const jsonWebToken = decode(payload.accessToken, { complete: true });
    if (jsonWebToken === null) {
      logger.debug("CLI server", "Authorization failed - invalid access token");
      return { success: false };
    }
    const jsonWebTokenPayload = jsonWebTokenPayloadValidator.safeParse(
      typeof jsonWebToken.payload === "string" ? JSON.parse(jsonWebToken.payload) : jsonWebToken.payload,
    );
    if (jsonWebTokenPayload.success === false) {
      logger.debug(
        "CLI server",
        `Authorization failed - invalid access token payload [${jsonWebTokenPayload.error.toString()}]`,
      );
      return { success: false };
    }

    return { success: true, jsonWebTokenPayload: jsonWebTokenPayload.data };
  },
});
