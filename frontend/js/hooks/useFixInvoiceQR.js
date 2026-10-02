/**
 * useFixInvoiceQR.js
 * ===================
 * React Hook لإصلاح QR Code الخاطئ لفاتورة ZATCA مقبولة
 * يتصل مباشرة بـ API الخادم (POST /api/zatca/fix-qr-code)
 *
 * الاستخدام:
 *   const { invoice, isLoading, isFetching, error, isSuccess, fixQR, fetchInvoice, reset } = useFixInvoiceQR(invoiceId);
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * @param {string|number|null} invoiceId - معرّف الفاتورة
 * @param {object}             [options]
 * @param {boolean}            [options.autoFetch=true] - جلب بيانات الفاتورة تلقائياً عند التحميل
 */
export function useFixInvoiceQR(invoiceId, options = {}) {
  const { autoFetch = true } = options;

  // ── State ──────────────────────────────────────────────────────────────────
  const [invoice,     setInvoice]     = useState(null);    // بيانات الفاتورة الحالية
  const [isLoading,   setIsLoading]   = useState(false);   // جاري عملية الإصلاح
  const [isFetching,  setIsFetching]  = useState(false);   // جاري جلب البيانات الأولية
  const [error,       setError]       = useState(null);    // رسالة الخطأ
  const [isSuccess,   setIsSuccess]   = useState(false);   // تم الإصلاح بنجاح

  // ── جلب بيانات الفاتورة من الخادم ─────────────────────────────────────────
  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) return;

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error(`لا توجد فاتورة بالمعرّف: ${invoiceId}`);
        throw new Error(`خطأ في جلب بيانات الفاتورة (${response.status})`);
      }

      const data = await response.json();
      setInvoice(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsFetching(false);
    }
  }, [invoiceId]);

  // جلب تلقائي عند تغيير invoiceId
  useEffect(() => {
    if (autoFetch && invoiceId) {
      fetchInvoice();
    }
  }, [autoFetch, invoiceId, fetchInvoice]);

  // ── الدالة الرئيسية: إصلاح QR Code عبر الـ API ────────────────────────────
  const fixQR = useCallback(async () => {
    if (!invoiceId) {
      setError('لم يتم تحديد معرّف الفاتورة.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      const response = await fetch('/api/zatca/fix-qr-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error?.message || result.error || 'فشل إصلاح QR Code';
        throw new Error(errorMsg);
      }

      // تحديث حالة الفاتورة المعروضة
      setInvoice((prev) => ({
        ...prev,
        ...result.invoice,
        qr_code: result.invoice.qr_code,
      }));

      setIsSuccess(true);
      return result;
    } catch (err) {
      setError(err.message);
      setIsSuccess(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  // ── إعادة التهيئة ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  return {
    invoice,      // بيانات الفاتورة (محدّثة بعد الإصلاح)
    isLoading,    // true أثناء عملية الإصلاح
    isFetching,   // true أثناء جلب البيانات
    error,        // رسالة الخطأ أو null
    isSuccess,    // true بعد الإصلاح الناجح
    fixQR,        // الدالة: استدعِها عند الضغط على الزر
    fetchInvoice, // إعادة جلب البيانات يدوياً
    reset,        // مسح error و isSuccess
  };
}
