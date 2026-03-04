import express from "express";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { globalLimiter } from "./middlewares/rateLimiter.middleware.js";

import authRoutes from "./modules/auth/auth.routes.js";
import serverRoutes from "./modules/servers/servers.routes.js";
import channelRoutes from "./modules/channels/channels.routes.js";
import friendshipRoutes from "./modules/friendships/friendships.routes.js";
import messageRoutes from "./modules/messages/messages.routes.js";
import dmRoutes from "./modules/dm/dm.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import uploadsRoutes from "./modules/uploads/uploads.routes.js";

export const app = express();

// BigInt is not natively serializable to JSON — convert to string
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value,
);

app.use(express.json());
app.set("trust proxy", 1);
app.use(globalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/friendships", friendshipRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/dm", dmRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/uploads", uploadsRoutes);

app.use(errorMiddleware);
