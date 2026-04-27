/**
 * VAT Calculation Engine for Saudi ZATCA e-invoicing
 */

/**
 * Calculates VAT for a list of items based on their category.
 * @param {Array<{name: string, qty: number, unitPrice: number, vatCategory: string}>} items
 * @returns {Object} VAT calculation result
 */
export function calculateVAT(items) {
    const lines = [];
    const summary = {
        subtotal: 0,
        totalVAT: 0,
        grandTotal: 0,
        byCategory: {
            standard: { taxableAmount: 0, vatAmount: 0 },
            zero: { taxableAmount: 0, vatAmount: 0 },
            exempt: { taxableAmount: 0, vatAmount: 0 }
        }
    };

    items.forEach(item => {
        let vatRate = 0;
        if (item.vatCategory === 'standard') {
            vatRate = 0.15;
        } else if (item.vatCategory === 'zero' || item.vatCategory === 'exempt') {
            vatRate = 0;
        }

        const lineTotal = item.qty * item.unitPrice;
        const vatAmount = lineTotal * vatRate;
        const lineTotalWithVAT = lineTotal + vatAmount;

        lines.push({
            name: item.name,
            qty: item.qty,
            unitPrice: Number(item.unitPrice.toFixed(2)),
            vatRate: Number(vatRate.toFixed(2)),
            vatAmount: Number(vatAmount.toFixed(2)),
            lineTotal: Number(lineTotal.toFixed(2)),
            lineTotalWithVAT: Number(lineTotalWithVAT.toFixed(2))
        });

        summary.subtotal += lineTotal;
        summary.totalVAT += vatAmount;
        summary.grandTotal += lineTotalWithVAT;

        if (summary.byCategory[item.vatCategory]) {
            summary.byCategory[item.vatCategory].taxableAmount += lineTotal;
            summary.byCategory[item.vatCategory].vatAmount += vatAmount;
        }
    });

    // Formatting all summary amounts to 2 decimal places
    summary.subtotal = Number(summary.subtotal.toFixed(2));
    summary.totalVAT = Number(summary.totalVAT.toFixed(2));
    summary.grandTotal = Number(summary.grandTotal.toFixed(2));

    Object.keys(summary.byCategory).forEach(cat => {
        summary.byCategory[cat].taxableAmount = Number(summary.byCategory[cat].taxableAmount.toFixed(2));
        summary.byCategory[cat].vatAmount = Number(summary.byCategory[cat].vatAmount.toFixed(2));
    });

    return { lines, summary };
}

/**
 * Formats the VAT summary into a clean Arabic string.
 * @param {Object} calcResult - The result from calculateVAT
 * @returns {string} Formatted Arabic summary
 */
export function formatVATSummary(calcResult) {
    const { summary } = calcResult;
    return `
=== ملخص الضريبة ===
المبلغ الخاضع للضريبة (قبل الضريبة): ${summary.subtotal.toFixed(2)} ريال
إجمالي ضريبة القيمة المضافة: ${summary.totalVAT.toFixed(2)} ريال
الإجمالي شامل الضريبة: ${summary.grandTotal.toFixed(2)} ريال
====================
`;
}

/**
 * Validates a Saudi VAT number.
 * @param {string} vatNumber - The VAT number to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateVATNumber(vatNumber) {
    if (!vatNumber) {
        return { valid: false, error: 'الرقم الضريبي مفقود' };
    }

    const vatStr = String(vatNumber);
    
    if (vatStr.length !== 15) {
        return { valid: false, error: 'يجب أن يتكون الرقم الضريبي من 15 رقماً' };
    }

    if (!vatStr.startsWith('3')) {
        return { valid: false, error: 'يجب أن يبدأ الرقم الضريبي برقم 3' };
    }

    if (!vatStr.endsWith('3')) {
        return { valid: false, error: 'يجب أن ينتهي الرقم الضريبي برقم 3' };
    }

    if (!/^\d+$/.test(vatStr)) {
        return { valid: false, error: 'يجب أن يحتوي الرقم الضريبي على أرقام فقط' };
    }

    return { valid: true };
}
