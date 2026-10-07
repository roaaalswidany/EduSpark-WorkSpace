/* eslint-disable @typescript-eslint/no-unused-vars */
// eduspark/prisma/seed/ai-conversations.ts
import type { PrismaClient, User } from "@prisma/client";
import {
  randomInt,
  randomItem,
  daysAgo,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";

// ─── Conversation Templates ─────────────────────────────────────────────────

interface ConversationTemplate {
  language: "ar" | "en";
  title: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

const CONVERSATIONS: ConversationTemplate[] = [
  {
    language: "ar",
    title: "كيف أحصل على شهادة؟",
    messages: [
      {
        role: "user",
        content: "كيف يمكنني الحصول على شهادة معتمدة في EduSpark؟",
      },
      {
        role: "assistant",
        content:
          "🎓 للحصول على شهادة في EduSpark:\n\n1. تصفح الكورسات من صفحة الكورسات\n2. سجّل في كورس يناسبك\n3. أكمل جميع الدروس\n4. اجتز اختبار الشهادة بنسبة 80% أو أكثر\n5. شهادتك تُصدر تلقائياً مع Credential ID فريد\n\nبعد الحصول على الشهادة، ستتحول تلقائياً إلى منشئ معتمد ويمكنك نشر خدماتك!",
      },
    ],
  },
  {
    language: "ar",
    title: "كيف أنشر خدمة؟",
    messages: [
      {
        role: "user",
        content: "أريد نشر خدمة في السوق، كيف أبدأ؟",
      },
      {
        role: "assistant",
        content:
          "✨ لنشر خدمة، تحتاج أولاً أن تكون منشئاً معتمداً (أي حاصل على شهادة).\n\nالخطوات:\n1. تأكد من حصولك على شهادة موثقة\n2. اذهب إلى لوحة التحكم → خدماتي\n3. اضغط على \"نشر خدمة جديدة\"\n4. املأ التفاصيل: العنوان، الوصف، السعر، مدة التسليم\n5. أضف روابط معرض أعمالك (اختياري)\n6. اضغط حفظ\n\nنصيحة: اكتب وصفاً واضحاً ومفصلاً، فهذا يجذب العملاء!",
      },
    ],
  },
  {
    language: "ar",
    title: "كيف أحسن تقييم خدمتي؟",
    messages: [
      {
        role: "user",
        content: "كيف أقنع المشتري بخدماتي وأحصل على تقييمات عالية؟",
      },
      {
        role: "assistant",
        content:
          "💡 نصائح لجذب المشترين والحصول على تقييمات عالية:\n\n1. **أبرز شهاداتك الموثقة** في ملفك الشخصي\n2. **اكتب وصفاً واضحاً** ومفصلاً للخدمة\n3. **حدد سعراً تنافسياً** في البداية لجذب أول الطلبات\n4. **أضف معرض أعمالك** — صور وأمثلة سابقة\n5. **استجب بسرعة للرسائل** — السرعة تعني الاحترافية\n6. **سلّم قبل الموعد** أو في الوقت المحدد\n7. **اطلب تقييماً بلطف** بعد التسليم\n\nالتقييمات الإيجابية هي أفضل تسويق لخدماتك!",
      },
    ],
  },
  {
    language: "en",
    title: "How do I get a certificate?",
    messages: [
      {
        role: "user",
        content: "How can I get a verified certificate on EduSpark?",
      },
      {
        role: "assistant",
        content:
          "🎓 To get a certificate on EduSpark:\n\n1. Browse courses\n2. Enroll in a course\n3. Complete all lessons\n4. Pass the certificate quiz with 80%+\n5. Your certificate is issued automatically with a unique Credential ID\n\nOnce certified, you automatically become a certified creator and can publish services!",
      },
    ],
  },
  {
    language: "en",
    title: "How to publish a service?",
    messages: [
      {
        role: "user",
        content: "I want to publish a service. Where do I start?",
      },
      {
        role: "assistant",
        content:
          "✨ To publish a service, you first need to be a certified creator (hold a certificate).\n\nSteps:\n1. Ensure you have a verified certificate\n2. Go to Dashboard → My Services\n3. Click 'Publish New Service'\n4. Fill in details: title, description, price, delivery time\n5. Add portfolio links (optional)\n6. Save\n\nTip: Write a clear, detailed description — this attracts clients!",
      },
    ],
  },
  {
    language: "ar",
    title: "الموقع لا يعمل عندي",
    messages: [
      {
        role: "user",
        content: "الموقع ما يشتغل عندي، ما الحل؟",
      },
      {
        role: "assistant",
        content:
          "🔧 خلينا نحل المشكلة معاً. أخبرني:\n\n1. ما الذي يحدث بالضبط؟ (صفحة بيضاء؟ رسالة خطأ؟)\n2. على أي صفحة؟\n3. متى بدأت المشكلة؟\n\nفي الأثناء، جرّب:\n- 🔄 تحديث قسري: Ctrl+Shift+R\n- 🗑️ مسح الكاش\n- 🚪 تسجيل خروج ودخول\n\nإذا استمرت، أرسل لقطة شاشة للخطأ.",
      },
    ],
  },
  {
    language: "en",
    title: "Learning strategy advice",
    messages: [
      {
        role: "user",
        content: "What's the best strategy to learn programming?",
      },
      {
        role: "assistant",
        content:
          "🎯 Best strategy to learn programming:\n\n1. **Pick ONE language** first (JavaScript or Python)\n2. **Learn fundamentals** — variables, loops, functions\n3. **Build small projects** every week\n4. **Read others' code** on GitHub\n5. **Solve problems daily** on LeetCode or similar\n6. **Join communities** — Discord, Reddit\n7. **Teach what you learn** — best way to solidify knowledge\n\n💡 Key tip: Consistency beats intensity. 1 hour daily > 8 hours on weekend.",
      },
    ],
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededAiConversations {
  conversations: number;
  messages: number;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedAiConversations(
  db: PrismaClient,
  users: { all: User[] }
): Promise<SeededAiConversations> {
  logHeader("🤖 Step 11: AI Conversations");

  await db.aiConversation.deleteMany({});

  const TARGET = 20;
  const createdIds: string[] = [];
  let totalMessages = 0;

  // Distribute conversations across demo accounts
  const demoEmails = [
    "ahmad.student@eduspark.dev",
    "layla.client@eduspark.dev",
    "sarah.creator@eduspark.dev",
    "admin@eduspark.dev",
    "roaaswidany@gmail.com",
  ];

  const demoUsers = await db.user.findMany({
    where: { email: { in: demoEmails } },
  });

  const conversationPool = [...CONVERSATIONS, ...CONVERSATIONS, ...CONVERSATIONS].slice(0, TARGET);

  for (let i = 0; i < conversationPool.length; i++) {
    const template = conversationPool[i];
    const user = demoUsers[i % demoUsers.length];

    if (!user) continue;

    const createdAt = daysAgo(randomInt(1, 60));

    const conversation = await db.aiConversation.create({
      data: {
        userId: user.id,
        title: template.title,
        createdAt,
        updatedAt: createdAt,
      },
    });

    createdIds.push(conversation.id);

    // Insert messages in order
    for (let m = 0; m < template.messages.length; m++) {
      const msg = template.messages[m];
      await db.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: msg.role,
          content: msg.content,
          createdAt: new Date(createdAt.getTime() + m * 60 * 1000),
        },
      });
      totalMessages++;
    }
  }

  logSuccess(`${createdIds.length} AI conversations created`);
  logInfo(`  💬 Total messages: ${totalMessages}`);
  logInfo(`  📊 Avg messages/conversation: ${(totalMessages / createdIds.length).toFixed(1)}`);

  return {
    conversations: createdIds.length,
    messages: totalMessages,
  };
}