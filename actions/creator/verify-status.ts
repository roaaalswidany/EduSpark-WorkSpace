"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role, type CourseLevel } from "@prisma/client";
import { string } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CertificateSummary {
  id: string;
  credentialId: string;
  score: number;
  issuedAt: Date;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseLevel: CourseLevel;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
}

export interface CreatorStatusData {
  userId: string;
  userName: string;
  role: Role;
  isEligibleToCreateServices: boolean;
  ineligibilityReason: string | null;
  totalCertificates: number;
  certificates: CertificateSummary[];
  authorizedCategories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export type VerifyStatusResult =
  | { success: true; data: CreatorStatusData }
  | {
      success: false;
      error: "UNAUTHORIZED" | "USER_NOT_FOUND" | "SERVER_ERROR";
    };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function verifyCreatorStatusAction(): Promise<VerifyStatusResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const userId = session.user.id;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        certificates: {
          orderBy: { issuedAt: "desc" },
          select: {
            id: true,
            credentialId: true,
            score: true,
            issuedAt: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                level: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return { success: false, error: "USER_NOT_FOUND" };

    // Eligibility rules:
    //   ADMIN   → always eligible (platform operator)
    //   CREATOR → eligible (earned via quiz certification)
    //   STUDENT → never eligible without role escalation
    const isEligible =
      user.role === Role.CREATOR || user.role === Role.ADMIN;

    const ineligibilityReason: string | null = isEligible
      ? null
      : user.role === Role.STUDENT
      ? "Complete a course quiz with a score of 80% or higher to unlock service creation."
      : "Your account role does not permit service creation.";

    // Derive unique authorized categories from certificates
    const categoryMap = new Map
      string,
      { id: string; name: string; slug: string }
    >();

    const certificates: CertificateSummary[] = user.certificates.map((cert) => {
      if (cert.course.category) {
        categoryMap.set(cert.course.category.id, cert.course.category);
      }

      return {
        id: cert.id,
        credentialId: cert.credentialId,
        score: cert.score,
        issuedAt: cert.issuedAt,
        courseId: cert.course.id,
        courseTitle: cert.course.title,
        courseSlug: cert.course.slug,
        courseLevel: cert.course.level,
        categoryId: cert.course.category?.id ?? null,
        categoryName: cert.course.category?.name ?? null,
        categorySlug: cert.course.category?.slug ?? null,
      };
    });

    return {
      success: true,
      data: {
        userId: user.id,
        userName: user.name,
        role: user.role,
        isEligibleToCreateServices: isEligible,
        ineligibilityReason,
        totalCertificates: certificates.length,
        certificates,
        authorizedCategories: Array.from(categoryMap.values()),
      },
    };
  } catch (error) {
    console.error("[VERIFY_CREATOR_STATUS_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}