import type { SessionStore } from "@zbank/application";
import { randomBytes } from "node:crypto";

type Entry = { accountId: string; expiresAt: number };

export class InMemorySessionStore implements SessionStore {
  private readonly store = new Map<string, Entry>();

  constructor(private readonly ttlMs = 30 * 60 * 1000) {}

  async create(accountId: string): Promise<string> {
    const id = randomBytes(24).toString("hex");
    this.store.set(id, { accountId, expiresAt: Date.now() + this.ttlMs });
    return id;
  }

  async get(sessionId: string): Promise<string | null> {
    const entry = this.store.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(sessionId);
      return null;
    }
    return entry.accountId;
  }

  async destroy(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
