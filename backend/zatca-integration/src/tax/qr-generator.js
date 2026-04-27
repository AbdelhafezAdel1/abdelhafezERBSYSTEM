/**
 * ZATCA Phase 2 TLV QR Code Generator
 */

/**
 * دالة مساعدة لتحويل النص أو الرقم إلى صيغة TLV (Tag, Length, Value)
 * @param {number} tag - رقم التاج (1 إلى 9)
 * @param {string} value - القيمة المراد تحويلها
 * @returns {Buffer} - القيمة بصيغة Buffer
 */
function getTLVBuffer(tag, value) {
    const valueBuffer = Buffer.from(String(value), 'utf8');
    const tagBuffer = Buffer.from([tag]);
    const lengthBuffer = Buffer.from([valueBuffer.length]);
    return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
}

/**
 * إنشاء رمز الاستجابة السريع (QR Code) المتوافق مع المرحلة الثانية لهيئة الزكاة
 * @param {Object} data - البيانات المطلوبة للباركود
 * @param {string} data.sellerName - اسم البائع
 * @param {string} data.vatNumber - الرقم الضريبي للبائع (15 رقم)
 * @param {string} data.timestamp - وقت وتاريخ الفاتورة (YYYY-MM-DDTHH:mm:ssZ)
 * @param {number} data.invoiceTotal - إجمالي الفاتورة مع الضريبة
 * @param {number} data.vatTotal - إجمالي الضريبة
 * @param {string} data.xmlHash - (المرحلة الثانية) هاش ملف الـ XML
 * @param {string} data.ecdsaSignature - (المرحلة الثانية) التوقيع الرقمي
 * @param {string} data.ecdsaPublicKey - (المرحلة الثانية) المفتاح العام
 * @returns {string} - نص Base64 يمكن تحويله لـ QR Code
 */
export function generatePhase2QR(data) {
    const tlvArray = [];

    // Tag 1: اسم البائع
    tlvArray.push(getTLVBuffer(1, data.sellerName));
    
    // Tag 2: الرقم الضريبي
    tlvArray.push(getTLVBuffer(2, data.vatNumber));
    
    // Tag 3: تاريخ ووقت الفاتورة
    tlvArray.push(getTLVBuffer(3, data.timestamp));
    
    // Tag 4: إجمالي الفاتورة
    tlvArray.push(getTLVBuffer(4, data.invoiceTotal.toFixed(2)));
    
    // Tag 5: إجمالي الضريبة
    tlvArray.push(getTLVBuffer(5, data.vatTotal.toFixed(2)));
    
    // --- متطلبات المرحلة الثانية ---
    
    // Tag 6: Hash of XML
    if (data.xmlHash) {
        tlvArray.push(getTLVBuffer(6, data.xmlHash));
    }
    
    // Tag 7: ECDSA Signature
    if (data.ecdsaSignature) {
        tlvArray.push(getTLVBuffer(7, data.ecdsaSignature));
    }
    
    // Tag 8: ECDSA Public Key
    if (data.ecdsaPublicKey) {
        tlvArray.push(getTLVBuffer(8, data.ecdsaPublicKey));
    }

    // دمج جميع التاجات في Buffer واحد
    const qrBuffer = Buffer.concat(tlvArray);
    
    // تحويل النتيجة النهائية إلى Base64 كما تتطلب الهيئة
    return qrBuffer.toString('base64');
}
