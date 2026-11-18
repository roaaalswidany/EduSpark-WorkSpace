const fs = require('fs');
const path = require('path');

const filesToFix = [
  'eduspark/app/dashboard/admin/courses/_components/courses-table.tsx',
  'eduspark/app/dashboard/admin/services/_components/services-table.tsx',
  'eduspark/app/dashboard/admin/users/_components/users-table.tsx',
  'eduspark/app/dashboard/admin/_components/broadcast-form.tsx',
  'eduspark/app/dashboard/career-path/_components/path-timeline.tsx',
  'eduspark/app/dashboard/creator/courses/_components/create-course-form.tsx',
  'eduspark/app/dashboard/creator/services/new/_components/service-creation-form.tsx',
  'eduspark/components/reviews/course-reviews.tsx'
];

const replacements = {
  'آ·': '·',
  'â€”': '—',
  'â€“': '–',
  'â€ک': "'",
  'â€œ': '“',
  'â€': '”',
  'ًںڑ€': '🚀',
  'ًں“Œ': '📌',
  'ًں—„ï¸ڈ': '🗄️',
  'â–¶ï¸ڈ': '▶️',
  'âڈ¸ï¸ڈ': '⏸️',
  'ًںژ‰': '🎉',
  'ًں“¬': '📬',
  'ًں”گ': '🔐',
  'ًں‘‹': '👋'
};

let fixedCount = 0;

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;

    Object.keys(replacements).forEach(key => {
      content = content.split(key).join(replacements[key]);
    });

    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Cleaned encoding in: ${file}`);
      fixedCount++;
    }
  }
});
console.log(`\n🎉 Done! Fixed ${fixedCount} files.`);