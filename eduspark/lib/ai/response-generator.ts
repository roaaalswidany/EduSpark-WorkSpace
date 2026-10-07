import type { AiIntent, DetectedLanguage } from "./intent-classifier";
import type { UserContext } from "./context-builder";

// ============================================================================
// Generate intelligent responses based on intent + context
// ============================================================================

export interface Suggestion {
  label: string;
  href: string;
}

export interface GeneratedResponse {
  content: string;
  suggestions: Suggestion[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatList(items: string[], max = 3): string {
  const visible = items.slice(0, max);
  return visible.map((i) => `• ${i}`).join("\n");
}

function formatPrice(price: number): string {
  return price === 0 ? "مجاني" : `$${price.toFixed(2)}`;
}

// ─── Response Templates ──────────────────────────────────────────────────────

export function generateResponse(
  intent: AiIntent,
  language: DetectedLanguage,
  context: UserContext
): GeneratedResponse {
  const isAr = language === "ar";

  switch (intent) {
    case "greeting": {
      if (isAr) {
        return {
          content: `أهلاً ${context.name}! 👋\n\nأنا مساعد **EduSpark** الذكي. يمكنني مساعدتك في:\n\n📚 البحث عن كورسات مناسبة لك\n🎓 الحصول على شهادات معتمدة\n🛒 الشراء من السوق\n💼 إدارة خدماتك وطلباتك\n\nكيف يمكنني مساعدتك اليوم؟`,
          suggestions: [
            { label: "📚 اقترح لي كورسات", href: "#recommend" },
            { label: "🎓 شهاداتي", href: "/dashboard/student/certificates" },
            { label: "🛒 تصفح السوق", href: "/marketplace" },
          ],
        };
      }
      return {
        content: `Hi ${context.name}! 👋\n\nI'm **EduSpark**'s smart assistant. I can help you with:\n\n📚 Finding suitable courses\n🎓 Getting certified\n🛒 Buying from the marketplace\n💼 Managing your services and orders\n\nHow can I help you today?`,
        suggestions: [
          { label: "📚 Recommend courses", href: "#recommend" },
          { label: "🎓 My certificates", href: "/dashboard/student/certificates" },
          { label: "🛒 Browse marketplace", href: "/marketplace" },
        ],
      };
    }

    case "thanks": {
      return {
        content: isAr
          ? "على الرحب والسعة! 🌟\n\nإذا احتجت أي مساعدة أخرى، أنا هنا دائماً."
          : "You're welcome! 🌟\n\nIf you need anything else, I'm always here.",
        suggestions: [
          { label: isAr ? "📚 كورساتي" : "📚 My courses", href: "/dashboard/student/courses" },
        ],
      };
    }

    case "my_courses": {
      if (context.enrollmentsCount === 0) {
        return {
          content: isAr
            ? `لم تلتحق بأي كورس بعد يا ${context.name}. 😊\n\nأنصحك ببدء رحلتك التعليمية بأحد الكورسات المقترحة أدناه.`
            : `You haven't enrolled in any course yet, ${context.name}. 😊\n\nI recommend starting with one of the suggested courses below.`,
          suggestions: [
            { label: isAr ? "📚 تصفح الكورسات" : "📚 Browse courses", href: "/courses" },
          ],
        };
      }

      const list = formatList(context.enrolledCourseTitles, 5);
      const passedNote =
        context.completedCoursesCount > 0
          ? isAr
            ? `\n\n✅ أكملت ${context.completedCoursesCount} كورس بنجاح.`
            : `\n\n✅ You've completed ${context.completedCoursesCount} successfully.`
          : "";

      return {
        content: isAr
          ? `📚 أنت ملتحق حالياً بـ **${context.enrollmentsCount}** كورس:\n\n${list}${passedNote}\n\nهل تريد المتابعة؟`
          : `📚 You're enrolled in **${context.enrollmentsCount}** course(s):\n\n${list}${passedNote}\n\nWant to continue?`,
        suggestions: [
          { label: isAr ? "▶️ متابعة التعلم" : "▶️ Continue learning", href: "/dashboard/student/courses" },
        ],
      };
    }

    case "recommend_course": {
      if (context.recommendedCourses.length === 0) {
        return {
          content: isAr
            ? "يبدو أنك أكملت كل الكورسات المتاحة! 🎉\n\nترقب كورسات جديدة قريباً."
            : "It seems you've completed all available courses! 🎉\n\nStay tuned for new ones.",
          suggestions: [],
        };
      }

      const list = context.recommendedCourses
        .map(
          (c) =>
            `📖 **${c.title}**\n   ${c.level.toLowerCase()} · ${
              c.categoryName ?? ""
            } · ${formatPrice(c.price)}`
        )
        .join("\n\n");

      const reasonText =
        context.categoriesOfInterest.length > 0
          ? isAr
            ? `بناءً على اهتمامك بـ ${context.categoriesOfInterest.join(", ")}:`
            : `Based on your interest in ${context.categoriesOfInterest.join(", ")}:`
          : isAr
          ? "إليك كورسات مقترحة:"
          : "Here are some suggestions:";

      return {
        content: isAr
          ? `🎯 ${reasonText}\n\n${list}`
          : `🎯 ${reasonText}\n\n${list}`,
        suggestions: context.recommendedCourses.map((c) => ({
          label: `📖 ${c.title}`,
          href: `/courses/${c.slug}`,
        })),
      };
    }

    case "course_catalog": {
      return {
        content: isAr
          ? "📚 يمكنك تصفح كل الكورسات المتاحة في EduSpark.\n\nاستخدم البحث والفلترة للعثور على ما يناسبك."
          : "📚 You can browse all available courses on EduSpark.\n\nUse search and filters to find what suits you.",
        suggestions: [
          { label: isAr ? "📚 كل الكورسات" : "📚 All courses", href: "/courses" },
        ],
      };
    }

    case "my_certificates": {
      if (context.certificatesCount === 0) {
        return {
          content: isAr
            ? `لم تحصل على أي شهادة بعد. 🎓\n\nلتحصل على شهادة:\n1. التحق بكورس\n2. أكمل جميع الدروس\n3. اجتز الاختبار بنسبة **80%** أو أعلى`
            : `You haven't earned any certificate yet. 🎓\n\nTo get certified:\n1. Enroll in a course\n2. Complete all lessons\n3. Pass the quiz with **80%** or higher`,
          suggestions: [
            { label: isAr ? "📚 تصفح الكورسات" : "📚 Browse courses", href: "/courses" },
            { label: isAr ? "🎓 كورساتي" : "🎓 My courses", href: "/dashboard/student/courses" },
          ],
        };
      }

      const list = formatList(context.certifiedCourseTitles, 5);

      return {
        content: isAr
          ? `🎉 رائع! حصلت على **${context.certificatesCount}** شهادة:\n\n${list}\n\nكل شهادة معها **Credential ID** فريد للتحقق.`
          : `🎉 Amazing! You've earned **${context.certificatesCount}** certificate(s):\n\n${list}\n\nEach has a unique **Credential ID** for verification.`,
        suggestions: [
          { label: isAr ? "🎓 عرض الشهادات" : "🎓 View certificates", href: "/dashboard/student/certificates" },
        ],
      };
    }

    case "how_to_get_certified": {
      return {
        content: isAr
          ? "🎓 **كيف تحصل على شهادة؟**\n\n1️⃣ التحق بكورس من صفحة الكورسات\n2️⃣ أكمل جميع الدروس (شاهدها كاملة)\n3️⃣ اجتز اختبار الشهادة\n4️⃣ احصل على **80%** أو أكثر\n\n✨ بمجرد النجاح، يتم إصدار الشهادة تلقائياً مع Credential ID فريد!"
          : "🎓 **How to get certified?**\n\n1️⃣ Enroll in a course\n2️⃣ Complete all lessons\n3️⃣ Take the certification quiz\n4️⃣ Score **80%** or higher\n\n✨ Once passed, your certificate is issued automatically with a unique Credential ID!",
        suggestions: [
          { label: isAr ? "📚 تصفح الكورسات" : "📚 Browse courses", href: "/courses" },
        ],
      };
    }

    case "how_to_enroll": {
      return {
        content: isAr
          ? "📖 **كيف تلتحق بكورس؟**\n\n1. اذهب إلى صفحة الكورسات\n2. اختر الكورس المناسب\n3. اضغط **Enroll** واختر طريقة الدفع\n4. ابدأ التعلم فوراً!\n\n💡 الكورسات المجانية تظهر بـ **Free**."
          : "📖 **How to enroll?**\n\n1. Go to the courses page\n2. Choose a course\n3. Click **Enroll** and complete payment\n4. Start learning right away!\n\n💡 Free courses are marked as **Free**.",
        suggestions: [
          { label: isAr ? "📚 الكورسات" : "📚 Courses", href: "/courses" },
        ],
      };
    }

    case "quiz_help": {
      return {
        content: isAr
          ? "📝 **عن الاختبارات:**\n\n• كل كورس له اختبار شهادة واحد\n• درجة النجاح: **80%**\n• يمكنك إعادة الاختبار عدة مرات\n• بعد النجاح تصدر شهادتك تلقائياً\n\n💡 ركز على الدروس قبل الاختبار!"
          : "📝 **About quizzes:**\n\n• Each course has one certification quiz\n• Passing score: **80%**\n• You can retake as many times as you need\n• Certificate is issued automatically on pass\n\n💡 Review lessons before taking it!",
        suggestions: [],
      };
    }

    case "marketplace_help": {
      return {
        content: isAr
          ? "🛒 **سوق EduSpark:**\n\n• اشترِ خدمات من منشئين معتمدين\n• كل منشئ لديه شهادة موثقة\n• تواصل مباشرة عبر الشات\n• ادفع بأمان مع نظام الضمان\n\nتصفح الخدمات حسب التصنيف والسعر."
          : "🛒 **EduSpark Marketplace:**\n\n• Buy from certified creators\n• Every creator is verified\n• Chat directly and securely\n• Escrow-protected payments\n\nBrowse by category and price.",
        suggestions: [
          { label: isAr ? "🛒 تصفح السوق" : "🛒 Browse marketplace", href: "/marketplace" },
        ],
      };
    }

    case "become_creator": {
      const hasCert = context.certificatesCount > 0;

      if (hasCert) {
        return {
          content: isAr
            ? "🎨 **أنت بالفعل منشئ معتمد!** ✨\n\nيمكنك الآن:\n• نشر خدمات جديدة\n• استقبال طلبات العملاء\n• إدارة مشاريعك\n\nابدأ بنشر خدمتك الأولى!"
            : "🎨 **You're already a verified creator!** ✨\n\nYou can now:\n• Publish new services\n• Receive client orders\n• Manage your projects\n\nStart by publishing your first service!",
          suggestions: [
            { label: isAr ? "➕ نشر خدمة جديدة" : "➕ New service", href: "/dashboard/creator/services/new" },
            { label: isAr ? "📦 خدماتي" : "📦 My services", href: "/dashboard/creator/services" },
          ],
        };
      }

      return {
        content: isAr
          ? "🎨 **كيف تصبح منشئاً؟**\n\nلنشر خدمات على EduSpark، يجب أولاً:\n\n1. التحق بكورس\n2. اجتز الاختبار بنجاح (**80%+**)\n3. سيتم ترقية حسابك تلقائياً إلى **منشئ معتمد**!\n\n💡 هذا يضمن جودة الخدمات."
          : "🎨 **How to become a creator?**\n\nTo publish services, you must first:\n\n1. Enroll in a course\n2. Pass the quiz (**80%+**)\n3. Your account is upgraded automatically to **Verified Creator**!\n\n💡 This ensures service quality.",
        suggestions: [
          { label: isAr ? "📚 تصفح الكورسات" : "📚 Browse courses", href: "/courses" },
        ],
      };
    }

    case "my_services": {
      if (context.servicesCount === 0) {
        return {
          content: isAr
            ? "لم تنشر أي خدمة بعد.\n\nلنشر خدمتك الأولى، يجب أن تحصل على شهادة أولاً."
            : "You haven't published any service yet.\n\nTo publish your first service, you need a certificate first.",
          suggestions: [
            { label: isAr ? "➕ نشر خدمة" : "➕ New service", href: "/dashboard/creator/services/new" },
          ],
        };
      }

      return {
        content: isAr
          ? `📦 لديك **${context.servicesCount}** خدمة، منها **${context.activeServicesCount}** نشطة.\n\nيمكنك إدارتها وتعديلها من Studio.`
          : `📦 You have **${context.servicesCount}** service(s), with **${context.activeServicesCount}** active.\n\nManage them from your Studio.`,
        suggestions: [
          { label: isAr ? "📦 خدماتي" : "📦 My services", href: "/dashboard/creator/services" },
        ],
      };
    }

    case "order_help": {
      return {
        content: isAr
          ? "🛒 **كيف تطلب خدمة؟**\n\n1. افتح السوق واختر خدمة\n2. اضغط **Order Now**\n3. اكتب متطلباتك\n4. سيتم فتح مشروع + غرفة شات مع المنشئ\n5. تابع العمل عبر Milestones"
          : "🛒 **How to order a service?**\n\n1. Open marketplace and pick a service\n2. Click **Order Now**\n3. Describe your requirements\n4. A project + chat room opens with the creator\n5. Track progress via Milestones",
        suggestions: [
          { label: isAr ? "🛒 السوق" : "🛒 Marketplace", href: "/marketplace" },
        ],
      };
    }

    case "my_orders": {
      const total = context.ordersAsBuyer + context.ordersAsCreator;
      if (total === 0) {
        return {
          content: isAr
            ? "ليس لديك أي طلبات بعد.\n\nاطلب خدمة من السوق لتبدأ!"
            : "You don't have any orders yet.\n\nOrder a service from the marketplace to begin!",
          suggestions: [
            { label: isAr ? "🛒 تصفح السوق" : "🛒 Browse marketplace", href: "/marketplace" },
          ],
        };
      }

      return {
        content: isAr
          ? `📋 طلباتك:\n\n• كمشتري: **${context.ordersAsBuyer}**\n• كمنشئ: **${context.ordersAsCreator}**`
          : `📋 Your orders:\n\n• As buyer: **${context.ordersAsBuyer}**\n• As creator: **${context.ordersAsCreator}**`,
        suggestions: [
          { label: isAr ? "📋 طلباتي" : "📋 My orders", href: "/dashboard/orders" },
          { label: isAr ? "📥 الطلبات الواردة" : "📥 Incoming orders", href: "/dashboard/creator/orders" },
        ],
      };
    }

    case "chat_help": {
      return {
        content: isAr
          ? "💬 **المحادثات في EduSpark:**\n\n• محادثات الكورسات (جماعية)\n• محادثات المشاريع (ثنائية)\n• إشعارات فورية\n\nكل المحادثات مشفرة ومُسجلة قانونياً للمشاريع."
          : "💬 **Chats on EduSpark:**\n\n• Course chats (group)\n• Project chats (private)\n• Real-time notifications\n\nAll project chats are encrypted and legally recorded.",
        suggestions: [
          { label: isAr ? "💬 كل المحادثات" : "💬 All chats", href: "/dashboard/chat" },
        ],
      };
    }

    case "profile_help": {
      return {
        content: isAr
          ? "👤 **ملفك الشخصي:**\n\nيمكنك تعديل:\n• الاسم\n• النبذة (Bio)\n• العنوان الوظيفي\n• الموقع الإلكتروني\n\nملفك يظهر للآخرين عند النقر على اسمك."
          : "👤 **Your profile:**\n\nYou can edit:\n• Name\n• Bio\n• Headline\n• Website\n\nYour profile appears when others click your name.",
        suggestions: [
          { label: isAr ? "👤 ملفي" : "👤 My profile", href: "/dashboard/profile" },
        ],
      };
    }

    case "pricing": {
      return {
        content: isAr
          ? "💰 **الأسعار في EduSpark:**\n\n• الكورسات: من **$0** (مجاني) إلى **$10,000**\n• الخدمات: يحددها المنشئ (من $5)\n• الدفع آمن مع نظام ضمان\n\nتصفح حسب السعر باستخدام الفلاتر."
          : "💰 **Pricing on EduSpark:**\n\n• Courses: **$0** (free) to **$10,000**\n• Services: set by creator (from $5)\n• Secure payments with escrow\n\nFilter by price to browse.",
        suggestions: [
          { label: isAr ? "📚 الكورسات" : "📚 Courses", href: "/courses" },
          { label: isAr ? "🛒 الخدمات" : "🛒 Services", href: "/marketplace" },
        ],
      };
    }

    case "technical_support": {
      return {
        content: isAr
          ? "🔧 **واجهت مشكلة تقنية؟**\n\nجرب:\n1. **تحديث الصفحة** (Ctrl+F5)\n2. **مسح الكاش**\n3. **إعادة تسجيل الدخول**\n4. **تجربة متصفح آخر**\n\nإذا استمرت المشكلة، تواصل مع الفريق."
          : "🔧 **Having a technical issue?**\n\nTry:\n1. **Refresh** (Ctrl+F5)\n2. **Clear cache**\n3. **Sign out and back in**\n4. **Try another browser**\n\nIf it persists, contact support.",
        suggestions: [],
      };
    }

    case "about_platform": {
      return {
        content: isAr
          ? "🌟 **EduSpark** — منصة تعليم + سوق عمل\n\nنربط بين:\n• **التعلم الموثق** — كورسات وشهادات معتمدة\n• **العمل الحر المقيّد** — خدمات من منشئين موثقين\n\n✨ كل منشئ أثبت مهاراته عبر الكورسات.\n🎯 جودة مضمونة + ثقة كاملة."
          : "🌟 **EduSpark** — Learning + Marketplace\n\nWe connect:\n• **Verified Learning** — certified courses\n• **Gated Freelancing** — services from verified creators\n\n✨ Every creator proved their skills through courses.\n🎯 Guaranteed quality + full trust.",
        suggestions: [
          { label: isAr ? "📚 الكورسات" : "📚 Courses", href: "/courses" },
          { label: isAr ? "🛒 السوق" : "🛒 Marketplace", href: "/marketplace" },
        ],
      };
    }

    case "fallback":
    default: {
      return {
        content: isAr
          ? `عذراً، لم أفهم سؤالك بالضبط. 🤔\n\nيمكنني مساعدتك في:\n\n📚 الكورسات والشهادات\n🛒 السوق والخدمات\n📋 الطلبات والمشاريع\n💬 المحادثات\n\nجرب صياغة أخرى، أو اختر من الاقتراحات.`
          : `Sorry, I didn't quite understand. 🤔\n\nI can help with:\n\n📚 Courses & certificates\n🛒 Marketplace & services\n📋 Orders & projects\n💬 Chats\n\nTry rephrasing, or pick a suggestion.`,
        suggestions: [
          { label: isAr ? "📚 اقترح كورسات" : "📚 Recommend courses", href: "#recommend" },
          { label: isAr ? "🎓 كيف أحصل على شهادة؟" : "🎓 How to get certified?", href: "#certified" },
          { label: isAr ? "🛒 السوق" : "🛒 Marketplace", href: "/marketplace" },
        ],
      };
    }
  }
}