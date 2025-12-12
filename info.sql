-- PostgreSQL Data Dump from SQLite
-- Generated automatically


-- Table: users
CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );

-- Table: companies
CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                vat_number VARCHAR(50),
                contact_person VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                bank_account VARCHAR(255)
            );

-- Table: invoices
CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                invoice_number VARCHAR(50),
                date TIMESTAMP,
                customs_office VARCHAR(255),
                shipment_type VARCHAR(50),
                notes TEXT,
                status VARCHAR(50) DEFAULT 'Draft',
                qr_code TEXT,
                total_before_tax DECIMAL(10, 2),
                clearance_fee DECIMAL(10, 2),
                vat_amount DECIMAL(10, 2),
                total_after_tax DECIMAL(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                uuid VARCHAR(255),
                zatca_submitted INTEGER DEFAULT 0,
                zatca_cleared INTEGER DEFAULT 0,
                zatca_status VARCHAR(50),
                zatca_response TEXT,
                submitted_at TIMESTAMP,
                cleared_at TIMESTAMP,
                xml_content TEXT
            );

-- Table: invoice_items
CREATE TABLE IF NOT EXISTS invoice_items (
                id SERIAL PRIMARY KEY,
                invoice_id INTEGER,
                description TEXT,
                category VARCHAR(50),
                quantity DECIMAL(10, 2),
                unit_price DECIMAL(10, 2),
                line_total DECIMAL(10, 2),
                taxable INTEGER DEFAULT 1
            );

-- Table: bonds
CREATE TABLE IF NOT EXISTS bonds (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                type VARCHAR(50),
                amount DECIMAL(10, 2),
                date TIMESTAMP,
                notes TEXT
            );

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                company_name_ar VARCHAR(255),
                company_name_en VARCHAR(255),
                vat_number VARCHAR(50),
                bank_account VARCHAR(255),
                address TEXT,
                phone VARCHAR(50),
                email VARCHAR(255),
                logo_path VARCHAR(255),
                stamp_path VARCHAR(255)
            );

-- Data for users
INSERT INTO users (id, username, password) VALUES (6, 'admin', 'admin') ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, username, password) VALUES (7, 'essa6502', '0531055420') ON CONFLICT (id) DO NOTHING;
SELECT setval('users_id_seq', 7);

-- Data for companies
INSERT INTO companies (id, name, vat_number, contact_person, phone, address, bank_account) VALUES (8, 'شركة سعود وناصر عبدالرحمن الحازمي للأدوات الصحية المحدوده', '300166273300003', '', '', '', '') ON CONFLICT (id) DO NOTHING;
SELECT setval('companies_id_seq', 8);

-- Data for invoices
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (11, 2, NULL, '2025-11-23', '', 'Import', '1113234', 'Final', 'ARvYudio2K/Yp9mE2K3ZgdmK2Lgg2LnYp9iv2YQCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yM1QwMjo0MTowNi40MDlaBAYyMTUuMDAFBTE1LjAw', 200, 15, 15, 215, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (13, 2, NULL, '2025-11-25', 'جسر الملك فهد ', 'Import', '', 'Final', 'ARvYudio2K/Yp9mE2K3ZgdmK2Lgg2LnYp9iv2YQCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yNVQwMjo1Mzo0MC42NzVaBAYxNjUuMDAFBTE1LjAw', 150, 15, 15, 165, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (14, 2, NULL, '2025-11-25', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yNVQwMzoyOToyMy41OTJaBAYxMTUuMDAFBTE1LjAw', 100, 15, 15, 115, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (15, 2, NULL, '2025-11-25', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yNVQwMzo0NTozMy40MzlaBAYxMTUuMDAFBTE1LjAw', 100, 15, 15, 115, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (16, 2, NULL, '2025-11-25', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yNVQwMzo1MToxMS45NzFaBAQwLjAwBQQwLjAw', 0, 0, 0, 0, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (17, 1, NULL, '2024-10-15', NULL, NULL, NULL, 'Final', NULL, 12750, 0, 2250, 15000, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (18, 1, NULL, '2024-09-20', NULL, NULL, NULL, 'Final', NULL, 7225, 0, 1275, 8500, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (19, 1, NULL, '2024-08-05', NULL, NULL, NULL, 'Final', NULL, 10200, 0, 1800, 12000, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (20, 1, NULL, '2024-10-01', NULL, NULL, NULL, 'Final', NULL, 5100, 0, 900, 6000, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (25, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMzo1NzoxMC4wOTZaBAYzNjUuMDAFBTE1LjAw', 350, 100, 15, 365, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (26, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToxNy44OTNaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (27, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToxOC4wMTNaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (28, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMC4wNDZaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (29, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMC4yNjVaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (30, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMC40MjJaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (31, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMC41NTFaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (32, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMC43MDhaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (33, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMC45NzFaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (34, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMS4yMjhaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (35, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMS41MjJaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (36, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMS43MjlaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (37, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMi4wMTlaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (38, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMi4xNDFaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (39, 6, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMjowMToyMi4yNTNaBAY0MTUuMDAFBTE1LjAw', 400, 15, 15, 415, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (40, 7, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMzoyNzo0OS43MzBaBAYyMTUuMDAFBTE1LjAw', 200, 100, 15, 215, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (41, 7, NULL, '2025-11-27', '', 'Import', '', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMzozMDozOC43NTVaBAYxNjUuMDAFBTE1LjAw', 150, 100, 15, 165, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (42, 7, NULL, '2025-11-27', '', 'Import', 'ميتهسيه', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMS0yN1QyMzozNzoyNi4xNDJaBAYxMTUuMDAFBTE1LjAw', 100, 100, 15, 115, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax, uuid, zatca_submitted, zatca_cleared, zatca_status, zatca_response, submitted_at, cleared_at, xml_content) VALUES (48, 8, NULL, '2025-12-11', 'جسر الملك فهد', 'Import', 'رقم البيان / 124316', 'Final', 'AQ9BYmRlbGhhZml6IEFkZWwCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNS0xMi0xMFQyMToxMzo0OS45NjZaBAYyODAuMDAFBTMwLjAw', 250, 200, 30, 280, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
SELECT setval('invoices_id_seq', 48);

-- Data for invoice_items
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (19, 11, 'Clearance', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (20, 11, 'Appointment', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (21, 11, 'Appointment', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (23, 13, 'Clearance', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (24, 13, 'Appointment', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (25, 14, 'Clearance', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (26, 15, 'Clearance', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (27, 16, 'Clearance', 'Clearance', 1, 0, 0, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (74, 26, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (75, 26, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (76, 26, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (77, 26, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (78, 26, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (79, 26, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (80, 26, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (81, 27, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (82, 27, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (83, 27, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (84, 27, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (85, 27, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (86, 27, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (87, 27, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (88, 28, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (89, 28, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (90, 28, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (91, 28, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (92, 28, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (93, 28, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (94, 28, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (95, 29, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (96, 29, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (97, 29, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (98, 29, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (99, 29, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (100, 29, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (101, 29, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (102, 30, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (103, 30, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (104, 30, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (105, 30, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (106, 30, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (107, 30, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (108, 30, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (109, 31, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (110, 31, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (111, 31, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (112, 31, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (113, 31, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (114, 31, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (115, 31, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (116, 32, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (117, 32, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (118, 32, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (119, 32, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (120, 32, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (121, 32, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (122, 32, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (123, 33, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (124, 33, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (125, 33, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (126, 33, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (127, 33, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (128, 33, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (129, 33, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (130, 34, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (131, 34, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (132, 34, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (133, 34, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (134, 34, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (135, 34, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (136, 34, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (137, 35, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (138, 35, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (139, 35, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (140, 35, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (141, 35, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (142, 35, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (143, 35, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (144, 36, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (145, 36, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (146, 36, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (147, 36, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (148, 36, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (149, 36, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (150, 36, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (151, 37, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (152, 37, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (153, 37, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (154, 37, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (155, 37, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (156, 37, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (157, 37, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (158, 38, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (159, 38, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (160, 38, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (161, 38, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (162, 38, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (163, 38, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (164, 38, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (165, 39, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (166, 39, 'رسوم جمركية', 'Customs Duties', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (167, 39, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (168, 39, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (169, 39, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (170, 39, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (171, 39, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (172, 40, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (173, 40, 'حجز موعد', 'Appointment', 2, 50, 100, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (174, 41, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (175, 41, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (176, 42, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (177, 25, 'تخليص جمركي', 'Clearance', 1, 100, 100, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (178, 25, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (179, 25, 'سابر', 'Saber', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (180, 25, 'تفريغ وتحميل', 'Loading', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (181, 25, 'تأمين', 'Insurance', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (182, 25, 'حجز موعد 2', 'Other', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (202, 48, 'تخليص جمركي', 'Clearance', 1, 200, 200, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (203, 48, 'حجز موعد', 'Appointment', 1, 50, 50, 0) ON CONFLICT (id) DO NOTHING;
SELECT setval('invoice_items_id_seq', 203);

-- Data for bonds
INSERT INTO bonds (id, company_id, type, amount, date, notes) VALUES (1, 2, 'receipt', 5000, '2000-01-02', '') ON CONFLICT (id) DO NOTHING;
INSERT INTO bonds (id, company_id, type, amount, date, notes) VALUES (2, 2, 'payment', 2200, '2000-02-22', '466') ON CONFLICT (id) DO NOTHING;
INSERT INTO bonds (id, company_id, type, amount, date, notes) VALUES (3, 6, 'receipt', 50, '0555-05-06', '') ON CONFLICT (id) DO NOTHING;
SELECT setval('bonds_id_seq', 3);

-- Data for settings
INSERT INTO settings (id, company_name_ar, company_name_en, vat_number, bank_account, address, phone, email, logo_path, stamp_path) VALUES (1, 'مؤسسة عيسي يوسف العامر للتخليص الجمركي', 'ESSA YOUSEF ALAMIR Establishment for Customs Clearance', '', '74800000268401', 'الخبر -اللملكة العربية السعودية', '966531055420+', '', '', '') ON CONFLICT (id) DO NOTHING;

COMMIT;
