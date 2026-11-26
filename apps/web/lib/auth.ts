import { redisStorage } from "@better-auth/redis-storage";
import { betterAuth } from "better-auth";
import Redis from "ioredis";
import "server-only";
import { env } from "./env";

const sessionExpiresIn = 60 * 60 * 24 * 7;

export const auth = betterAuth({
  secondaryStorage: redisStorage({
    client: new Redis(env.redisUrl()),
    keyPrefix: "better-auth:",
  }),
  advanced: {
    cookies: {
      account_data: { attributes: { maxAge: sessionExpiresIn } },
    },
  },
  session: {
    expiresIn: sessionExpiresIn,
    cookieCache: {
      enabled: true,
      strategy: "jwe",
      maxAge: 60 * 5,
      refreshCache: false,
    },
  },
  account: {
    storeAccountCookie: true,
  },
});
