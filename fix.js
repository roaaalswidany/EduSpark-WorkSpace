const fs = require('fs');
const path = require('path');

// الملفات اللي فيها العناوين البيضاء والمشاكل
const filesToFix = [
    'eduspark/app/dashboard/page.tsx',
    'eduspark/app/dashboard/notifications/page.tsx',
    'eduspark/app/dashboard/notifications/_components/notifications-client.tsx',
    'eduspark/app/dashboard/achievements/page.tsx',
    'eduspark/app/dashboard/achievements/_components/level-card.tsx',
    'eduspark/app/dashboard/admin/page.tsx',
    'eduspark/app/dashboard/settings/_components/change-password-form.tsx'
];

let fixedCount = 0;

filesToFix.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let original = content;

        // 1. إصلاح ألوان النصوص (اللايت مود)
        content = content.replace(/text-white/g, 'text-foreground');
        content = content.replace(/text-zinc-50/g, 'text-foreground');
        content = content.replace(/text-slate-50/g, 'text-foreground');

        // 2. استبدال إيموجي التلويح المكسور (J'k) بأيقونة Hand
        if (content.includes("J'k")) {
            content = content.replace(/J'k/g, '<Hand className="inline-block w-7 h-7 text-amber-400 ml-1" />');
            // إضافة أيقونة Hand للاستيراد
            if (!content.includes('Hand')) {
                if (content.includes('from "lucide-react"')) {
                    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/, 'import { Hand, $1 } from "lucide-react"');
                } else if (content.includes("from 'lucide-react'")) {
                    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/, 'import { Hand, $1 } from "lucide-react"');
                } else {
                    content = 'import { Hand } from "lucide-react";\n' + content;
                }
            }
        }

        // 3. استبدال إيموجي القفل المكسور (ًں”گ) بأيقونة Lock
        if (content.includes("ًں”گ")) {
            content = content.replace(/"Password updated successfully! ًں”گ"/g, '(<span className="flex items-center gap-2">Password updated successfully! <Lock className="w-4 h-4" /></span>)');
            // إضافة أيقونة Lock للاستيراد
            if (!content.includes('Lock')) {
                if (content.includes('from "lucide-react"')) {
                    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/, 'import { Lock, $1 } from "lucide-react"');
                } else if (content.includes("from 'lucide-react'")) {
                    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/, 'import { Lock, $1 } from "lucide-react"');
                } else {
                    content = 'import { Lock } from "lucide-react";\n' + content;
                }
            }
        }

        // إصلاح خطأ كتابي في زر تغيير الباسورد
        content = content.replace(/disabled:opacity-50transition-colors/g, 'disabled:opacity-50 transition-colors');

        if (content !== original) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`✅ تم إصلاح: ${file}`);
            fixedCount++;
        }
    }
});
console.log(`\n🎉 انتهى! تم إصلاح ${fixedCount} ملفات.`);