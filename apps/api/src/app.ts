import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  amountRequestSchema,
  loginRequestSchema,
  ERROR_CODES,
} from "@zbank/contracts";
import type { Container } from "./container.ts";

const SESSION_COOKIE = "zbank_session";

type Vars = { accountId: string };

export function createApp(container: Container, opts: { allowOrigin: string }) {
  const app = new Hono<{ Variables: Vars }>();

  app.use(
    "*",
    cors({
      origin: opts.allowOrigin,
      credentials: true,
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/auth/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: ERROR_CODES.VALIDATION_ERROR, message: parsed.error.message },
        400,
      );
    }
    const result = await container.useCases.login.execute(parsed.data);
    if (!result.ok) {
      return c.json({ error: ERROR_CODES.INVALID_CREDENTIALS }, 401);
    }
    setCookie(c, SESSION_COOKIE, result.sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 30,
    });
    return c.json({
      accountId: result.accountId,
      ownerName: result.ownerName,
    });
  });

  app.post("/auth/logout", async (c) => {
    const sid = getCookie(c, SESSION_COOKIE);
    if (sid) await container.sessions.destroy(sid);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  // Auth middleware for /accounts/me/*
  app.use("/accounts/me/*", async (c, next) => {
    const sid = getCookie(c, SESSION_COOKIE);
    const accountId = sid ? await container.sessions.get(sid) : null;
    if (!accountId) return c.json({ error: ERROR_CODES.UNAUTHORIZED }, 401);
    c.set("accountId", accountId);
    await next();
  });

  app.get("/accounts/me", async (c) => {
    const accountId = c.get("accountId");
    const result = await container.useCases.getBalance.execute(accountId);
    if (!result.ok) return c.json({ error: result.error }, 404);
    return c.json({
      id: accountId,
      accountNumber: result.accountNumber,
      ownerName: result.ownerName,
      balanceCents: result.balanceCents.toString(),
    });
  });

  app.get("/accounts/me/balance", async (c) => {
    const accountId = c.get("accountId");
    const result = await container.useCases.getBalance.execute(accountId);
    if (!result.ok) return c.json({ error: result.error }, 404);
    return c.json({ balanceCents: result.balanceCents.toString() });
  });

  app.post("/accounts/me/deposit", async (c) => {
    const accountId = c.get("accountId");
    const body = await c.req.json().catch(() => null);
    const parsed = amountRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: ERROR_CODES.VALIDATION_ERROR }, 400);
    }
    const result = await container.useCases.deposit.execute({
      accountId,
      amountCents: parsed.data.amountCents,
    });
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json({
      newBalance: result.newBalance.toString(),
      transaction: serializeTx(result.transaction),
    });
  });

  app.post("/accounts/me/withdraw", async (c) => {
    const accountId = c.get("accountId");
    const body = await c.req.json().catch(() => null);
    const parsed = amountRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: ERROR_CODES.VALIDATION_ERROR }, 400);
    }
    const result = await container.useCases.withdraw.execute({
      accountId,
      amountCents: parsed.data.amountCents,
    });
    if (!result.ok) {
      const status = result.error === "INSUFFICIENT_FUNDS" ? 409 : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({
      newBalance: result.newBalance.toString(),
      transaction: serializeTx(result.transaction),
    });
  });

  app.get("/accounts/me/transactions", async (c) => {
    const accountId = c.get("accountId");
    const limitParam = c.req.query("limit");
    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 200);
    const txs = await container.useCases.getHistory.execute(accountId, limit);
    return c.json({ transactions: txs.map(serializeTx) });
  });

  return app;
}

function serializeTx(tx: {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amountCents: bigint;
  balanceAfterCents: bigint;
  createdAt: Date;
}) {
  return {
    id: tx.id,
    accountId: tx.accountId,
    type: tx.type,
    amountCents: tx.amountCents.toString(),
    balanceAfterCents: tx.balanceAfterCents.toString(),
    createdAt: tx.createdAt.toISOString(),
  };
}
