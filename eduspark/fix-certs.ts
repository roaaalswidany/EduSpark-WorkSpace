import dotenv from "dotenv";
// تحميل المتغيرات قبل أي استدعاء لقاعدة البيانات
dotenv.config({ path: ".env.local" });

async function main() {
  // استدعاء ديناميكي لضمان تحميل المتغيرات أولاً
  const { db } = await import("./lib/db");

  console.log("🔄 Updating old certificates...");

  // تحديث كل الشهادات التي لا تملك Credential ID صحيح
  const updatedCount = await db.$executeRawUnsafe(`
    UPDATE "certificates"
    SET "credentialId" = 'EDU-' || upper(substring(md5(random()::text) from 1 for 8))
    WHERE "credentialId" IS NULL OR "credentialId" NOT LIKE 'EDU-%';
  `);

  console.log(`✅ Successfully updated ${updatedCount} certificates!`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});