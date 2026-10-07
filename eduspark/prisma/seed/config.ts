// eduspark/prisma/seed/config.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central configuration for the comprehensive seed.
// Adjust counts and constants here — the logic lives in the modules.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Passwords ──────────────────────────────────────────────────────────────

export const SEED_PASSWORD_PLAIN = "Password123!";
export const BCRYPT_COST = 12;

// ─── Protected Accounts ─────────────────────────────────────────────────────
// These accounts are NEVER touched by the seed (real production accounts).

export const PROTECTED_EMAILS = ["roaaswidany@gmail.com"] as const;

// ─── Demo / Test Accounts (recreated on every seed) ─────────────────────────

export const TEST_ACCOUNTS = {
  instructor: "sarah.creator@eduspark.dev",
  student: "ahmad.student@eduspark.dev",
  client: "layla.client@eduspark.dev",
  admin: "admin@eduspark.dev",
} as const;

export const TEST_ACCOUNT_NAMES = {
  instructor: "Sarah Ahmad",
  student: "Ahmad Khaled",
  client: "Layla Hassan",
  admin: "Platform Admin",
} as const;

// ─── Seed Counts ─────────────────────────────────────────────────────────────

export const SEED_COUNTS = {
  // Users
  students: 60,
  creators: 12,
  mixed: 8,

  // Content
  categories: 10,
  courses: 30,
  services: 40,

  // Activity
  enrollments: 250,
  certificates: 60,
  orders: 100,
  projects: 60,
  proposals: 50,
  reviews: 200,
  chatRooms: 25,
  messages: 500,
  notifications: 300,
  aiConversations: 20,
} as const;

// ─── Placeholder Assets ─────────────────────────────────────────────────────

export const PLACEHOLDER_VIDEO_URL =
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export const PLACEHOLDER_THUMBNAILS = [
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800",
] as const;

export const PLACEHOLDER_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmad",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Layla",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Omar",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Noor",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Yousef",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Lina",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Khaled",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zaid",
] as const;