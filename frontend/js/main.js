// Main ERP Logic

// --- Global State & Navigation ---

document.addEventListener('DOMContentLoaded', () => {
    // Set current date
    const dateEl = document.getElementById('current-date');
    const now = new Date();
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Set default filters to current month/year for all sections
    const setDefaults = (prefix) => {
        const m = document.getElementById(`${prefix}-month`);
        const y = document.getElementById(`${prefix}-year`);
        if (m && y) {
            m.value = (now.getMonth() + 1).toString().padStart(2, '0');
            y.value = now.getFullYear().toString();
        }
    };

    ['dash', 'invoice', 'tax'].forEach(setDefaults);

    // Initial Load
    showSection('dashboard');

    // Close sidebar when clicking outside on mobile
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar.classList.contains('translate-x-full')) {
        // Open
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        // Close
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    }
}

function showSection(id) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    // Show target section
    document.getElementById(id).classList.remove('hidden');

    // Update active link in sidebar
    document.querySelectorAll('aside a').forEach(a => a.classList.remove('active', 'bg-gray-800'));
    const activeLink = document.querySelector(`aside a[onclick="showSection('${id}')"]`);
    if (activeLink) activeLink.classList.add('active', 'bg-gray-800');

    // Close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }

    // Load data based on section
    if (id === 'invoice-register') loadInvoices();
    if (id === 'companies') loadCompanies();
    if (id === 'bonds') loadBonds();
    if (id === 'create-invoice') initCreateInvoice();
    if (id === 'tax-register') loadTaxRegister();
    if (id === 'profile') loadProfile();
    if (id === 'dashboard') loadDashboard();
}

// --- Auth ---
async function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    }
}

// --- Dashboard ---
async function loadDashboard() {
    const month = document.getElementById('dash-month').value;
    const year = document.getElementById('dash-year').value;
    const companyId = document.getElementById('dash-company').value;

    const params = new URLSearchParams();
    if (month && year) {
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;
        params.append('startDate', startDate);
        params.append('endDate', endDate);
    } else if (year) {
        params.append('startDate', `${year}-01-01`);
        params.append('endDate', `${year}-12-31`);
    }
    if (companyId) params.append('companyId', companyId);

    try {
        const res = await fetch(`/api/dashboard?${params}`);
        const data = await res.json();

        // Update Stats
        animateValue('stat-total-invoices', data.stats.total_invoices);
        document.getElementById('stat-total-revenue').textContent = formatCurrency(data.stats.total_revenue);
        document.getElementById('stat-total-vat').textContent = formatCurrency(data.stats.total_vat);
        animateValue('stat-total-companies', data.stats.total_companies);

        // Update Charts
        renderCharts(data);

        // Load companies for filter if empty
        if (document.getElementById('dash-company').options.length <= 1) {
            loadCompanyOptions('dash-company');
        }
    } catch (err) {
        console.error('Dashboard error:', err);
    }
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    const start = 0;
    const duration = 1000;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

let revenueChart = null;
let companyChart = null;

function renderCharts(data) {
    // Revenue Chart
    const ctx1 = document.getElementById('revenue-chart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: data.monthly_revenue.map(d => d.month),
            datasets: [{
                label: 'الإيرادات',
                data: data.monthly_revenue.map(d => d.revenue),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // Company Chart
    const ctx2 = document.getElementById('company-chart').getContext('2d');
    if (companyChart) companyChart.destroy();
    companyChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: data.company_revenue.map(d => d.company_name),
            datasets: [{
                data: data.company_revenue.map(d => d.revenue),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
            }]
        },
        options: { responsive: true }
    });
}

// --- Invoices ---

async function loadInvoices() {
    const month = document.getElementById('invoice-month').value;
    const year = document.getElementById('invoice-year').value;
    const companyId = document.getElementById('invoice-filter-company').value;

    const params = new URLSearchParams();

    // Build date range from month/year
    if (month && year) {
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;
        params.append('startDate', startDate);
        params.append('endDate', endDate);
    } else if (year) {
        // If only year selected, get full year
        params.append('startDate', `${year}-01-01`);
        params.append('endDate', `${year}-12-31`);
    }

    if (companyId) params.append('companyId', companyId);

    const res = await fetch(`/api/invoices?${params}`);
    const invoices = await res.json();

    const tbody = document.getElementById('invoice-list');
    tbody.innerHTML = invoices.map(inv => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td><span class="font-mono font-bold text-blue-600">#${inv.id}</span></td>
            <td>${inv.date}</td>
            <td>${inv.company_name}</td>
            <td class="font-bold">${formatCurrency(inv.total_after_tax)}</td>
            <td>
                <span class="px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'Final' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    ${inv.status === 'Final' ? 'نهائي' : 'مسودة'}
                </span>
            </td>
            <td>
                <div class="flex gap-2">
                    <button onclick="viewInvoice(${inv.id})" class="text-blue-600 hover:text-blue-800" title="عرض"><i class="fas fa-eye"></i></button>
                    <button onclick="editInvoice(${inv.id})" class="text-yellow-600 hover:text-yellow-800" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button onclick="shareInvoice(${inv.id}, '${escapeHtml(inv.company_name)}', ${inv.total_after_tax})" class="text-green-600 hover:text-green-800" title="مشاركة"><i class="fas fa-share-alt"></i></button>
                    <button onclick="deleteInvoice(${inv.id})" class="text-red-600 hover:text-red-800" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    if (document.getElementById('invoice-filter-company').options.length <= 1) {
        loadCompanyOptions('invoice-filter-company');
    }
}

// --- Create/Edit Invoice Logic ---

function initCreateInvoice() {
    const form = document.getElementById('invoice-form');
    form.reset();
    delete form.dataset.editingId;

    document.getElementById('invoice-date').valueAsDate = new Date();
    document.getElementById('invoice-items-other').innerHTML = '';

    // Reset checkboxes and inputs
    ['clearance', 'duties', 'appointment', 'saber', 'loading', 'insurance'].forEach(id => {
        document.getElementById(`check-${id}`).checked = false;
        const inputVal = document.getElementById(`val-${id}`);
        const inputQty = document.getElementById(`qty-${id}`);
        inputVal.value = '';
        inputVal.disabled = true;
        inputQty.value = '1';
        inputQty.disabled = true;
        document.getElementById(`check-${id}-div`).classList.remove('checked');
    });

    calculateTotals();
    loadCompanyOptions('invoice-company');
}

function toggleService(id) {
    const checkbox = document.getElementById(`check-${id}`);
    const div = document.getElementById(`check-${id}-div`);
    const inputVal = document.getElementById(`val-${id}`);
    const inputQty = document.getElementById(`qty-${id}`);

    // If clicked on div, toggle checkbox (unless clicked on inputs)
    if (event.target !== checkbox && event.target !== inputVal && event.target !== inputQty) {
        checkbox.checked = !checkbox.checked;
    }

    if (checkbox.checked) {
        div.classList.add('checked');
        inputVal.disabled = false;
        inputQty.disabled = false;
        inputVal.focus();
    } else {
        div.classList.remove('checked');
        inputVal.disabled = true;
        inputQty.disabled = true;
        inputVal.value = '';
        inputQty.value = '1';
    }
    calculateTotals();
}

function addOtherItem(desc = '', price = '', qty = 1) {
    const tbody = document.getElementById('invoice-items-other');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="w-full item-desc" placeholder="وصف الخدمة" value="${desc}" required></td>
        <td><input type="number" class="w-full item-qty" placeholder="1" value="${qty}" min="1" onchange="calculateTotals()" required></td>
        <td><input type="number" class="w-full item-price" placeholder="0.00" value="${price}" onchange="calculateTotals()" required></td>
        <td class="text-center"><button type="button" onclick="this.closest('tr').remove(); calculateTotals()" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function calculateTotals() {
    let taxableTotal = 0; // Only Clearance
    let nonTaxableTotal = 0; // Everything else

    // Helper
    const getLineTotal = (id) => {
        if (document.getElementById(`check-${id}`).checked) {
            const val = parseFloat(document.getElementById(`val-${id}`).value) || 0;
            const qty = parseFloat(document.getElementById(`qty-${id}`).value) || 1;
            return val * qty;
        }
        return 0;
    };

    // Clearance (Taxable)
    taxableTotal += getLineTotal('clearance');

    // Other Fixed Services (Non-Taxable)
    ['duties', 'appointment', 'saber', 'loading', 'insurance'].forEach(id => {
        nonTaxableTotal += getLineTotal(id);
    });

    // Other Items (Non-Taxable)
    document.querySelectorAll('#invoice-items-other tr').forEach(tr => {
        const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.item-price').value) || 0;
        nonTaxableTotal += (qty * price);
    });

    const vat = taxableTotal * 0.15;
    const totalAfter = taxableTotal + nonTaxableTotal + vat;

    document.getElementById('total-before-tax').textContent = (taxableTotal + nonTaxableTotal).toFixed(2);
    document.getElementById('vat-amount').textContent = vat.toFixed(2);
    document.getElementById('total-after-tax').textContent = totalAfter.toFixed(2);
}

async function saveInvoice(status) {
    const form = document.getElementById('invoice-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const items = [];

    // Helper to add item
    const addItem = (id, category, name, isTaxable) => {
        if (document.getElementById(`check-${id}`).checked) {
            const val = parseFloat(document.getElementById(`val-${id}`).value) || 0;
            const qty = parseFloat(document.getElementById(`qty-${id}`).value) || 1;
            if (val > 0) {
                items.push({
                    description: name,
                    category: category,
                    quantity: qty,
                    unit_price: val,
                    taxable: isTaxable
                });
            }
        }
    };

    // Only Clearance is Taxable
    addItem('clearance', 'Clearance', 'تخليص جمركي', true);

    // Others are Non-Taxable
    addItem('duties', 'Customs Duties', 'رسوم جمركية', false);
    addItem('appointment', 'Appointment', 'حجز موعد', false);
    addItem('saber', 'Saber', 'سابر', false);
    addItem('loading', 'Loading', 'تفريغ وتحميل', false);
    addItem('insurance', 'Insurance', 'تأمين', false);

    // Add Other Items (Non-Taxable)
    document.querySelectorAll('#invoice-items-other tr').forEach(tr => {
        const desc = tr.querySelector('.item-desc').value;
        const qty = parseFloat(tr.querySelector('.item-qty').value) || 1;
        const price = parseFloat(tr.querySelector('.item-price').value) || 0;
        if (desc && price > 0) {
            items.push({
                description: desc,
                category: 'Other',
                quantity: qty,
                unit_price: price,
                taxable: false
            });
        }
    });

    if (items.length === 0) {
        alert('الرجاء إضافة خدمة واحدة على الأقل');
        return;
    }

    const data = {
        company_id: document.getElementById('invoice-company').value,
        date: document.getElementById('invoice-date').value,
        customs_office: document.getElementById('invoice-customs').value,
        shipment_type: document.getElementById('invoice-shipment').value,
        notes: document.getElementById('invoice-notes').value,
        status: status,
        items: items
    };

    const editingId = form.dataset.editingId;
    const url = editingId ? `/api/invoices/${editingId}` : '/api/invoices';
    const method = editingId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            const result = await res.json();
            alert(editingId ? 'تم التحديث بنجاح' : 'تم الحفظ بنجاح');
            if (status === 'Final') {
                const idToView = editingId || result.id;
                await viewInvoice(idToView);
            } else {
                showSection('invoice-register');
            }
        } else {
            alert('حدث خطأ أثناء الحفظ');
        }
    } catch (err) {
        console.error(err);
        alert('خطأ في الاتصال');
    }
}

document.getElementById('invoice-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveInvoice('Final');
});

// --- Actions ---

async function editInvoice(id) {
    try {
        const res = await fetch(`/api/invoices/${id}`);
        const invoice = await res.json();

        showSection('create-invoice');
        document.getElementById('invoice-form').dataset.editingId = id;

        // Fill Basic Info
        document.getElementById('invoice-company').value = invoice.company_id;
        document.getElementById('invoice-date').value = invoice.date;
        document.getElementById('invoice-customs').value = invoice.customs_office || '';
        document.getElementById('invoice-shipment').value = invoice.shipment_type || 'Import';
        document.getElementById('invoice-notes').value = invoice.notes || '';

        // Fill Items - Reset first
        ['clearance', 'duties', 'appointment', 'saber', 'loading', 'insurance'].forEach(key => {
            document.getElementById(`check-${key}`).checked = false;
            document.getElementById(`val-${key}`).value = '';
            document.getElementById(`qty-${key}`).value = '1';
            document.getElementById(`val-${key}`).disabled = true;
            document.getElementById(`qty-${key}`).disabled = true;
            document.getElementById(`check-${key}-div`).classList.remove('checked');
        });
        document.getElementById('invoice-items-other').innerHTML = '';

        invoice.items.forEach(item => {
            let key = null;
            if (item.category === 'Clearance') key = 'clearance';
            else if (item.category === 'Customs Duties') key = 'duties';
            else if (item.category === 'Appointment') key = 'appointment';
            else if (item.category === 'Saber') key = 'saber';
            else if (item.category === 'Loading') key = 'loading';
            else if (item.category === 'Insurance') key = 'insurance';

            if (key) {
                const checkbox = document.getElementById(`check-${key}`);
                const inputVal = document.getElementById(`val-${key}`);
                const inputQty = document.getElementById(`qty-${key}`);
                const div = document.getElementById(`check-${key}-div`);

                checkbox.checked = true;
                div.classList.add('checked');
                inputVal.disabled = false;
                inputQty.disabled = false;
                inputVal.value = item.unit_price;
                inputQty.value = item.quantity;
            } else {
                addOtherItem(item.description, item.unit_price, item.quantity);
            }
        });

        calculateTotals();

    } catch (err) {
        console.error(err);
        alert('خطأ في تحميل الفاتورة');
    }
}

async function deleteInvoice(id) {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.')) {
        try {
            const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadInvoices();
                alert('تم حذف الفاتورة بنجاح');
            } else {
                alert('حدث خطأ أثناء الحذف');
            }
        } catch (err) {
            console.error(err);
            alert('خطأ في الاتصال');
        }
    }
}

// --- Companies & Bonds ---

async function loadCompanies() {
    const res = await fetch('/api/companies');
    const companies = await res.json();
    const tbody = document.getElementById('company-list');
    tbody.innerHTML = companies.map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.vat_number}</td>
            <td>${c.contact_person}</td>
            <td>${c.phone}</td>
            <td>
                <button onclick="editCompany(${c.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteCompany(${c.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function loadCompanyOptions(selectId) {
    const res = await fetch('/api/companies');
    const companies = await res.json();
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentVal = select.value;
    const firstOpt = select.options[0] ? select.options[0].outerHTML : '';
    const isFilter = selectId.includes('filter') || selectId.includes('dash') || selectId.includes('tax');

    select.innerHTML = (isFilter ? firstOpt : '<option value="" disabled selected>اختر الشركة</option>') +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if (currentVal) select.value = currentVal;
}

function showAddCompanyModal() {
    document.getElementById('company-form').reset();
    document.getElementById('company-id').value = '';
    document.getElementById('company-modal').classList.remove('hidden');
    document.getElementById('company-modal').classList.add('flex');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).classList.remove('flex');
}

document.getElementById('company-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('company-id').value;
    const data = {
        name: document.getElementById('company-name').value,
        vat_number: document.getElementById('company-vat').value,
        contact_person: document.getElementById('company-contact').value,
        phone: document.getElementById('company-phone').value,
        address: document.getElementById('company-address').value,
        bank_account: document.getElementById('company-bank').value
    };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/companies/${id}` : '/api/companies';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('company-modal');
    loadCompanies();

    ['invoice-company', 'invoice-filter-company', 'dash-company', 'tax-company', 'bond-company'].forEach(id => {
        loadCompanyOptions(id);
    });
});

async function deleteCompany(id) {
    if (confirm('حذف الشركة؟')) {
        await fetch(`/api/companies/${id}`, { method: 'DELETE' });
        loadCompanies();
    }
}

async function editCompany(id) {
    const res = await fetch('/api/companies');
    const companies = await res.json();
    const c = companies.find(x => x.id === id);
    if (c) {
        document.getElementById('company-id').value = c.id;
        document.getElementById('company-name').value = c.name;
        document.getElementById('company-vat').value = c.vat_number;
        document.getElementById('company-contact').value = c.contact_person;
        document.getElementById('company-phone').value = c.phone;
        document.getElementById('company-address').value = c.address;
        document.getElementById('company-bank').value = c.bank_account;
        document.getElementById('company-modal').classList.remove('hidden');
        document.getElementById('company-modal').classList.add('flex');
    }
}

// --- Tax Register ---
async function loadTaxRegister() {
    const month = document.getElementById('tax-month').value;
    const year = document.getElementById('tax-year').value;
    const company = document.getElementById('tax-company').value;
    const params = new URLSearchParams();

    if (month && year) {
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;
        params.append('startDate', startDate);
        params.append('endDate', endDate);
    } else if (year) {
        params.append('startDate', `${year}-01-01`);
        params.append('endDate', `${year}-12-31`);
    }

    if (company) params.append('companyId', company);

    const res = await fetch(`/api/tax-register?${params}`);
    if (!res.ok) {
        console.error('Failed to load tax register:', res.status, res.statusText);
        return;
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) {
        console.error('Invalid response format:', rows);
        return;
    }
    document.getElementById('tax-list').innerHTML = rows.map(r => `
        <tr>
            <td>${r.date}</td>
            <td>${r.company_name}</td>
            <td>${formatCurrency(r.total_before_tax)}</td>
            <td>${formatCurrency(r.vat_amount)}</td>
            <td>${formatCurrency(r.total_after_tax)}</td>
        </tr>
    `).join('');

    if (document.getElementById('tax-company').options.length <= 1) {
        loadCompanyOptions('tax-company');
    }
}

async function printTaxRegister() {
    const month = document.getElementById('tax-month').value;
    const year = document.getElementById('tax-year').value;
    const companyId = document.getElementById('tax-company').value;

    const params = new URLSearchParams();
    let start = null;
    let end = null;

    if (month && year) {
        start = `${year}-${month}-01`;
        end = `${year}-${month}-${new Date(year, month, 0).getDate()}`;
        params.append('startDate', start);
        params.append('endDate', end);
    } else if (year) {
        start = `${year}-01-01`;
        end = `${year}-12-31`;
        params.append('startDate', start);
        params.append('endDate', end);
    }

    if (companyId) params.append('companyId', companyId);

    const res = await fetch(`/api/tax-register?${params}`);
    const rows = await res.json();

    const settingsRes = await fetch('/api/settings');
    const settings = await settingsRes.json();

    let periodTitle = 'تقرير شامل';
    if (start) {
        const date = new Date(start);
        const monthName = date.toLocaleDateString('ar-SA', { month: 'long' });
        const year = date.getFullYear();
        periodTitle = `تقرير شهر ${monthName} ${year}`;

        if (end) {
            const endDateObj = new Date(end);
            if (date.getMonth() !== endDateObj.getMonth() || date.getFullYear() !== endDateObj.getFullYear()) {
                periodTitle = `تقرير الفترة من ${start} إلى ${end}`;
            }
        }
    }

    const printDate = new Date();
    const gregorianDate = printDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const hijriDate = printDate.toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' });

    let totalBefore = 0;
    let totalVat = 0;
    let totalAfter = 0;
    rows.forEach(r => {
        totalBefore += r.total_before_tax || 0;
        totalVat += r.vat_amount || 0;
        totalAfter += r.total_after_tax || 0;
    });

    const printView = document.getElementById('print-view');
    printView.innerHTML = `
        <div class="max-w-4xl mx-auto bg-white p-8" style="direction: rtl; font-family: 'Segoe UI', sans-serif;">
            <div class="flex justify-between items-center border-b-2 border-gray-800 pb-6 mb-6">
                <div>
                    <h1 class="text-2xl font-bold">${settings.company_name_ar || 'اسم الشركة'}</h1>
                    <p class="text-gray-600">الكشف الضريبي</p>
                </div>
                <div class="text-center">
                    <h2 class="text-xl font-bold mb-2">${periodTitle}</h2>
                    <div class="inline-block bg-gray-100 rounded px-3 py-1 border border-gray-300">
                        <span class="text-sm text-gray-600 font-bold">تاريخ الطباعة:</span>
                        <div class="text-sm text-gray-800" dir="rtl">
                            <span>${gregorianDate} م</span>
                            <span class="mx-2">|</span>
                            <span>${hijriDate} هـ</span>
                        </div>
                    </div>
                </div>
            </div>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-gray-800 text-white">
                        <th class="p-3 text-right">التاريخ</th>
                        <th class="p-3 text-right">الشركة</th>
                        <th class="p-3 text-left">قبل الضريبة</th>
                        <th class="p-3 text-left">الضريبة</th>
                        <th class="p-3 text-left">الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                    <tr class="border-b">
                        <td class="p-3">${r.date}</td>
                        <td class="p-3">${r.company_name}</td>
                        <td class="p-3 text-left">${formatCurrency(r.total_before_tax)}</td>
                        <td class="p-3 text-left">${formatCurrency(r.vat_amount)}</td>
                        <td class="p-3 text-left">${formatCurrency(r.total_after_tax)}</td>
                    </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="bg-gray-100 font-bold">
                        <td colspan="2" class="p-3 text-right">الإجمالي</td>
                        <td class="p-3 text-left">${formatCurrency(totalBefore)}</td>
                        <td class="p-3 text-left">${formatCurrency(totalVat)}</td>
                        <td class="p-3 text-left">${formatCurrency(totalAfter)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    setTimeout(() => {
        document.getElementById('main-content').classList.add('hidden');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('print-view').classList.remove('print-only');
        window.print();
        setTimeout(() => {
            document.getElementById('print-view').classList.add('print-only');
            document.getElementById('main-content').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
        }, 500);
    }, 100);
}

function sendToZatcaBatch() {
    alert('سيتم إرسال الفواتير إلى هيئة الزكاة والضريبة والجمارك');
}

// --- Profile/Settings ---
async function loadProfile() {
    const res = await fetch('/api/settings');
    const settings = await res.json();

    document.getElementById('profile-company-ar').value = settings.company_name_ar || '';
    document.getElementById('profile-company-en').value = settings.company_name_en || '';
    document.getElementById('profile-vat').value = settings.vat_number || '';
    document.getElementById('profile-bank').value = settings.bank_account || '';
    document.getElementById('profile-phone').value = settings.phone || '';
    document.getElementById('profile-email').value = settings.email || '';
    document.getElementById('profile-address').value = settings.address || '';
    document.getElementById('profile-logo').value = settings.logo_path || '';
    document.getElementById('profile-stamp').value = settings.stamp_path || '';
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        company_name_ar: document.getElementById('profile-company-ar').value,
        company_name_en: document.getElementById('profile-company-en').value,
        vat_number: document.getElementById('profile-vat').value,
        bank_account: document.getElementById('profile-bank').value,
        address: document.getElementById('profile-address').value,
        phone: document.getElementById('profile-phone').value,
        email: document.getElementById('profile-email').value,
        logo_path: document.getElementById('profile-logo').value,
        stamp_path: document.getElementById('profile-stamp').value
    };
    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    alert('تم حفظ إعدادات الشركة');
});

document.getElementById('user-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('user-username').value;
    const password = document.getElementById('user-password').value;

    const res = await fetch('/auth/update-user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        alert('تم التحديث بنجاح');
        document.getElementById('user-password').value = '';
    } else {
        const errData = await res.json();
        console.error('Update failed:', errData);
        alert('حدث خطأ أثناء التحديث: ' + (errData.error || 'خطأ غير معروف'));
    }
});


// --- Bonds ---
async function loadBonds() {
    const res = await fetch('/api/bonds');
    const bonds = await res.json();
    const tbody = document.getElementById('bond-list');
    tbody.innerHTML = bonds.map(b => `
        <tr>
            <td>${b.date}</td>
            <td>${b.company_name}</td>
            <td>${b.type === 'Receipt' ? 'قبض' : 'صرف'}</td>
            <td>${formatCurrency(b.amount)}</td>
            <td>${b.notes || '-'}</td>
        </tr>
    `).join('');
}

function showAddBondModal() {
    document.getElementById('bond-form').reset();
    document.getElementById('bond-modal').classList.remove('hidden');
    document.getElementById('bond-modal').classList.add('flex');
    loadCompanyOptions('bond-company');
}

document.getElementById('bond-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        company_id: document.getElementById('bond-company').value,
        date: document.getElementById('bond-date').value,
        type: document.getElementById('bond-type').value,
        amount: document.getElementById('bond-amount').value,
        notes: document.getElementById('bond-notes').value
    };

    await fetch('/api/bonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    closeModal('bond-modal');
    loadBonds();
});

// --- Helper Functions ---
function formatCurrency(val) {
    return parseFloat(val || 0).toFixed(2) + ' ريال';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function viewInvoice(id) {
    try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) throw new Error('Failed to fetch invoice');
        const invoice = await res.json();

        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();

        const printView = document.getElementById('print-view');

        // Generate Items HTML
        const itemsHtml = invoice.items.map((item, index) => `
                <tr class="border-b border-gray-300">
                    <td class="p-2 text-center">${index + 1}</td>
                    <td class="p-2">${item.description}</td>
                    <td class="p-2 text-center">${item.quantity}</td>
                    <td class="p-2 text-center">${formatCurrency(item.unit_price)}</td>
                    <td class="p-2 text-center">${formatCurrency(item.line_total)}</td>
                    <td class="p-2 text-center">${item.taxable ? '15%' : '0%'}</td>
                    <td class="p-2 text-center">${item.taxable ? formatCurrency(item.line_total * 0.15) : '0.00'}</td>
                    <td class="p-2 text-center">${formatCurrency(item.line_total + (item.taxable ? item.line_total * 0.15 : 0))}</td>
                </tr>
            `).join('');

        printView.innerHTML = `
                <div class="relative mx-auto bg-white shadow-lg overflow-hidden" style="width: 210mm; height: 297mm; direction: rtl; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13.5px; color: #000;">
                    
                    <!-- Background Image -->
                    <div class="absolute inset-0 z-0">
                        <img src="/images/invoice-bg.jpg" class="w-full h-full object-fill" alt="Background">
                    </div>

                    <!-- Content Overlay -->
                    <div class="relative z-10 px-10 flex flex-col h-full" style="padding-top: 200px; padding-bottom: 220px;">
                        
                        <!-- Header Section: Invoice Title & Meta -->
                        <div class="flex justify-between items-start mb-4">
                            <div class="text-right">
                                <h1 class="text-2xl font-bold text-black mb-1">فاتورة ضريبية</h1>
                                <h2 class="text-lg text-gray-600 font-semibold tracking-wide">Tax Invoice</h2>
                            </div>
                            <div class="text-center pt-2">
                                ${invoice.qr_code ? `<div id="qrcode" class="p-1 bg-white border border-gray-200"></div>` : ''}
                            </div>
                            <div class="text-left">
                                <div class="mb-1">
                                    <span class="block text-gray-500 text-xs uppercase">Invoice Number</span>
                                    <span class="block font-bold text-xl text-blue-900 font-mono">#${invoice.id}</span>
                                </div>
                                <div>
                                    <span class="block text-gray-500 text-xs uppercase">Date</span>
                                    <span class="block font-bold text-base text-gray-800">${invoice.date}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Customer & Invoice Details Box -->
                        <div class="border border-gray-800 rounded-lg mb-4 bg-white/50 backdrop-blur-sm">
                            <div class="grid grid-cols-2 divide-x divide-x-reverse divide-gray-800">
                                <!-- Customer Info -->
                                <div class="p-3">
                                    <h3 class="font-bold text-gray-900 border-b border-gray-300 pb-2 mb-2 flex justify-between items-center bg-gray-100/50 p-1 rounded text-sm">
                                        <span>بيانات العميل</span>
                                        <span class="text-xs text-gray-500 uppercase">Customer Details</span>
                                    </h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="grid grid-cols-[85px_1fr] items-center">
                                            <span class="text-gray-700 font-semibold">الاسم :</span>
                                            <span class="font-bold text-sm truncate">${invoice.company_name}</span>
                                        </div>
                                        <div class="grid grid-cols-[85px_1fr] items-center">
                                            <span class="text-gray-700 font-semibold">رقم الضريبة :</span>
                                            <span class="font-mono font-bold text-sm" dir="ltr">${invoice.vat_number || '-'}</span>
                                        </div>
                                        <div class="grid grid-cols-[85px_1fr] items-start">
                                            <span class="text-gray-700 font-semibold">العنوان :</span>
                                            <span class="leading-snug text-xs">${invoice.address || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Transaction Info -->
                                <div class="p-3">
                                    <h3 class="font-bold text-gray-900 border-b border-gray-300 pb-2 mb-2 flex justify-between items-center bg-gray-100/50 p-1 rounded text-sm">
                                        <span>تفاصيل الفاتورة</span>
                                        <span class="text-xs text-gray-500 uppercase">Invoice Details</span>
                                    </h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between items-center border-b border-dashed border-gray-300 pb-1">
                                            <span class="text-gray-700 font-semibold">نوع الشحنة / Type</span>
                                            <span class="font-bold text-sm">${invoice.shipment_type || '-'}</span>
                                        </div>
                                        <div class="flex justify-between items-center border-b border-dashed border-gray-300 pb-1">
                                            <span class="text-gray-700 font-semibold">المنفذ / Customs Office</span>
                                            <span class="font-bold text-sm">${invoice.customs_office || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ZATCA Standard Table -->
                        <div class="flex-grow">
                            <table class="w-full border-collapse border border-gray-800 text-sm bg-white/80">
                                <thead>
                                    <tr class="bg-gray-800 text-white">
                                        <th class="border border-gray-600 p-2 w-[5%] text-center">#</th>
                                        <th class="border border-gray-600 p-2 w-[35%] text-right font-bold text-sm">السلع والخدمات <br><span class="text-[10px] font-normal text-gray-300">Description</span></th>
                                        <th class="border border-gray-600 p-2 w-[10%] text-center font-bold">الكمية <br><span class="text-[10px] font-normal text-gray-300">Qty</span></th>
                                        <th class="border border-gray-600 p-2 w-[12%] text-center font-bold">سعر الوحدة <br><span class="text-[10px] font-normal text-gray-300">Unit Price</span></th>
                                        <th class="border border-gray-600 p-2 w-[13%] text-center font-bold">المجموع <br><span class="text-[10px] font-normal text-gray-300">Subtotal</span></th>
                                        <th class="border border-gray-600 p-2 w-[12%] text-center font-bold">الضريبة <br><span class="text-[10px] font-normal text-gray-300">VAT (15%)</span></th>
                                        <th class="border border-gray-600 p-2 w-[13%] text-center font-bold">الإجمالي <br><span class="text-[10px] font-normal text-gray-300">Total</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoice.items.map((item, i) => `
                                    <tr class="border-b border-gray-300 even:bg-gray-50">
                                        <td class="border-x border-gray-300 p-2 text-center font-mono text-gray-600">${i + 1}</td>
                                        <td class="border-x border-gray-300 p-2 font-bold text-gray-900 text-sm">${item.description}</td>
                                        <td class="border-x border-gray-300 p-2 text-center font-mono font-bold text-sm">${item.quantity}</td>
                                        <td class="border-x border-gray-300 p-2 text-center font-mono text-sm">${formatCurrency(item.unit_price).replace(' ريال', '')}</td>
                                        <td class="border-x border-gray-300 p-2 text-center font-mono text-sm">${formatCurrency(item.line_total).replace(' ريال', '')}</td>
                                        <td class="border-x border-gray-300 p-2 text-center font-mono text-sm">${item.taxable ? formatCurrency(item.line_total * 0.15).replace(' ريال', '') : '0.00'}</td>
                                        <td class="border-x border-gray-300 p-2 text-center font-mono font-bold text-base text-gray-900">${formatCurrency(item.line_total + (item.taxable ? item.line_total * 0.15 : 0)).replace(' ريال', '')}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Footer Section: Totals & Bank -->
                        <div class="mt-auto">
                            <div class="flex gap-6 items-start">
                                <!-- Notes & Terms -->
                                <div class="w-1/2 pt-2">
                                     ${invoice.notes ? `
                                        <div class="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                                            <span class="block font-bold text-gray-800 mb-1 border-b border-yellow-200 pb-1 text-sm">ملاحظات / Notes</span>
                                            <p class="text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">${invoice.notes}</p>
                                        </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Totals Box -->
                                <div class="w-1/2">
                                    <table class="w-full text-sm font-bold border-collapse border border-gray-400 bg-white">
                                        <tr>
                                            <td class="p-2 border border-gray-300 bg-gray-50 text-gray-800 text-sm">الإجمالي (غير شامل الضريبة) <br> <span class="font-normal text-[10px] text-gray-600">Total (Excl. VAT)</span></td>
                                            <td class="p-2 border border-gray-300 text-left font-mono text-base">${formatCurrency(invoice.total_before_tax)}</td>
                                        </tr>
                                        <tr>
                                            <td class="p-2 border border-gray-300 bg-gray-50 text-gray-800 text-sm">مجموع الضريبة (15%) <br> <span class="font-normal text-[10px] text-gray-600">Total VAT (15%)</span></td>
                                            <td class="p-2 border border-gray-300 text-left font-mono text-base text-red-600">${formatCurrency(invoice.vat_amount)}</td>
                                        </tr>
                                        <tr class="bg-gray-800 text-white">
                                            <td class="p-3 border border-gray-800 text-base">الإجمالي المستحق <br> <span class="font-normal text-xs text-gray-300">Total Amount Due</span></td>
                                            <td class="p-3 border border-gray-800 text-left font-mono text-xl font-bold">${formatCurrency(invoice.total_after_tax)}</td>
                                        </tr>
                                    </table>
                                </div>
                            </div>

                            <!-- Bank Details -->
                            <div class="mt-4 border-t-2 border-gray-200 pt-3">
                                <div class="flex justify-center items-center gap-6 text-sm text-gray-800 bg-gray-50 py-2 rounded border border-gray-200">
                                    <div class="font-bold flex items-center gap-2 text-sm">
                                        <i class="fas fa-university text-blue-600 text-lg"></i>
                                        <span>البنك الأهلي السعودي</span>
                                    </div>
                                    <div class="h-5 w-px bg-gray-300"></div>
                                    <div class="font-mono flex flex-col items-start leading-tight">
                                        <span class="text-[10px] text-gray-500 uppercase font-bold">Account Number</span>
                                        <span class="font-bold text-base text-blue-900">74800000268401</span>
                                    </div>
                                    <div class="h-5 w-px bg-gray-300"></div>
                                    <div class="font-mono flex flex-col items-start leading-tight">
                                        <span class="text-[10px] text-gray-500 uppercase font-bold">IBAN</span>
                                        <span class="font-bold text-base text-blue-900">SA7610000074800000268401</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            `;

        // Render QR Code
        if (invoice.qr_code) {
            setTimeout(() => {
                const qrContainer = document.getElementById('qrcode');
                if (qrContainer) {
                    qrContainer.innerHTML = '';
                    new QRCode(qrContainer, {
                        text: invoice.qr_code,
                        width: 90,
                        height: 90
                    });
                }
            }, 100);
        }

        // Show Print View
        document.getElementById('main-content').classList.add('hidden');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('print-view').classList.remove('print-only');

        // Add Close Button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-2 rounded-lg shadow-lg no-print z-50 hover:bg-red-700 transition-colors font-bold flex items-center gap-2';
        closeBtn.innerHTML = '<i class="fas fa-times"></i> إغلاق';
        closeBtn.onclick = () => {
            document.getElementById('print-view').classList.add('print-only');
            document.getElementById('print-view').innerHTML = '';
            document.getElementById('main-content').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
        };
        document.getElementById('print-view').appendChild(closeBtn);

        // Add Print Button
        const printBtn = document.createElement('button');
        printBtn.className = 'fixed top-4 right-36 bg-blue-600 text-white px-6 py-2 rounded-lg shadow-lg no-print z-50 hover:bg-blue-700 transition-colors font-bold flex items-center gap-2';
        printBtn.innerHTML = '<i class="fas fa-print"></i> طباعة';
        printBtn.onclick = () => window.print();
        document.getElementById('print-view').appendChild(printBtn);

    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء عرض الفاتورة');
    }
}

function shareInvoice(id, companyName, total) {
    const text = `فاتورة جديدة من ${companyName} \nرقم: #${id} \nالإجمالي: ${total} ريال`;
    if (navigator.share) {
        navigator.share({
            title: `فاتورة #${id} `,
            text: text,
            url: window.location.href
        }).catch(console.error);
    } else {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    }
}
