import express from "express";
import helmet from "helmet";
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
import pinsRoutes from "./modules/pins/pins.routes.js";

export const app = express();

// BigInt is not natively serializable to JSON — convert to string
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value,
);

app.use(helmet());
app.use(express.json());
app.set("trust proxy", 1);
app.use(globalLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/servers", serverRoutes);
app.use("/channels", channelRoutes);
app.use("/friendships", friendshipRoutes);
app.use("/messages", messageRoutes);
app.use("/dm", dmRoutes);
app.use("/users", userRoutes);
app.use("/settings", settingsRoutes);
app.use("/uploads", uploadsRoutes);
app.use("/", pinsRoutes);

app.use(errorMiddleware);
