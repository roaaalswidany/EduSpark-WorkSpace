"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { Role, CourseStatus, CourseLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";

const Schema = z.object({
  title: z.string().min(3, "Title too short").max(200),
  description: z.string().min(10, "Description too short").max(5000),
  price: z.number().min(0, "Price cannot be negative"),
  level: z.nativeEnum(CourseLevel),
  categoryId: z.string().optional(),
});

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

export async function createCourseAction(raw: z.infer<typeof Schema>) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const user = await getFreshUser(session.user.id);
    if (!user?.isActive) return { success: false, error: "UNAUTHORIZED" };
    if (user.role !== Role.CREATOR && user.role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    const data = Schema.parse(raw);
    const baseSlug = toSlug(data.title);
    let slug = baseSlug;
    let n = 1;

    while (await db.course.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${n++}`;
    }

    const course = await db.course.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        price: data.price,
        level: data.level,
        status: CourseStatus.DRAFT, 
        creatorId: session.user.id,
        categoryId: data.categoryId || null,
      },
    });

    await cacheInvalidatePattern(CacheKeys.patterns.allCourses);
    revalidatePath("/dashboard/creator/courses");

    return { success: true, courseId: course.id };
  } catch (e) {
    console.error("[CREATE_COURSE]", e);
    return { success: false, error: "SERVER_ERROR" };
  }
}