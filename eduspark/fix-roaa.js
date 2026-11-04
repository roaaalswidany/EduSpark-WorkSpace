/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Password123!', 12);
  await db.user.update({
    where: { email: 'roaaswidany@gmail.com' },
    data: { password: hash, emailVerified: new Date() }
  });
  console.log('✅ تم تعيين كلمة المرور بنجاح!');
}

main().catch(console.error).finally(() => db.$disconnect());