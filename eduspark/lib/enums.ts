// eduspark/lib/enums.ts
import type {
  ProjectStatus as PrismaProjectStatus,
  MilestoneStatus as PrismaMilestoneStatus,
  Role as PrismaRole,
  ServiceStatus as PrismaServiceStatus,
  CourseLevel as PrismaCourseLevel,
} from "@prisma/client";

// ============ Role ============
export const Role = {
  STUDENT: "STUDENT",
  CREATOR: "CREATOR",
  ADMIN: "ADMIN",
} as const satisfies Record<PrismaRole, PrismaRole>;

// ============ CourseLevel ============
export const CourseLevel = {
  BEGINNER: "BEGINNER",
  INTERMEDIATE: "INTERMEDIATE",
  ADVANCED: "ADVANCED",
} as const satisfies Record<PrismaCourseLevel, PrismaCourseLevel>;

// ============ ServiceStatus ============
export const ServiceStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ARCHIVED: "ARCHIVED",
} as const satisfies Record<PrismaServiceStatus, PrismaServiceStatus>;

// ============ ProjectStatus ============
export const ProjectStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  PENDING: "PENDING",
  REVIEW_REQUESTED: "REVIEW_REQUESTED",
  DISPUTED: "DISPUTED",
} as const satisfies Record<PrismaProjectStatus, PrismaProjectStatus>;

// ============ MilestoneStatus ============
export const MilestoneStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW_REQUESTED: "REVIEW_REQUESTED",
  APPROVED: "APPROVED",
  REVISION_NEEDED: "REVISION_NEEDED",
} as const satisfies Record<PrismaMilestoneStatus, PrismaMilestoneStatus>;

// ============ Types ============
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];
export type Role = (typeof Role)[keyof typeof Role];
export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];