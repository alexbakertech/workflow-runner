// Access token for the LAN: generated on first start, stored in data/access-token.txt so it's easy to find.
// ACCESS_TOKEN in the environment overrides the file; ACCESS_TOKEN=off disables the check, and so does
// `next dev` unless ACCESS_TOKEN is set.
// Deliberately no "server-only" import: proxy.ts uses this too.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
export const TOKEN_FILE = path.join(DATA_DIR, "access-token.txt");
export const COOKIE = "wr_token";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type TokenSource = "env" | "file" | "off";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i: easy to read and type on a phone

function generate(): string {
  const bytes = randomBytes(16);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

let cached: { mtimeMs: number; value: string } | null = null;

export function tokenSource(): TokenSource {
  const env = process.env.ACCESS_TOKEN?.trim();
  if (env && /^(off|none|false|0|disabled?)$/i.test(env)) return "off";
  if (env) return "env";
  return process.env.NODE_ENV === "development" ? "off" : "file";
}

/** The current token, or null when the check is disabled. Creates the file on first use. */
export function getToken(): string | null {
  const source = tokenSource();
  if (source === "off") return null;
  if (source === "env") return process.env.ACCESS_TOKEN!.trim();
  try {
    const { mtimeMs } = statSync(TOKEN_FILE);
    if (cached?.mtimeMs === mtimeMs) return cached.value;
    const value = readFileSync(TOKEN_FILE, "utf8").trim();
    if (value) {
      cached = { mtimeMs, value };
      return value;
    }
  } catch {}
  return writeToken(generate());
}

function writeToken(value: string): string {
  mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  writeFileSync(TOKEN_FILE, value + "\n", "utf8");
  cached = { mtimeMs: statSync(TOKEN_FILE).mtimeMs, value };
  return value;
}

/** Replaces the stored token (signs out every other device). Not possible when set by the environment. */
export function regenerateToken(): string | null {
  if (tokenSource() !== "file") return null;
  return writeToken(generate());
}

export function tokenMatches(candidate: string | null | undefined): boolean {
  const token = getToken();
  if (token === null) return true;
  if (!candidate) return false;
  const a = Buffer.from(candidate.trim().toLowerCase());
  const b = Buffer.from(token.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
