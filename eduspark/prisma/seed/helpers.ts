// eduspark/prisma/seed/helpers.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities for the seed modules: randomness, dates, slugs, hashing,
// logging, and progress generation.
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "./config";

// ─── Randomness ─────────────────────────────────────────────────────────────

export function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number, decimals = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

export function randomBool(probability = 0.5): boolean {
  return Math.random() < probability;
}

export function pickUnique<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

// ─── Dates ──────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY);
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MS_PER_DAY);
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * MS_PER_HOUR);
}

export function randomDateWithinPastDays(maxDaysAgo: number): Date {
  return daysAgo(randomInt(0, maxDaysAgo));
}

export function randomDateWithinFutureDays(maxDaysAhead: number): Date {
  return daysFromNow(randomInt(1, maxDaysAhead));
}

// ─── Strings ────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueSlug(base: string, index: number): string {
  return `${slugify(base)}-${index}`;
}

export function generateCredentialId(prefix = "EDU"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${code}`;
}

// ─── Password ───────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

// ─── Course Progress ────────────────────────────────────────────────────────

/**
 * Returns a realistic progress value:
 *   35% → 0–25  (just started)
 *   30% → 26–60 (mid)
 *   20% → 61–95 (almost done)
 *   15% → 100   (completed)
 */
export function generateProgress(): number {
  const roll = Math.random();
  if (roll < 0.35) return randomInt(0, 25);
  if (roll < 0.65) return randomInt(26, 60);
  if (roll < 0.85) return randomInt(61, 95);
  return 100;
}

// ─── Logging ────────────────────────────────────────────────────────────────

export function logHeader(title: string): void {
  console.log("\n" + "─".repeat(60));
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

export function logSuccess(message: string): void {
  console.log(`   [OK] ${message}`);
}

export function logInfo(message: string): void {
  console.log(`   [--] ${message}`);
}

export function logWarn(message: string): void {
  console.log(`   [!!] ${message}`);
}