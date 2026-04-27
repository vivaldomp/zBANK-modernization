import { cookies, headers } from "next/headers";

const SESSION_COOKIE = "zbank_session";

const API_INTERNAL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

async function forwardCookieHeader(): Promise<HeadersInit> {
  const c = await cookies();
  const session = c.get(SESSION_COOKIE)?.value;
  if (!session) return {};
  return { cookie: `${SESSION_COOKIE}=${session}` };
}

export async function apiGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const headers = await forwardCookieHeader();
  const r = await fetch(`${API_INTERNAL}${path}`, {
    headers,
    cache: "no-store",
  });
  if (!r.ok) return { status: r.status, data: null };
  return { status: r.status, data: (await r.json()) as T };
}

export async function apiPost<T>(
  path: string,
  body: unknown,
): Promise<{ status: number; data: T | null; setCookie: string | null }> {
  const headers = {
    "content-type": "application/json",
    ...(await forwardCookieHeader()),
  };
  const r = await fetch(`${API_INTERNAL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const setCookie = r.headers.get("set-cookie");
  const data = r.headers.get("content-type")?.includes("json")
    ? ((await r.json()) as T)
    : null;
  return { status: r.status, data, setCookie };
}

export type Me = {
  id: string;
  accountNumber: string;
  ownerName: string;
  balanceCents: string;
};

export type ApiTx = {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amountCents: string;
  balanceAfterCents: string;
  createdAt: string;
};

void headers; // imported for future use; avoid unused warning
