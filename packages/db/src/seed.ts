import { createDb } from "./client.ts";
import { accounts } from "./schema.ts";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const SEED_ACCOUNTS = [
  {
    accountNumber: "0000123450",
    pin: "0000001111",
    ownerName: "Conta Demo 1",
    balanceCents: 10000n,
  },
  {
    accountNumber: "1234567890",
    pin: "0000001234",
    ownerName: "Conta Demo 2",
    balanceCents: 20000n,
  },
];

const db = createDb(databaseUrl);

for (const a of SEED_ACCOUNTS) {
  const existing = await db
    .select()
    .from(accounts)
    .where(eq(accounts.accountNumber, a.accountNumber))
    .limit(1);
  if (existing.length > 0) {
    console.log(`= ${a.accountNumber} already exists, skipping`);
    continue;
  }
  const pinHash = await bcrypt.hash(a.pin, 10);
  await db.insert(accounts).values({
    accountNumber: a.accountNumber,
    pinHash,
    ownerName: a.ownerName,
    balanceCents: a.balanceCents,
  });
  console.log(`+ seeded ${a.accountNumber} (${a.ownerName})`);
}
process.exit(0);
