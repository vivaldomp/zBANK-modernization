import { createApp } from "./app.ts";
import { buildContainer } from "./container.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const port = Number(process.env.API_PORT ?? 3001);
const allowOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const container = buildContainer(databaseUrl);
const app = createApp(container, { allowOrigin });

console.log(`✓ zBank API listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
