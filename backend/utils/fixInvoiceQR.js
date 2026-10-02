/**
 * fixInvoiceQR.js
 * ================
 * دالة لإصلاح QR Code الخاطئ في فواتير ZATCA المقبولة
 * تُولّد QR Code صحيح بصيغة TLV وتُحدّث قاعدة البيانات بدون المساس ببقية البيانات
 *
 * معيار TLV المستخدم (ZATCA Phase 2):
 *  Tag 1 → اسم الشركة البائعة   (companies.name)
 *  Tag 2 → الرقم الضريبي        (companies.vat_number)
 *  Tag 3 → تاريخ الفاتورة       (invoices.date) — ISO 8601
 *  Tag 4 → الإجمالي شامل الضريبة (invoices.total_after_tax)
 *  Tag 5 → مبلغ ضريبة القيمة المضافة (invoices.vat_amount)
 */

const db        = require('../db');
const DataCache = require('./DataCache');

// ─── بناء حقل TLV واحد ────────────────────────────────────────────────────────
/**
 * يبني حقل TLV واحد (Tag + Length + Value) كـ Buffer
 * @param {number} tag   - رقم الحقل (1–5)
 * @param {string} value - القيمة النصية للحقل
 * @returns {Buffer}
 */
function buildTLVField(tag, value) {
  const valueBytes = Buffer.from(String(value), 'utf8');
  const tlvBuffer  = Buffer.alloc(2 + valueBytes.length);

  tlvBuffer.writeUInt8(tag, 0);               // Tag
  tlvBuffer.writeUInt8(valueBytes.length, 1); // Length
  valueBytes.copy(tlvBuffer, 2);              // Value

  return tlvBuffer;
}

// ─── توليد QR Code بصيغة TLV ثم تحويله إلى Base64 ──────────────────────────
/**
 * يولّد QR Code وفق معيار ZATCA TLV
 * @param {object} invoice - صف مُدمَج من invoices JOIN companies
 *   الحقول المطلوبة: seller_name, tax_id, date, total_after_tax, vat_amount
 * @returns {string} - سلسلة Base64 جاهزة للتخزين
 */
function generateZATCATLVQR(invoice) {
  // التحقق من اكتمال الحقول الإلزامية (مطابِقة لأسماء أعمدة الـ JOIN في app_pg.js)
  const required = ['seller_name', 'tax_id', 'date', 'total_after_tax', 'vat_amount'];
  for (const field of required) {
    if (invoice[field] == null || invoice[field] === '') {
      throw new Error(`الحقل المطلوب غائب أو فارغ: ${field}`);
    }
  }

  // تنسيق التاريخ كـ ISO 8601 (مثل: 2024-01-15T10:30:00Z)
  const invoiceDateISO = new Date(invoice.date).toISOString();

  // تنسيق الأرقام بدقة منزلتين عشريتين
  const totalAmount = parseFloat(invoice.total_after_tax).toFixed(2);
  const vatAmount   = parseFloat(invoice.vat_amount).toFixed(2);

  // بناء حقول TLV
  const tlvBuffers = [
    buildTLVField(1, invoice.seller_name),          // اسم البائع
    buildTLVField(2, String(invoice.tax_id)),        // الرقم الضريبي
    buildTLVField(3, invoiceDateISO),                // التاريخ
    buildTLVField(4, totalAmount),                   // الإجمالي شامل الضريبة
    buildTLVField(5, vatAmount),                     // مبلغ الضريبة
  ];

  // دمج جميع الحقول في Buffer واحد ثم تحويله إلى Base64
  const combinedBuffer = Buffer.concat(tlvBuffers);
  return combinedBuffer.toString('base64');
}

// ─── الدالة الرئيسية ─────────────────────────────────────────────────────────
/**
 * تُصلح QR Code الخاطئ لفاتورة مقبولة من ZATCA
 *
 * @param {number|string} invoiceId - معرّف الفاتورة في قاعدة البيانات
 * @returns {Promise<object>} - صف الفاتورة المحدَّث
 *
 * @throws {Error} إذا لم توجد الفاتورة
 * @throws {Error} إذا كانت حالة الفاتورة ليست ACCEPTED
 * @throws {Error} في حال فشل التحديث أو بيانات ناقصة
 *
 * @example
 * const updatedInvoice = await fixInvoiceQR(42);
 * console.log(updatedInvoice.qr_code); // Base64 TLV
 */
async function fixInvoiceQR(invoiceId) {
  // ── 1. جلب الفاتورة من PostgreSQL ─────────────────────────────────────────
  const result = await db.query(
    `SELECT i.*,
            c.name       AS client_name,
            c.vat_number AS client_vat
     FROM   invoices  i
     LEFT JOIN companies c ON c.id = i.company_id
     WHERE  i.id = $1`,
    [invoiceId]
  );

  if (result.rows.length === 0) {
    throw new Error(`لا توجد فاتورة بالمعرّف: ${invoiceId}`);
  }

  const invoice = result.rows[0];

  // ── 2. التحقق أن الفاتورة مقبولة من ZATCA ───────────────────────────────
  const validStatuses = ['ACCEPTED', 'REPORTED', 'CLEARED', 'REPORTED_WITH_WARNINGS'];
  const currentStatus = (invoice.zatca_status || '').toUpperCase();
  if (!validStatuses.includes(currentStatus)) {
    throw new Error(
      `لا يمكن تعديل QR Code الفاتورة #${invoiceId}. ` +
      `الحالة الحالية: "${invoice.zatca_status}" — المطلوب: ACCEPTED أو REPORTED`
    );
  }

  // ── 3. تحديد QR Code الصحيح ──────────────────────────────────────────
  let newQRCode = null;

  // أ) إذا كان رد الزكاة المخزن يحتوي على الباركود المعتمد والموقّع
  if (invoice.zatca_response) {
    try {
      const zResp = typeof invoice.zatca_response === 'string'
        ? JSON.parse(invoice.zatca_response)
        : invoice.zatca_response;
      if (zResp.qrCode && typeof zResp.qrCode === 'string' && zResp.qrCode.length > 20) {
        newQRCode = zResp.qrCode;
      }
    } catch (e) {}
  }

  // ب) توليد TLV إذا لم يوجد في رد الزكاة
  if (!newQRCode) {
    if (!invoice.seller_name || !invoice.tax_id) {
      try {
        const settingsRes = await db.query('SELECT company_name_ar, vat_number FROM settings WHERE id = 1');
        if (settingsRes.rows.length > 0) {
          invoice.seller_name = invoice.seller_name || settingsRes.rows[0].company_name_ar;
          invoice.tax_id      = invoice.tax_id || settingsRes.rows[0].vat_number;
        }
      } catch (e) {}
    }

    // fallback
    invoice.seller_name = invoice.seller_name || 'مؤسسة عيسى يوسف العامر للتخليص الجمركي';
    invoice.tax_id      = invoice.tax_id || '310137521300003';

    try {
      newQRCode = generateZATCATLVQR(invoice);
    } catch (genError) {
      throw new Error(`فشل توليد QR Code للفاتورة #${invoiceId}: ${genError.message}`);
    }
  }

  // تحقق: إذا كان الـ QR صحيحاً مسبقاً لا داعي للتحديث
  if (invoice.qr_code === newQRCode) {
    console.log(`ℹ️  الفاتورة #${invoiceId}: QR Code صحيح بالفعل، لا يحتاج تحديثاً.`);
    return invoice;
  }

  // ── 4. تحديث حقل qr_code فقط ────────────────────────────────────────────
  const updateResult = await db.query(
    `UPDATE invoices
     SET    qr_code = $1
     WHERE  id = $2
       AND  UPPER(zatca_status) IN ('ACCEPTED', 'REPORTED', 'CLEARED', 'REPORTED_WITH_WARNINGS')
     RETURNING id, status, zatca_status, qr_code, date, total_after_tax, vat_amount`,
    [newQRCode, invoiceId]
  );

  if (updateResult.rowCount === 0) {
    throw new Error(`فشل تحديث QR Code للفاتورة #${invoiceId}: تغيّرت الحالة أثناء المعالجة.`);
  }

  // ── 5. تحديث الـ DataCache ────────────────────────────────────────────────
  DataCache.updateInvoice(invoiceId, { qr_code: newQRCode });

  const updatedInvoice = updateResult.rows[0];
  console.log(`✅ تم إصلاح QR Code الفاتورة #${invoiceId} بنجاح.`);
  return updatedInvoice;
}

// ─── دالة تحديث جميع الفواتير المقبولة دفعةً واحدة ──────────────────────────
/**
 * تجلب جميع فواتير zatca_status = 'ACCEPTED' وتعيد توليد QR Code لكل منها
 *
 * @param {object}  [options]                  - خيارات اختيارية
 * @param {number}  [options.batchSize=50]      - عدد الفواتير لكل دُفعة (لتجنب timeout)
 * @param {number}  [options.delayBetweenMs=0]  - تأخير (ms) بين كل دُفعة (0 = بدون تأخير)
 * @param {boolean} [options.dryRun=false]      - وضع التجربة: يحسب QR بدون حفظ
 *
 * @returns {Promise<{
 *   total:    number,   // إجمالي الفواتير المعالجة
 *   success:  number,   // عدد الناجحة
 *   skipped:  number,   // عدد التي كان QR صحيحاً مسبقاً
 *   failed:   number,   // عدد الفاشلة
 *   errors:   Array<{invoiceId, invoiceNumber, message}>,  // تفاصيل الأخطاء
 *   duration: string    // وقت التنفيذ الكلي
 * }>}
 *
 * @example
 * // تشغيل عادي
 * const report = await fixAllAcceptedInvoicesQR();
 *
 * // وضع التجربة (بدون حفظ)
 * const report = await fixAllAcceptedInvoicesQR({ dryRun: true });
 *
 * // دُفعات صغيرة مع تأخير
 * const report = await fixAllAcceptedInvoicesQR({ batchSize: 20, delayBetweenMs: 200 });
 */
async function fixAllAcceptedInvoicesQR(options = {}) {
  const {
    batchSize      = 50,
    delayBetweenMs = 0,
    dryRun         = false,
  } = options;

  const startTime = Date.now();

  // ─── سجل النتائج ───────────────────────────────────────────────────────────
  const report = {
    total:    0,
    success:  0,
    skipped:  0,
    failed:   0,
    errors:   [],   // [{ invoiceId, invoiceNumber, message }]
    duration: '',
  };

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🚀 بدء إصلاح QR Code لجميع فواتير ZATCA المقبولة`);
  if (dryRun) console.log('⚠️  وضع التجربة (Dry Run) — لن يتم حفظ أي تغييرات');
  console.log('═══════════════════════════════════════════════════════════');

  // ─── 1. جلب جميع الفواتير المقبولة بنظام الصفحات ─────────────────────────
  let allInvoices = [];
  let offset = 0;

  while (true) {
    const pageResult = await db.query(
      `SELECT i.*,
              c.name       AS client_name,
              c.vat_number AS client_vat
       FROM   invoices  i
       LEFT JOIN companies c ON c.id = i.company_id
       WHERE  UPPER(i.zatca_status) IN ('ACCEPTED', 'REPORTED', 'CLEARED', 'REPORTED_WITH_WARNINGS')
       ORDER  BY i.id ASC
       LIMIT  $1 OFFSET $2`,
      [batchSize, offset]
    );

    const page = pageResult.rows;

    if (!page || page.length === 0) break;

    allInvoices = allInvoices.concat(page);
    console.log(`📄 تم جلب ${allInvoices.length} فاتورة حتى الآن...`);

    if (page.length < batchSize) break; // الصفحة الأخيرة
    offset += batchSize;

    if (delayBetweenMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
    }
  }

  report.total = allInvoices.length;
  console.log(`\n📊 إجمالي الفواتير المقبولة: ${report.total}`);

  if (report.total === 0) {
    console.log('ℹ️  لا توجد فواتير بحالة ACCEPTED لمعالجتها.');
    report.duration = _formatDuration(Date.now() - startTime);
    _printSummary(report);
    return report;
  }

  console.log('─────────────────────────────────────────────────────────');

  // ─── 2. معالجة الفواتير دُفعةً دُفعة ─────────────────────────────────────
  for (let i = 0; i < allInvoices.length; i += batchSize) {
    const batch      = allInvoices.slice(i, i + batchSize);
    const batchNum   = Math.floor(i / batchSize) + 1;
    const totalBatch = Math.ceil(allInvoices.length / batchSize);

    console.log(`\n🔄 معالجة الدُفعة ${batchNum}/${totalBatch} (${batch.length} فاتورة)...`);

    const batchResults = await Promise.allSettled(
      batch.map(invoice => _processInvoice(invoice, dryRun))
    );

    batchResults.forEach((result, idx) => {
      const invoice = batch[idx];

      if (result.status === 'fulfilled') {
        if (result.value.skipped) {
          report.skipped++;
          console.log(`  ⏭️  [ID:${invoice.id}] QR صحيح مسبقاً — تخطي`);
        } else {
          report.success++;
          const tag = dryRun ? '🔍' : '✅';
          console.log(`  ${tag} [ID:${invoice.id}] تم ${dryRun ? 'التحقق' : 'الإصلاح'} بنجاح`);
        }
      } else {
        report.failed++;
        const errMsg = result.reason?.message || 'خطأ غير معروف';
        report.errors.push({
          invoiceId: invoice.id,
          message:   errMsg,
        });
        console.error(`  ❌ [ID:${invoice.id}] فشل: ${errMsg}`);
      }
    });

    if (delayBetweenMs > 0 && i + batchSize < allInvoices.length) {
      console.log(`  ⏳ انتظار ${delayBetweenMs}ms قبل الدُفعة التالية...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
    }
  }

  // ─── 3. طباعة التقرير النهائي ──────────────────────────────────────────────
  report.duration = _formatDuration(Date.now() - startTime);
  _printSummary(report);

  return report;
}

// ─── دوال مساعدة داخلية ───────────────────────────────────────────────────────

/**
 * تُعالج فاتورة واحدة (توليد + حفظ أو تخطي)
 * @private
 */
async function _processInvoice(invoice, dryRun) {
  let newQRCode = null;

  // 1. فحص وجود باركود موثق من هيئة الزكاة في zatca_response
  if (invoice.zatca_response) {
    try {
      const zResp = typeof invoice.zatca_response === 'string'
        ? JSON.parse(invoice.zatca_response)
        : invoice.zatca_response;
      if (zResp.qrCode && typeof zResp.qrCode === 'string' && zResp.qrCode.length > 20) {
        newQRCode = zResp.qrCode;
      }
    } catch (e) {}
  }

  // 2. إذا لم يتوفر، نولّد TLV بعد التأكد من اسم البائع والرقم الضريبي
  if (!newQRCode) {
    invoice.seller_name = invoice.seller_name || 'مؤسسة عيسى يوسف العامر للتخليص الجمركي';
    invoice.tax_id      = invoice.tax_id || '310137521300003';
    newQRCode = generateZATCATLVQR(invoice);
  }

  if (invoice.qr_code === newQRCode) {
    return { skipped: true };
  }

  if (dryRun) {
    return { skipped: false, dryRun: true };
  }

  // تحديث قاعدة البيانات مع الحماية المزدوجة
  const result = await db.query(
    `UPDATE invoices
     SET    qr_code = $1
     WHERE  id = $2
       AND  UPPER(zatca_status) IN ('ACCEPTED', 'REPORTED', 'CLEARED', 'REPORTED_WITH_WARNINGS')`,
    [newQRCode, invoice.id]
  );

  if (result.rowCount === 0) {
    throw new Error('تغيّرت حالة الفاتورة أثناء المعالجة');
  }

  DataCache.updateInvoice(invoice.id, { qr_code: newQRCode });

  return { skipped: false };
}


/**
 * يحوّل مدة بالمللي ثانية إلى نص مقروء
 * @private
 */
function _formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return ms < 60000 ? `${s}s` : `${Math.floor(ms / 60000)}m ${(ms % 60000 / 1000).toFixed(0)}s`;
}

/**
 * يطبع ملخص التقرير النهائي
 * @private
 */
function _printSummary(report) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 التقرير النهائي:');
  console.log(`   الإجمالي المعالج : ${report.total}`);
  console.log(`   ✅ نجحت          : ${report.success}`);
  console.log(`   ⏭️  تخطيت (صحيحة): ${report.skipped}`);
  console.log(`   ❌ فشلت          : ${report.failed}`);
  console.log(`   ⏱️  وقت التنفيذ   : ${report.duration}`);

  if (report.errors.length > 0) {
    console.log('\n🔴 تفاصيل الأخطاء:');
    report.errors.forEach(({ invoiceId, invoiceNumber, message }, i) => {
      console.error(`   ${i + 1}. [${invoiceNumber} | ID: ${invoiceId}] → ${message}`);
    });
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

// ─── تصدير الدوال ─────────────────────────────────────────────────────────────
module.exports = {
  fixInvoiceQR,
  fixAllAcceptedInvoicesQR,
  generateZATCATLVQR,
  buildTLVField,
};
