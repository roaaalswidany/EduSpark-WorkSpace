const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./eduspark/app').concat(walk('./eduspark/components'));
let fixedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. إصلاح حقول الـ Input الذكية
    content = content.replace(/<input([^>]*)>/g, (match, attrs) => {
        if (attrs.includes('placeholder="••••••••"')) {
            // إذا كان حقل باسورد، نتركه كما هو
            if (attrs.includes('type="password"')) {
                return match;
            }
            // إذا كان حقل إيميل
            if (attrs.includes('type="email"') || attrs.includes('name="email"')) {
                return `<input${attrs.replace('placeholder="••••••••"', 'placeholder="you@example.com"')}>`;
            }
            // إذا كان حقل بحث
            if (attrs.includes('type="search"')) {
                return `<input${attrs.replace('placeholder="••••••••"', 'placeholder="Search..."')}>`;
            }
            // إذا كان حقل اسم
            if (attrs.includes('name="name"')) {
                return `<input${attrs.replace('placeholder="••••••••"', 'placeholder="John Doe"')}>`;
            }
            // إذا كان حقل عنوان
            if (attrs.includes('name="title"')) {
                return `<input${attrs.replace('placeholder="••••••••"', 'placeholder="e.g., Complete Web Development"')}>`;
            }
            // إذا كان حقل سعر
            if (attrs.includes('type="number"') || attrs.includes('name="price"')) {
                return `<input${attrs.replace('placeholder="••••••••"', 'placeholder="0.00"')}>`;
            }
            // أي حقل نصي آخر
            return `<input${attrs.replace('placeholder="••••••••"', 'placeholder="Enter text..."')}>`;
        }
        return match;
    });

    // 2. إصلاح حقول النصوص الطويلة (Textarea)
    content = content.replace(/<textarea([^>]*)>/g, (match, attrs) => {
        if (attrs.includes('placeholder="••••••••"')) {
            return `<textarea${attrs.replace('placeholder="••••••••"', 'placeholder="Write something..."')}>`;
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ تم استعادة النصوص في: ${file}`);
        fixedCount++;
    }
});

console.log(`\n🎉 انتهى! تم إصلاح النصوص في ${fixedCount} ملفات.`);