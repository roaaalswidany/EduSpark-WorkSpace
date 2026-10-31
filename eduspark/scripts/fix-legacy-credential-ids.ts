import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function generateCredentialId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(16).substring(2, 14).toUpperCase();
  return `EDU-${ts}-${rand}`;
}

async function main() {
  const { db } = await import("../lib/db");

  const VALID_RE = /^EDU-[0-9A-Z]{6,12}-[0-9A-F]{12}$/;

  const all = await db.certificate.findMany({
    select: { id: true, credentialId: true, issuedAt: true },
  });

  console.log(`\n🔍 Scanning ${all.length} certificate(s)...\n`);

  const legacy = all.filter((c) => !VALID_RE.test(c.credentialId));

  if (legacy.length === 0) {
    console.log("✅ All certificates already use the new format. Nothing to fix.\n");
    await db.$disconnect();
    return;
  }

  console.log(`⚠️  Found ${legacy.length} legacy certificate(s):\n`);
  legacy.forEach((c) => console.log(`   - ${c.credentialId} (issued ${c.issuedAt.toISOString()})`));

  console.log("\n🛠️  Updating to new format...\n");

  let fixed = 0;
  for (const cert of legacy) {
    let newId = generateCredentialId();
    // Ensure uniqueness
    let attempts = 0;
    while (await db.certificate.findUnique({ where: { credentialId: newId } })) {
      newId = generateCredentialId();
      attempts++;
      if (attempts > 5) throw new Error("Could not generate unique ID");
    }

    await db.certificate.update({
      where: { id: cert.id },
      data: { credentialId: newId },
    });

    console.log(`   ✓ ${cert.credentialId} → ${newId}`);
    fixed++;
  }

  console.log(`\n🎉 Done! Fixed ${fixed} certificate(s).\n`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});