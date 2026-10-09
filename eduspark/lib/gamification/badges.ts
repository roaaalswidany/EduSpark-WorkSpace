// eduspark/lib/gamification/badges.ts

export interface BadgeDefinition {
  key: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string; // lucide icon name
  tier: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  xpReward: number;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  // ─── Learning ─────────────────────────────────────────────────
  {
    key: "first_lesson",
    name: "First Steps",
    nameAr: "الخطوات الأولى",
    description: "Complete your first lesson",
    descriptionAr: "أكمل درسك الأول",
    icon: "BookOpen",
    tier: "COMMON",
    xpReward: 10,
  },
  {
    key: "ten_lessons",
    name: "Quick Learner",
    nameAr: "متعلم سريع",
    description: "Complete 10 lessons",
    descriptionAr: "أكمل 10 دروس",
    icon: "Zap",
    tier: "COMMON",
    xpReward: 25,
  },
  {
    key: "first_certificate",
    name: "Course Master",
    nameAr: "سيد الكورسات",
    description: "Earn your first certificate",
    descriptionAr: "احصل على شهادتك الأولى",
    icon: "Award",
    tier: "RARE",
    xpReward: 50,
  },
  {
    key: "three_certificates",
    name: "Triple Threat",
    nameAr: "الثلاثي الذهبي",
    description: "Earn 3 certificates",
    descriptionAr: "احصل على 3 شهادات",
    icon: "Trophy",
    tier: "EPIC",
    xpReward: 150,
  },
  {
    key: "five_certificates",
    name: "Certificate Collector",
    nameAr: "جامع الشهادات",
    description: "Earn 5 certificates",
    descriptionAr: "احصل على 5 شهادات",
    icon: "Crown",
    tier: "LEGENDARY",
    xpReward: 300,
  },

  // ─── Marketplace ──────────────────────────────────────────────
  {
    key: "first_service",
    name: "First Sale",
    nameAr: "أول خدمة",
    description: "Publish your first service",
    descriptionAr: "انشر خدمتك الأولى",
    icon: "Store",
    tier: "COMMON",
    xpReward: 25,
  },
  {
    key: "five_orders",
    name: "Rising Star",
    nameAr: "نجم صاعد",
    description: "Complete 5 orders",
    descriptionAr: "أكمل 5 طلبات",
    icon: "TrendingUp",
    tier: "RARE",
    xpReward: 100,
  },
  {
    key: "top_rated",
    name: "Top Rated",
    nameAr: "الأعلى تقييمًا",
    description: "Receive a 5-star review",
    descriptionAr: "احصل على تقييم 5 نجوم",
    icon: "Star",
    tier: "RARE",
    xpReward: 75,
  },

  // ─── Engagement ──────────────────────────────────────────────
  {
    key: "first_chat",
    name: "Communication Pro",
    nameAr: "محترف التواصل",
    description: "Send your first chat message",
    descriptionAr: "أرسل رسالتك الأولى",
    icon: "MessageSquare",
    tier: "COMMON",
    xpReward: 10,
  },
  {
    key: "week_streak",
    name: "Weekly Warrior",
    nameAr: "محارب الأسبوع",
    description: "7-day activity streak",
    descriptionAr: "7 أيام نشاط متتالية",
    icon: "Flame",
    tier: "RARE",
    xpReward: 100,
  },
  {
    key: "month_streak",
    name: "Dedicated Learner",
    nameAr: "متعلم ملتزم",
    description: "30-day activity streak",
    descriptionAr: "30 يوم نشاط متتالي",
    icon: "Flame",
    tier: "LEGENDARY",
    xpReward: 500,
  },

  // ─── Career Path ──────────────────────────────────────────────
  {
    key: "first_career_path",
    name: "Path Planner",
    nameAr: "مخطط المسار",
    description: "Create your first career path",
    descriptionAr: "أنشئ مسارك المهني الأول",
    icon: "Target",
    tier: "COMMON",
    xpReward: 20,
  },
  {
    key: "career_path_completed",
    name: "Goal Crusher",
    nameAr: "محطم الأهداف",
    description: "Complete an entire career path",
    descriptionAr: "أكمل مسارًا مهنيًا كاملاً",
    icon: "CheckCircle2",
    tier: "EPIC",
    xpReward: 200,
  },
];

export function getBadgeByKey(key: string): BadgeDefinition | undefined {
  return BADGE_CATALOG.find((b) => b.key === key);
}

export const TIER_STYLES: Record<
  BadgeDefinition["tier"],
  { color: string; bg: string; border: string; gradient: string }
> = {
  COMMON: {
    color: "text-slate-400",
    bg: "bg-slate-800/60",
    border: "border-slate-700",
    gradient: "from-slate-600 to-slate-700",
  },
  RARE: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    gradient: "from-blue-500 to-cyan-600",
  },
  EPIC: {
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    gradient: "from-violet-500 to-fuchsia-600",
  },
  LEGENDARY: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    gradient: "from-amber-500 to-orange-600",
  },
};