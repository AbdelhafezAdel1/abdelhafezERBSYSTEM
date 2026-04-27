import fs from 'fs/promises';
import path from 'path';

/**
 * VAT Reporting Engine for ZATCA periodic reports
 */

const arabicMonths = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

/**
 * Generates a VAT report for a given period.
 * @param {Array<Object>} invoices - Array of invoice objects with VAT calculation results
 * @param {{month: number, year: number}} period - The period for the report (month is 1-12)
 * @returns {Object} Aggregated VAT report
 */
export function generateVATReport(invoices, period) {
    const report = {
        period: {
            month: period.month,
            year: period.year,
            label: `${arabicMonths[period.month - 1]} ${period.year}`
        },
        totalInvoices: 0,
        totalSales: 0,
        totalVATCollected: 0,
        totalVATRefunds: 0,
        netVATDue: 0,
        breakdown: {
            standard: { count: 0, taxableAmount: 0, vatAmount: 0 },
            zero: { count: 0, taxableAmount: 0 },
            exempt: { count: 0, taxableAmount: 0 }
        },
        filingDeadline: ''
    };

    // Calculate filing deadline: last day of following month
    const nextMonth = period.month === 12 ? 1 : period.month + 1;
    const nextYear = period.month === 12 ? period.year + 1 : period.year;
    const lastDayNextMonth = new Date(nextYear, nextMonth, 0).getDate();
    report.filingDeadline = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDayNextMonth).padStart(2, '0')}`;

    invoices.forEach(inv => {
        report.totalInvoices++;
        
        const isCreditNote = inv.type === 'credit_note';
        const sign = isCreditNote ? -1 : 1;
        
        const summary = inv.vatSummary;

        report.totalSales += summary.subtotal * sign;
        
        if (isCreditNote) {
            report.totalVATRefunds += summary.totalVAT;
        } else {
            report.totalVATCollected += summary.totalVAT;
        }

        ['standard', 'zero', 'exempt'].forEach(cat => {
            if (summary.byCategory && summary.byCategory[cat]) {
                const catData = summary.byCategory[cat];
                if (catData.taxableAmount > 0 || catData.vatAmount > 0) {
                    report.breakdown[cat].count++;
                    report.breakdown[cat].taxableAmount += catData.taxableAmount * sign;
                    if (cat === 'standard') {
                        report.breakdown[cat].vatAmount += catData.vatAmount * sign;
                    }
                }
            }
        });
    });

    report.netVATDue = report.totalVATCollected - report.totalVATRefunds;

    report.totalSales = Number(report.totalSales.toFixed(2));
    report.totalVATCollected = Number(report.totalVATCollected.toFixed(2));
    report.totalVATRefunds = Number(report.totalVATRefunds.toFixed(2));
    report.netVATDue = Number(report.netVATDue.toFixed(2));

    Object.keys(report.breakdown).forEach(cat => {
        report.breakdown[cat].taxableAmount = Number(report.breakdown[cat].taxableAmount.toFixed(2));
        if (cat === 'standard') {
            report.breakdown[cat].vatAmount = Number(report.breakdown[cat].vatAmount.toFixed(2));
        }
    });

    return report;
}

/**
 * Formats the report as a structured JSON object for ZATCA API.
 * @param {Object} report - The generated report
 * @returns {Object} JSON object ready for ZATCA
 */
export function formatReportForZATCA(report) {
    return {
        Period: `${report.period.year}-${String(report.period.month).padStart(2, '0')}`,
        TotalSales: report.totalSales,
        TotalVATCollected: report.totalVATCollected,
        TotalVATRefunds: report.totalVATRefunds,
        NetVATDue: report.netVATDue,
        Breakdown: {
            Standard: report.breakdown.standard,
            Zero: report.breakdown.zero,
            Exempt: report.breakdown.exempt
        }
    };
}

/**
 * Saves report as JSON file to disk.
 * @param {Object} report - The generated report
 * @param {string} outputPath - The file path to save
 */
export async function saveReportToFile(report, outputPath) {
    try {
        const dir = path.dirname(outputPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(`✅ تم حفظ التقرير بنجاح في: ${outputPath}`);
    } catch (err) {
        console.error(`❌ خطأ في حفظ التقرير:`, err.message);
    }
}
