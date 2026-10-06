import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@eduspark.dev";
const ADMIN_PASSWORD = "Password123!";
const OWNER_EMAIL = "roaaswidany@gmail.com";

async function main() {
  console.log("🔧 Setting up admin access...\n");

  // 1. Create admin account if it doesn't exist
  const existingAdmin = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });

  if (!existingAdmin) {
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.user.create({
      data: {
        name: "EduSpark Admin",
        email: ADMIN_EMAIL,
        password: hashed,
        role: "ADMIN",
        headline: "Platform Administrator",
        isActive: true,
      },
    });
    console.log(`✅ Admin created: ${ADMIN_EMAIL}`);
  } else {
    console.log(`ℹ️  Admin already exists: ${ADMIN_EMAIL}`);
  }

  // 2. Upgrade the owner account to ADMIN
  const owner = await db.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true, role: true },
  });

  if (owner) {
    if (owner.role !== "ADMIN") {
      await db.user.update({
        where: { id: owner.id },
        data: { role: "ADMIN" },
      });
      console.log(`✅ Upgraded ${OWNER_EMAIL} → ADMIN`);
    } else {
      console.log(`ℹ️  ${OWNER_EMAIL} is already ADMIN`);
    }
  } else {
    console.log(`⚠️  Owner account ${OWNER_EMAIL} not found`);
  }

  console.log("\n🎉 Admin setup complete!\n");
  console.log("📧 Admin credentials:");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });