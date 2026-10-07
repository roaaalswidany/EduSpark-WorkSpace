// eduspark/prisma/seed/notifications.ts
import type { PrismaClient, User } from "@prisma/client";
import {
  randomInt,
  randomItem,
  randomBool,
  daysAgo,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";

interface Template {
  title: string;
  body: string;
  link?: string;
}

const ARABIC_TEMPLATES: Template[] = [
  { title: "كورس جديد متاح", body: "تم نشر كورس جديد في التصنيف الذي تتابعه. تصفحه الآن!", link: "/courses" },
  { title: "تم إصدار شهادتك", body: "مبروك! تم إصدار شهادتك بنجاح. يمكنك تحميلها من صفحة الشهادات.", link: "/dashboard/student/certificates" },
  { title: "رسالة جديدة", body: "لديك رسالة جديدة في غرفة الدردشة. افتحها للاطلاع.", link: "/dashboard/chat" },
  { title: "طلب جديد", body: "وصلك طلب جديد على إحدى خدماتك. راجعه الآن.", link: "/dashboard/creator/orders" },
  { title: "تحديث حالة الطلب", body: "تم تحديث حالة طلبك. تفقد التفاصيل.", link: "/dashboard/orders" },
  { title: "تقييم جديد", body: "حصلت على تقييم جديد على كورس من كورساتك.", link: "/dashboard/creator/services" },
  { title: "مرحلة مكتملة", body: "تم اعتماد إحدى مراحل مشروعك. تقدّم رائع!", link: "/dashboard/projects" },
  { title: "دعوة لمراجعة مشروع", body: "مشروعك جاهز للمراجعة. يمكنك اعتماده أو طلب تعديلات.", link: "/dashboard/projects" },
];

const ENGLISH_TEMPLATES: Template[] = [
  { title: "New course available", body: "A new course has been published in a category you follow.", link: "/courses" },
  { title: "Certificate issued", body: "Congratulations! Your certificate has been issued.", link: "/dashboard/student/certificates" },
  { title: "New message", body: "You have a new message in a chat room.", link: "/dashboard/chat" },
  { title: "New order received", body: "You received a new order on one of your services.", link: "/dashboard/creator/orders" },
  { title: "Order status updated", body: "Your order status has been updated.", link: "/dashboard/orders" },
  { title: "New review", body: "You received a new review on one of your courses.", link: "/dashboard/creator/services" },
  { title: "Milestone approved", body: "One of your project milestones was approved.", link: "/dashboard/projects" },
  { title: "Project review requested", body: "Your project is ready for review.", link: "/dashboard/projects" },
];

export interface SeededNotifications {
  total: number;
  unread: number;
  read: number;
}

export async function seedNotifications(
  db: PrismaClient,
  users: { all: User[] }
): Promise<SeededNotifications> {
  logHeader("🔔 Step 10: Notifications");

  await db.notification.deleteMany({});

  const TARGET = 300;
  const recipients = users.all;
  let unread = 0;
  let read = 0;

  const notificationsData: Array<{
    userId: string;
    title: string;
    body: string;
    link: string | null;
    isRead: boolean;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < TARGET; i++) {
    const recipient = recipients[i % recipients.length];
    const isArabic = /[\u0600-\u06FF]/.test(recipient.name);
    const template = randomItem(isArabic ? ARABIC_TEMPLATES : ENGLISH_TEMPLATES);
    const isReadBool = randomBool(0.6);

    notificationsData.push({
      userId: recipient.id,
      title: template.title,
      body: template.body,
      link: template.link ?? null,
      isRead: isReadBool,
      createdAt: daysAgo(randomInt(0, 60)),
    });

    if (isReadBool) read++;
    else unread++;
  }

  await db.notification.createMany({ data: notificationsData });

  logSuccess(`${TARGET} notifications created`);
  logInfo(`  ✅ Read:   ${read}`);
  logInfo(`  🔵 Unread: ${unread}`);

  return { total: TARGET, unread, read };
}