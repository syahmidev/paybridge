import { createApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

const app = createApp();

app.listen(env.API_PORT, () => {
  logger.info(`PayBridge API listening on http://localhost:${env.API_PORT}`);
});
