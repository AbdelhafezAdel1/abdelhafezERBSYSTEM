/**
 * FixQRButton.jsx
 * ================
 * مكوّن React جاهز للاستخدام يعرض:
 *  - بيانات الفاتورة
 *  - زر إصلاح QR Code
 *  - حالات Loading / Success / Error
 *
 * الاستخدام:
 *   <FixQRButton invoiceId="your-invoice-uuid" />
 */

import React from 'react';
import { useFixInvoiceQR } from '../hooks/useFixInvoiceQR';

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export function FixQRButton({ invoiceId }) {
  const {
    invoice,
    isLoading,
    isFetching,
    error,
    isSuccess,
    fixQR,
    fetchInvoice,
    reset,
  } = useFixInvoiceQR(invoiceId);

  // ── حالة: جاري جلب البيانات ────────────────────────────────────────────────
  if (isFetching) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner} aria-label="جاري التحميل" />
        <p style={styles.loadingText}>جاري جلب بيانات الفاتورة...</p>
      </div>
    );
  }

  // ── حالة: الفاتورة غير موجودة ─────────────────────────────────────────────
  if (!isFetching && !invoice && !error) {
    return (
      <div style={styles.container}>
        <p style={styles.emptyText}>لا توجد بيانات.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>

      {/* ── بيانات الفاتورة ── */}
      {invoice && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            فاتورة: {invoice.invoice_number || `#${invoice.id}`}
          </h3>

          <div style={styles.grid}>
            <Field label="المنشأة البائعة" value={invoice.seller_name || 'مؤسسة عيسى يوسف العامر'} />
            <Field label="الرقم الضريبي"   value={invoice.tax_id || '310137521300003'} />
            <Field label="تاريخ الفاتورة"  value={formatDate(invoice.invoice_date || invoice.date)} />
            <Field label="الإجمالي"         value={`${parseFloat(invoice.total_amount || invoice.total_after_tax || 0).toFixed(2)} ر.س`} />
            <Field label="ضريبة القيمة"    value={`${parseFloat(invoice.vat_amount || 0).toFixed(2)} ر.س`} />
            <Field
              label="حالة ZATCA"
              value={invoice.zatca_status || 'غير محددة'}
              badge
              badgeColor={
                ['ACCEPTED', 'REPORTED', 'CLEARED', 'REPORTED_WITH_WARNINGS'].includes((invoice.zatca_status || '').toUpperCase())
                  ? '#16a34a'
                  : '#dc2626'
              }
            />
          </div>

          {/* QR Code Preview */}
          {invoice.qr_code && (
            <div style={styles.qrSection}>
              <p style={styles.qrLabel}>QR Code (Base64 TLV):</p>
              <code style={styles.qrCode}>
                {invoice.qr_code.slice(0, 60)}…
              </code>
            </div>
          )}
        </div>
      )}

      {/* ── رسالة النجاح ── */}
      {isSuccess && (
        <div style={styles.successBanner} role="alert">
          <span style={styles.successIcon}>✅</span>
          <span>تم إصلاح وتحديث QR Code بنجاح!</span>
          <button style={styles.dismissBtn} onClick={reset} aria-label="إغلاق">✕</button>
        </div>
      )}

      {/* ── رسالة الخطأ ── */}
      {error && (
        <div style={styles.errorBanner} role="alert">
          <span style={styles.errorIcon}>❌</span>
          <span style={styles.errorText}>{error}</span>
          <button style={styles.dismissBtn} onClick={reset} aria-label="إغلاق">✕</button>
        </div>
      )}

      {/* ── أزرار التحكم ── */}
      <div style={styles.actions}>
        {(() => {
          const isApproved = ['ACCEPTED', 'REPORTED', 'CLEARED', 'REPORTED_WITH_WARNINGS'].includes(
            (invoice?.zatca_status || '').toUpperCase()
          );
          return (
            <>
              {/* زر إصلاح QR */}
              <button
                style={{
                  ...styles.fixBtn,
                  ...(isLoading || !isApproved ? styles.fixBtnDisabled : {}),
                }}
                onClick={fixQR}
                disabled={isLoading || !isApproved}
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <span style={styles.btnSpinner} />
                    جاري الإصلاح...
                  </>
                ) : (
                  '🔧 إصلاح QR Code'
                )}
              </button>

              {/* زر إعادة جلب البيانات */}
              <button
                style={styles.refreshBtn}
                onClick={() => { reset(); fetchInvoice(); }}
                disabled={isLoading || isFetching}
              >
                🔄 تحديث
              </button>
            </>
          );
        })()}
      </div>

      {/* تحذير إذا الفاتورة غير مقبولة */}
      {invoice && !['ACCEPTED', 'REPORTED', 'CLEARED', 'REPORTED_WITH_WARNINGS'].includes((invoice.zatca_status || '').toUpperCase()) && (
        <p style={styles.warningText}>
          ⚠️ لا يمكن إصلاح QR Code — الفاتورة لم تقبل بعد في هيئة الزكاة (الحالة الحالية: {invoice.zatca_status || 'مسودة'})
        </p>
      )}

    </div>
  );
}

// ─── مكوّن مساعد: عرض حقل واحد ─────────────────────────────────────────────
function Field({ label, value, badge, badgeColor }) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {badge ? (
        <span style={{ ...styles.badge, backgroundColor: badgeColor }}>
          {value}
        </span>
      ) : (
        <span style={styles.fieldValue}>{value ?? '—'}</span>
      )}
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Styles (inline — استبدلها بـ CSS/Tailwind حسب مشروعك) ──────────────────
const styles = {
  container: {
    fontFamily: 'system-ui, sans-serif',
    direction: 'rtl',
    maxWidth: 520,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 20,
    backgroundColor: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  },
  cardTitle: {
    margin: '0 0 16px',
    fontSize: 17,
    fontWeight: 700,
    color: '#111827',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  fieldValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: 500,
  },
  badge: {
    display: 'inline-block',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: 20,
    width: 'fit-content',
  },
  qrSection: {
    marginTop: 14,
    padding: '10px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    border: '1px dashed #d1d5db',
  },
  qrLabel: {
    margin: '0 0 4px',
    fontSize: 11,
    color: '#6b7280',
    fontWeight: 600,
  },
  qrCode: {
    fontSize: 11,
    color: '#374151',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
  actions: {
    display: 'flex',
    gap: 10,
  },
  fixBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background .2s',
  },
  fixBtnDisabled: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed',
  },
  refreshBtn: {
    padding: '10px 16px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    backgroundColor: '#dcfce7',
    border: '1px solid #86efac',
    borderRadius: 8,
    color: '#166534',
    fontSize: 14,
    fontWeight: 600,
  },
  successIcon: { fontSize: 18 },
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    color: '#991b1b',
    fontSize: 13,
  },
  errorIcon: { fontSize: 16, flexShrink: 0 },
  errorText: { flex: 1, lineHeight: 1.5 },
  dismissBtn: {
    marginRight: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'inherit',
    fontWeight: 700,
    fontSize: 14,
    opacity: 0.6,
    padding: 0,
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  btnSpinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,.4)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
  },
  warningText: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    margin: 0,
  },
};
