import rateLimit, {
  ipKeyGenerator as erlIpKeyGenerator,
} from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../config/redis.js";

const makeStore = (prefix: string) =>
  new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as any,
    prefix,
  });

const ipKeyGenerator = (req: any) => erlIpKeyGenerator(req);

const authKeyGenerator = (req: any) =>
  req.userId ? `user:${req.userId}` : `ip:${erlIpKeyGenerator(req)}`;

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("rl:register:"),
  keyGenerator: ipKeyGenerator,
  message: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many accounts created, please try again later",
  },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("rl:login:"),
  keyGenerator: ipKeyGenerator,
  message: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many login attempts, please try again later",
  },
});

export const messagesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("rl:messages:"),
  keyGenerator: authKeyGenerator,
  message: {
    code: "TOO_MANY_REQUESTS",
    message: "Slow down, you are sending too many messages",
  },
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("rl:global:"),
  keyGenerator: authKeyGenerator,
  message: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests, please try again later",
  },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("rl:forgot-password:"),
  keyGenerator: ipKeyGenerator,
  message: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many password reset attempts, please try again later",
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("rl:upload:"),
  keyGenerator: authKeyGenerator,
  message: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many uploads, please try again later",
  },
});
