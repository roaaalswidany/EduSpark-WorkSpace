const fs = require('fs');

const file = 'eduspark/app/(public)/courses/[slug]/page.tsx';

if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. تحويل أي خلفية داكنة إلى خلفية النظام (تصبح بيضاء في اللايت مود)
    content = content.replaceAll('bg-slate-950', 'bg-background');
    content = content.replaceAll('bg-zinc-950', 'bg-background');
    content = content.replaceAll('bg-slate-900', 'bg-background');
    content = content.replaceAll('bg-zinc-900', 'bg-background');
    content = content.replaceAll('bg-black', 'bg-background');

    // 2. تحويل النصوص البيضاء إلى نص النظام (يصبح أسود في اللايت مود)
    content = content.replaceAll('text-white', 'text-foreground');
    content = content.replaceAll('text-slate-50', 'text-foreground');
    content = content.replaceAll('text-zinc-50', 'text-foreground');

    // 3. تحويل النصوص الرمادية الفاتحة إلى رمادي مقروء
    content = content.replaceAll('text-slate-300', 'text-muted-foreground');
    content = content.replaceAll('text-slate-400', 'text-muted-foreground');
    content = content.replaceAll('text-zinc-300', 'text-muted-foreground');
    content = content.replaceAll('text-zinc-400', 'text-muted-foreground');

    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ تم إصلاح صفحة الكورس بالكامل وبشكل قسري!');
} else {
    console.log('❌ لم يتم العثور على الملف');
}