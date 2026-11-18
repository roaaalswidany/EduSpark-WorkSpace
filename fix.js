const fs = require('fs');

const filesToFix = [
    './eduspark/components/auth/verify-email-banner.tsx',
    './eduspark/app/dashboard/settings/page.tsx',
    './eduspark/app/dashboard/achievements/_components/badges-grid.tsx',
    './eduspark/app/dashboard/career-path/page.tsx',
    './eduspark/app/dashboard/career-path/_components/career-path-view.tsx'
];

let fixedCount = 0;

filesToFix.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. إصلاح الشريط البرتقالي (جعله خلفية باهتة ونص داكن)
    content = content.replace(/bg-(amber|orange|yellow)-500\s+text-white/g, 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20');
    content = content.replace(/bg-(amber|orange|yellow)-600\s+text-white/g, 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20');

    // 2. إصلاح الشارة البرتقالية الفارغة في صفحة الإعدادات
    if (file.includes('settings')) {
        content = content.replace(/bg-amber-500(?!\/)/g, 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20');
    }

    // 3. إصلاح النصوص البيضاء المختفية على الخلفيات البيضاء (الإنجازات والمسار الوظيفي)
    content = content.replace(/className="([^"]*)"/g, (match, classes) => {
        if ((classes.includes('bg-card') || classes.includes('bg-white') || classes.includes('bg-background')) && classes.includes('text-white')) {
            return `className="${classes.replace(/\btext-white\b/g, 'text-foreground')}"`;
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ تم إصلاح: ${file}`);
        fixedCount++;
    }
});

console.log(`\n🎉 انتهى! تم إصلاح ${fixedCount} ملفات محددة.`);