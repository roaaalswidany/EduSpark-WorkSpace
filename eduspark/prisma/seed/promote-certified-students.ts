import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main() {
  console.log("\n🎯 Promoting certified students to CREATOR...\n");

  // Find all STUDENT users with at least 1 certificate
  const candidates = await db.user.findMany({
    where: {
      role: "STUDENT",
      certificates: { some: {} },
    },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { certificates: true } },
    },
  });

  console.log(`Found ${candidates.length} candidates\n`);

  if (candidates.length === 0) {
    console.log("✅ No promotion needed. All certified users are already CREATOR.\n");
    return;
  }

  for (const user of candidates) {
    await db.user.update({
      where: { id: user.id },
      data: { role: "CREATOR" },
    });
    console.log(
      `  ✅ ${user.name} (${user.email}) — ${user._count.certificates} certs → CREATOR`
    );
  }

  console.log(
    `\n═══════════════════════════════════════════════`
  );
  console.log(`  Total promoted: ${candidates.length}`);
  console.log(
    `═══════════════════════════════════════════════\n`
  );
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });