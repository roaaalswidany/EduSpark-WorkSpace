const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'eduspark/app/dashboard/page.tsx');

if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. مسح أي رموز مشوهة بعد الاسم (مثل J'k أو أي رموز غريبة)
    content = content.replace(/J'k/g, '');
    content = content.replace(/ًں‘‹/g, ''); // الرمز الأصلي المشوه
    
    // 2. إضافة أيقونة اليد بجانب الاسم في العنوان (Welcome back)
    // السكريبت بيدور على "Welcome back, {user.name}" وبيضيف الأيقونة جنبه
    content = content.replace(/(Welcome back,\s*\{[^}]+\})/, '$1 <Hand className="inline-block w-8 h-8 text-amber-400 ml-2" />');

    // 3. التأكد من استيراد أيقونة Hand من مكتبة lucide-react
    if (!content.includes('Hand')) {
        content = content.replace(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/, 'import { Hand, $1 } from "lucide-react"');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ تم إصلاح العنوان وإضافة أيقونة اليد بنجاح!');
} else {
    console.log('❌ لم يتم العثور على الملف!');
}