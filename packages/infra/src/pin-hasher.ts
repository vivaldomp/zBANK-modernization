import type { PinHasher } from "@zbank/application";
import bcrypt from "bcryptjs";

export class BcryptPinHasher implements PinHasher {
  constructor(private readonly rounds = 10) {}
  hash(pin: string): Promise<string> {
    return bcrypt.hash(pin, this.rounds);
  }
  verify(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin, hash);
  }
}
