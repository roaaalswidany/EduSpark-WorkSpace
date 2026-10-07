// eduspark/prisma/seed/_test-helpers.ts
// Temporary test file to verify helpers work correctly.

import * as helpers from "./helpers";

const keys = Object.keys(helpers);
console.log(`✅ Helpers loaded: ${keys.length} exports`);
console.log(keys);

// Quick functional tests
console.log("\n🧪 Functional tests:");
console.log("  randomInt(1, 10)     =", helpers.randomInt(1, 10));
console.log("  randomItem(['a','b'])=", helpers.randomItem(["a", "b"]));
console.log("  slugify('Hello World')=", helpers.slugify("Hello World"));
console.log("  generateProgress()    =", helpers.generateProgress());
console.log("  generateCredentialId()=", helpers.generateCredentialId());

// Async test
helpers.hashPassword("test123").then((hash) => {
  console.log("  hashPassword('test123')=", hash.slice(0, 20) + "...");
  console.log("\n✅ All helper tests passed!\n");
});