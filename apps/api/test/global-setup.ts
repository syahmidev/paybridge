import { execSync } from "node:child_process";
import { resolve } from "node:path";

// Provision the test database schema once before the suite runs. `prisma db push`
// creates the database if it doesn't exist and syncs the schema without migrations.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/paybridge_test?schema=public";

export default function setup() {
  const dbDir = resolve(__dirname, "../../../packages/db");
  execSync("pnpm exec prisma db push --skip-generate --accept-data-loss", {
    cwd: dbDir,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
