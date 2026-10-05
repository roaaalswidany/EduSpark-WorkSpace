// ============================================================================
// سكربت التحقّق من سلامة سجلّات التدقيق
// الاستخدام: npx tsx src/scripts/verify-audit-logs.ts [YYYY-MM-DD]
// ============================================================================

import path from "path";
import { verifyAuditLogIntegrity } from "../lib/audit-logger";

async function main() {
  const date = process.argv[2] ?? new Date().toISOString().split("T")[0];
  const logFile = path.resolve(
    process.cwd(),
    "logs",
    "audit",
    `audit-${date}.log`
  );

  console.log(`\n🔍 Verifying audit log: ${logFile}\n`);

  try {
    const result = await verifyAuditLogIntegrity(logFile);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📊 Total Records:   ${result.totalRecords}`);
    console.log(`✅ Valid Records:   ${result.validRecords}`);
    console.log(`❌ Tampered:        ${result.tamperedRecords.length}`);
    console.log(`🔗 Chain Intact:    ${result.chainBroken ? "NO ⚠️" : "YES ✅"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (result.chainBroken) {
      console.error(`\n⚠️  Chain broken at record: ${result.chainBreakAt}`);
    }

    if (result.tamperedRecords.length > 0) {
      console.error("\n❌ Tampered records detected:");
      result.tamperedRecords.forEach((r) => {
        console.error(`  ID: ${r.id}`);
        console.error(`  Time: ${r.timestamp}`);
        console.error(`  Reason: ${r.reason}\n`);
      });

      process.exit(1); // exit code 1 = تلاعب مكتشَف
    }

    console.log("\n✅ All audit records verified successfully.\n");
    process.exit(0);
  } catch (error) {
    console.error("Fatal verification error:", error);
    process.exit(2);
  }
}

main();