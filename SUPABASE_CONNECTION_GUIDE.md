# تعليمات Supabase - اختيار الـ Connection String الصحيح

## المشكلة الحالية
الخطأ: `getaddrinfo ENOTFOUND db.dywmmrhbjrhbjatrsqhy.supabase.co`

هذا يعني:
1. **المشروع Supabase قد يكون متوقف** (paused or deleted)
2. أو **الـ hostname غير صحيح**

## ✅ الحل

### الخطوة 1: افتح Supabase Dashboard
1. اذهب إلى: https://supabase.com/dashboard
2. افتح مشروعك
3. اذهب إلى **Settings** → **Database**

### الخطوة 2: انسخ الـ Connection String الصحيح
في صفحة Database، ستجد قسم **Connection String**.

اختر واحد من:
- **Transaction Mode** (Pooler - Port 6543) ← **مُوصى به لـ Render Free**
- **Session Mode** (Direct - Port 5432)

### الخطوة 3: عدّل `.env`

#### خيار 1: استخدام Pooler (الأفضل لـ Render)
```env
PORT=3100
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

#### خيار 2: استخدام Direct Connection
```env
PORT=3100
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.dywmmrhbjrhbjatrsqhy.supabase.co:5432/postgres
```

**هام**: استبدل `[YOUR-PASSWORD]` بكلمة المرور الحقيقية!

### الخطوة 4: تأكد من أن المشروع نشط
في Supabase Dashboard:
- تأكد أن المشروع **Active** (ليس Paused)
- إذا كان متوقف، اضغط **Resume** أو **Restore**

### الخطوة 5: ارفع التعديلات
```bash
git add .
git commit -m "fix: update database connection string"
git push
```

## 📝 ملاحظة
الكود الآن يدعم كلا الخيارين ويعطيك رسائل واضحة عن نوع الاتصال المستخدم.
