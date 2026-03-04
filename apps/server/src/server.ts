import { createServer } from "http";
import { app } from "./app.js";
import { initSocketServer } from "./websocket/index.js";

const PORT = process.env.PORT ?? 3000;

const httpServer = createServer(app);
initSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
