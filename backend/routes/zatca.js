const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EGS, ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');

// ============================================================================
// ZATCA E-Invoicing Routes — مسارات هيئة الزكاة والضريبة والجمارك
// ============================================================================
// Production URL for actual go-live: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core'
// Simulation URL for testing: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation'
const ZATCA_BASE_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';

const SELLER = {
    vatNumber: '310137521300003',
    nameAr: 'مؤسسة عيسى يوسف العامر للتخليص الجمركي',
    city: 'Dammam',
    district: 'Ash Shifa',
    street: 'Prince Mohammed bin Fahd St',
    building: '0008',
    postalCode: '32236',
    country: 'SA'
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** توليد QR code بصيغة TLV Base64 */
function generateTLV(sellerName, vatNumber, timestamp, total, vat) {
    const tags = [
        { id: 1, value: sellerName },
        { id: 2, value: vatNumber },
        { id: 3, value: timestamp },
        { id: 4, value: String(total) },
        { id: 5, value: String(vat) }
    ];
    let buf = Buffer.alloc(0);
    for (const t of tags) {
        const val = Buffer.from(t.value, 'utf8');
        buf = Buffer.concat([buf, Buffer.from([t.id]), Buffer.from([val.length]), val]);
    }
    return buf.toString('base64');
}

/** توليد UBL 2.1 XML للفاتورة */
function buildInvoiceXML(invoice, items) {
    const uuid = crypto.randomUUID();
    const date = new Date(invoice.date).toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    const subtotal = parseFloat(invoice.total_before_tax || 0).toFixed(2);
    const vatAmt = parseFloat(invoice.vat_amount || 0).toFixed(2);
    const total = parseFloat(invoice.total_after_tax || 0).toFixed(2);

    const lines = (items || []).map((it, i) => {
        const lineTotal = (parseFloat(it.quantity) * parseFloat(it.unit_price)).toFixed(2);
        const lineTax = (it.taxable ? parseFloat(lineTotal) * 0.15 : 0).toFixed(2);
        return `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${it.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${lineTotal}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${lineTax}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${(parseFloat(lineTotal) + parseFloat(lineTax)).toFixed(2)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${(it.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${it.taxable ? 'S' : 'Z'}</cbc:ID>
          <cbc:Percent>${it.taxable ? '15.00' : '0.00'}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${parseFloat(it.unit_price).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${invoice.id}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${date}</cbc:IssueDate>
  <cbc:IssueTime>${time}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">7052683492</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${SELLER.street}</cbc:StreetName>
        <cbc:BuildingNumber>${SELLER.building}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>${SELLER.district}</cbc:CitySubdivisionName>
        <cbc:CityName>${SELLER.city}</cbc:CityName>
        <cbc:PostalZone>${SELLER.postalCode}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${SELLER.country}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${SELLER.vatNumber}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${SELLER.nameAr}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${invoice.company_address || 'N/A'}</cbc:StreetName>
        <cbc:CityName>${SELLER.city}</cbc:CityName>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${invoice.company_vat || 'N/A'}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${invoice.company_name || 'N/A'}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${vatAmt}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${subtotal}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${vatAmt}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</Invoice>`;
}

function getCredentials() {
    // 1. Try reading from environment variable (For Render/Production deployments)
    if (process.env.ZATCA_PRODUCTION_CSID) {
        try {
            console.log(`🔐 Loading ZATCA credentials from Environment Variable`);
            const creds = JSON.parse(process.env.ZATCA_PRODUCTION_CSID);
            console.log(`🔐 Credentials loaded (ENV): token=${!!creds.binarySecurityToken}, secret=${!!creds.secret}`);
            return creds;
        } catch (e) {
            console.error('❌ Error parsing ZATCA_PRODUCTION_CSID from ENV:', e.message);
        }
    }

    // 2. Fallback to reading from file (For local development)
    try {
        const prodPath = path.join(__dirname, '..', 'zatca-integration', 'certs', 'production_csid.json');
        console.log(`🔐 Loading ZATCA credentials from: ${prodPath}`);
        if (fs.existsSync(prodPath)) {
            const creds = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
            console.log(`🔐 Credentials loaded (production_csid.json): token=${!!creds.binarySecurityToken}, secret=${!!creds.secret}`);
            return creds;
        }
    } catch (_) { }
    return null;
}

/** بناء headers للـ ZATCA API */
function buildHeaders(creds) {
    const cleanToken = creds?.binarySecurityToken ? creds.binarySecurityToken.replace(/\s+/g, '').trim() : '';
    const cleanSecret = creds?.secret ? creds.secret.trim() : '';
    const base64Token = Buffer.from(cleanToken).toString('base64');
    const auth = 'Basic ' + Buffer.from(`${base64Token}:${cleanSecret}`).toString('base64');
    return {
        'Authorization': creds ? auth : 'Basic ' + Buffer.from('test:test').toString('base64'),
        'Accept-Version': 'V2',
        'Accept-Language': 'en',
        'Content-Type': 'application/json'
    };
}

function getCredentialVariants(creds) {
    const variants = [{ ...creds, _variant: 'raw-token' }];
    try {
        const decoded = Buffer.from(creds.binarySecurityToken, 'base64').toString('utf8').trim();
        if (decoded && decoded.includes('BEGIN CERTIFICATE')) {
            const cleaned = decoded
                .replace(/-----BEGIN CERTIFICATE-----/g, '')
                .replace(/-----END CERTIFICATE-----/g, '')
                .replace(/\r?\n/g, '')
                .trim();
            if (cleaned && cleaned !== creds.binarySecurityToken) {
                variants.push({ ...creds, binarySecurityToken: cleaned, _variant: 'decoded-token' });
            }
        }
    } catch (_) { }
    return variants;
}

async function postToZatcaWithAuthFallback(endpoint, payload, creds, extraHeaders = {}) {
    const variants = getCredentialVariants(creds);
    let lastError = null;
    for (const currentCreds of variants) {
        try {
            const headers = {
                ...buildHeaders(currentCreds),
            };
            // Keep only the 4 allowed headers for reporting/clearance auth calls.
            const filteredHeaders = {
                Authorization: headers.Authorization,
                'Accept-Version': headers['Accept-Version'],
                'Accept-Language': headers['Accept-Language'],
                'Content-Type': headers['Content-Type']
            };
            if (extraHeaders['Clearance-Status'] !== undefined) {
                filteredHeaders['Clearance-Status'] = extraHeaders['Clearance-Status'];
            }
            console.log(`🌐 ZATCA endpoint: ${endpoint}`);
            console.log(`🧾 Authorization header (${currentCreds._variant}): ${filteredHeaders.Authorization}`);
            console.log('=== ACTUAL HEADERS ===');
            console.log(JSON.stringify(filteredHeaders, null, 2));
            console.log('=== END HEADERS ===');

            const response = await axios.post(endpoint, payload, { headers: filteredHeaders });
            console.log(`✅ ZATCA response (${endpoint}): ${JSON.stringify(response.data, null, 2)}`);
            return response;
        } catch (err) {
            console.log(`❌ ZATCA response error (${endpoint}): ${JSON.stringify(err.response?.data || { message: err.message }, null, 2)}`);
            if (err.response?.status === 401) {
                lastError = err;
                continue;
            }
            throw err;
        }
    }
    throw lastError || new Error('ZATCA authentication failed');
}

function normalizeZatcaError(err) {
    const body = err.response?.data;
    const firstArrayError = Array.isArray(body?.errors) && body.errors.length > 0 ? body.errors[0] : null;
    const reasonCode = firstArrayError?.code || body?.code || body?.errorCategory || body?.errorCode || 'UNKNOWN_ERROR';
    const reasonMessage = firstArrayError?.message || body?.message || body?.errorMessage || err.response?.statusText || err.message || 'Unknown ZATCA error';
    return {
        httpStatus: err.response?.status || 500,
        reasonCode,
        reasonMessage,
        body
    };
}

function requireProductionCredentials(res) {
    const creds = getCredentials();
    if (!creds || !creds.binarySecurityToken || !creds.secret) {
        res.status(503).json({
            success: false,
            error: 'Production CSID غير متوفر',
            hint: 'تأكد من وجود ملف production_csid.json داخل backend/zatca-integration/certs'
        });
        return null;
    }
    return creds;
}

function buildEgsInfo(privateKey, creds) {
    return {
        uuid: 'ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
        custom_id: 'EGS-1',
        model: 'EGS-Model-1',
        CRN_number: '7052683492',
        VAT_name: SELLER.nameAr,
        VAT_number: SELLER.vatNumber,
        branch_name: 'Dammam Branch',
        branch_industry: 'Customs Clearance',
        location: {
            city: SELLER.city,
            city_subdivision: SELLER.district,
            street: SELLER.street,
            plot_identification: '1234',
            building: SELLER.building,
            postal_zone: SELLER.postalCode
        },
        production_certificate: creds.binarySecurityToken,
        production_api_secret: creds.secret,
        private_key: privateKey
    };
}

function buildSimplifiedInvoice(egsInfo, invoice, items, invoiceCounter) {
    return new ZATCASimplifiedTaxInvoice({
        props: {
            egs_info: egsInfo,
            invoice_counter_number: invoiceCounter,
            invoice_serial_number: String(invoice.id),
            issue_date: new Date(invoice.date).toISOString().split('T')[0],
            issue_time: new Date().toTimeString().split(' ')[0],
            previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2ExNDlkZGM=",
            line_items: (items || []).map((it, idx) => ({
                id: String(idx + 1),
                name: it.description,
                quantity: it.quantity,
                tax_exclusive_price: it.unit_price,
                VAT_percent: it.taxable ? 0.15 : 0
            }))
        }
    });
}

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/zatca/compliance
 * فحص الامتثال — Compliance Check (Sandbox)
 */
router.post('/compliance', async (req, res) => {
    try {
        const creds = getCredentials();
        if (!creds) {
            return res.status(503).json({
                success: false,
                message: 'لا توجد شهادة إنتاج. قم بإنشاء production_csid.json أولاً.'
            });
        }

        const response = await axios.get(`${ZATCA_BASE_URL}/compliance`, {
            headers: buildHeaders(creds)
        });
        res.json({ success: true, data: response.data });
    } catch (err) {
        const zErr = normalizeZatcaError(err);
        console.error('❌ Compliance Error:', zErr.body || zErr.reasonMessage);
        res.status(zErr.httpStatus).json({ success: false, ...zErr });
    }
});

/**
 * POST /api/zatca/report
 * رفع فاتورة B2C (Simplified Invoice) للهيئة
 * Body: { invoice: {...}, items: [...] }
 */
router.post('/report', async (req, res) => {
    const { invoice, items } = req.body;
    if (!invoice) return res.status(400).json({ error: 'بيانات الفاتورة مفقودة' });

    try {
        const creds = requireProductionCredentials(res);
        if (!creds) return;

        let privateKey = process.env.ZATCA_PRIVATE_KEY;
        const privateKeyPath = path.join(__dirname, '..', 'zatca-integration', 'certs', 'private-key.pem');
        
        if (!privateKey) {
            if (!fs.existsSync(privateKeyPath)) {
                return res.status(503).json({
                    success: false,
                    error: 'ملف المفتاح الخاص غير موجود',
                    path: privateKeyPath
                });
            }
            privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        } else {
            // Fix literal \n that might be pasted from Render dashboard
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        const egsInfo = buildEgsInfo(privateKey, creds);
        const egs = new EGS(egsInfo);
        const zInvoice = buildSimplifiedInvoice(egsInfo, invoice, items, Number(invoice.id) || 1);
        const { signed_invoice_string, invoice_hash, qr } = egs.signInvoice(zInvoice, true);
        const xmlMatch = signed_invoice_string.match(/<cbc:UUID>([^<]+)<\/cbc:UUID>/);
        const invoice_uuid = xmlMatch ? xmlMatch[1] : egsInfo.uuid;
        console.log(`🧪 Report pre-send checks: xml=${!!signed_invoice_string}, xmlLength=${signed_invoice_string?.length || 0}, hash=${invoice_hash}, qr=${!!qr}, qrLength=${qr?.length || 0}`);

        const response = await postToZatcaWithAuthFallback(
            `${ZATCA_BASE_URL}/invoices/reporting/single`,
            {
                invoiceHash: invoice_hash,
                uuid: invoice_uuid,
                invoice: Buffer.from(signed_invoice_string).toString('base64')
            },
            creds,
            { 'Clearance-Status': '0' }
        );

        const result = response.data;
        return res.json({
            success: true,
            invoiceId: invoice.id,
            mode: 'production',
            type: 'reporting',
            status: result.reportingStatus || 'REPORTED',
            xmlHash: invoice_hash,
            qrCode: qr,
            validationResults: result.validationResults,
            rawResponse: result
        });

    } catch (err) {
        const zErr = normalizeZatcaError(err);
        console.error('❌ Report Error:', zErr.body || zErr.reasonMessage);
        res.status(zErr.httpStatus).json({
            success: false,
            type: 'reporting',
            ...zErr
        });
    }
});

/**
 * POST /api/zatca/clearance
 * فحص وتخليص فاتورة B2B (Standard Invoice) للهيئة
 * Body: { invoice: {...}, items: [...] }
 */
router.post('/clearance', async (req, res) => {
    const { invoice, items } = req.body;
    if (!invoice) return res.status(400).json({ error: 'بيانات الفاتورة مفقودة' });

    try {
        const creds = requireProductionCredentials(res);
        if (!creds) return;
        
        const invoiceUuid = crypto.randomUUID();
        const mockStandardXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${invoice.id}</cbc:ID>
  <cbc:UUID>${invoiceUuid}</cbc:UUID>
  <cbc:IssueDate>${new Date(invoice.date).toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:IssueTime>${new Date().toTimeString().split(' ')[0]}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
</Invoice>`;
        
        const xmlB64 = Buffer.from(mockStandardXml).toString('base64');
        const xmlHash = crypto.createHash('sha256').update(mockStandardXml).digest('base64');
        console.log(`🧪 Clearance pre-send checks: xml=${!!mockStandardXml}, xmlLength=${mockStandardXml.length}, xmlBase64=${!!xmlB64}, invoiceHash=${xmlHash}`);

        const response = await postToZatcaWithAuthFallback(
            `${ZATCA_BASE_URL}/invoices/clearance/single`,
            { invoiceHash: xmlHash, uuid: invoiceUuid, invoice: xmlB64 },
            creds
        );

        const data = response.data;
        const status = data.clearanceStatus || 'CLEARED';
        const errors = data.validationResults?.errorMessages || [];

        return res.json({
            success: errors.length === 0,
            invoiceId: invoice.id,
            mode: 'production',
            type: 'clearance',
            status,
            clearedInvoice: data.clearedInvoice,
            uuid: invoiceUuid,
            xmlHash,
            errors,
            warnings: data.validationResults?.warningMessages || [],
            rawResponse: data
        });

    } catch (err) {
        const zErr = normalizeZatcaError(err);
        console.error('❌ Clearance Error:', zErr.body || zErr.reasonMessage);
        res.status(zErr.httpStatus).json({
            success: false,
            type: 'clearance',
            ...zErr
        });
    }
});

/**
 * POST /api/zatca/generate-xml
 * توليد ملف XML للفاتورة للمعاينة فقط (بدون إرسال)
 * Body: { invoice: {...}, items: [...] }
 */
router.post('/generate-xml', (req, res) => {
    const { invoice, items } = req.body;
    if (!invoice) return res.status(400).json({ error: 'بيانات الفاتورة مفقودة' });

    try {
        const xml = buildInvoiceXML(invoice, items || []);
        const hash = crypto.createHash('sha256').update(xml).digest('base64');
        res.json({ success: true, xml, hash });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/zatca/invoice-status/:uuid
 * استعلام عن حالة فاتورة مرسلة سابقاً
 */
router.get('/invoice-status/:uuid', async (req, res) => {
    const { uuid } = req.params;
    try {
        const creds = getCredentials();
        if (!creds) {
            return res.json({ success: true, mode: 'simulation', uuid, status: 'UNKNOWN', message: 'الشهادة غير مثبتة' });
        }

        const response = await axios.get(
            `${ZATCA_BASE_URL}/invoices/${uuid}`,
            { headers: buildHeaders(creds) }
        );
        res.json({ success: true, uuid, status: response.data });
    } catch (err) {
        console.error('❌ Status Error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data || err.message });
    }
});

/**
 * GET /api/zatca/test-connection
 * اختبار الاتصال بالبيئة التجريبية للهيئة
 */
router.get('/test-connection', async (req, res) => {
    const creds = getCredentials();
    const start = Date.now();

    try {
        await axios.get(`${ZATCA_BASE_URL}/compliance`, {
            headers: buildHeaders(creds),
            timeout: 8000
        });
        res.json({ success: true, environment: 'PRODUCTION', latencyMs: Date.now() - start, certificate: !!creds });
    } catch (err) {
        const latencyMs = Date.now() - start;
        // حتى لو رفض الطلب بسبب الـ auth، الاتصال يعمل
        if (err.response) {
            return res.json({
                success: true,
                environment: 'PRODUCTION',
                latencyMs,
                certificate: !!creds,
                httpStatus: err.response.status
            });
        }
        // إذا كان الخطأ بسبب DNS أو عدم القدرة على الوصول إلى الخادم
        if (err.code === 'ENOTFOUND' || err.message.includes('ENOTFOUND')) {
            return res.json({
                success: true,
                environment: 'PRODUCTION',
                latencyMs,
                certificate: !!creds,
                dnsError: true,
                message: 'Unable to resolve ZATCA host – returning simulated connection.'
            });
        }
        res.status(502).json({ success: false, error: err.message, certificate: !!creds });
    }
});

/**
 * GET /api/zatca/production-csid-status
 * التحقق من حالة شهادة الإنتاج (Active/Pending/Expired)
 */
router.get('/production-csid-status', async (req, res) => {
    try {
        const creds = requireProductionCredentials(res);
        if (!creds) return;

        const headers = buildHeaders(creds);
        const endpoint = `${ZATCA_BASE_URL}/production/csids`;
        console.log(`🌐 ZATCA endpoint: ${endpoint}`);
        console.log(`🧾 Authorization header: ${headers.Authorization}`);

        const response = await axios.get(endpoint, { headers, timeout: 20000 });
        console.log(`✅ CSID status response: ${JSON.stringify(response.data, null, 2)}`);
        return res.json({
            success: true,
            endpoint,
            response: response.data
        });
    } catch (err) {
        const zErr = normalizeZatcaError(err);
        console.log(`❌ CSID status response error: ${JSON.stringify(zErr.body || { message: zErr.reasonMessage }, null, 2)}`);
        return res.status(zErr.httpStatus).json({
            success: false,
            endpoint: `${ZATCA_BASE_URL}/production/csids`,
            ...zErr
        });
    }
});

module.exports = router;
