// ZATCA Integration Configuration
// Replace these values when you get your API credentials

module.exports = {
    // ZATCA API Configuration
    ZATCA_API: {
        // Sandbox URL (for testing)
        SANDBOX_URL: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',

        // Production URL (when ready)
        PRODUCTION_URL: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices',

        // Current environment
        ENVIRONMENT: 'SANDBOX', // Change to 'PRODUCTION' when ready

        // API Credentials (Replace with your actual credentials)
        API_KEY: 'YOUR_API_KEY_HERE',
        SECRET_KEY: 'YOUR_SECRET_KEY_HERE',

        // Certificate paths (when you get them from ZATCA)
        CERTIFICATE_PATH: './certificates/cert.pem',
        PRIVATE_KEY_PATH: './certificates/private-key.pem',

        // OTP for production onboarding
        OTP: 'YOUR_OTP_HERE',

        // Compliance CSID (from onboarding)
        COMPLIANCE_CSID: 'YOUR_COMPLIANCE_CSID_HERE',

        // Production CSID (after compliance approval)
        PRODUCTION_CSID: 'YOUR_PRODUCTION_CSID_HERE'
    },

    // Company Information (Seller)
    COMPANY_INFO: {
        VAT_NUMBER: '300000000000003',
        CR_NUMBER: '1234567890',
        COMPANY_NAME_AR: 'عبدالحفيظ عادل',
        COMPANY_NAME_EN: 'Abdelhafiz Adel',
        BUILDING_NUMBER: '1234',
        STREET_NAME_AR: 'شارع الملك فهد',
        STREET_NAME_EN: 'King Fahd Street',
        DISTRICT_AR: 'الرياض',
        DISTRICT_EN: 'Riyadh',
        CITY_AR: 'الرياض',
        CITY_EN: 'Riyadh',
        COUNTRY: 'SA',
        POSTAL_CODE: '12345',
        ADDITIONAL_NUMBER: '1234'
    },

    // Tax Configuration
    TAX_CONFIG: {
        VAT_RATE: 0.15, // 15%
        VAT_CATEGORY_CODE: 'S', // Standard rate
        TAX_EXEMPTION_REASON_CODE: null,
        TAX_EXEMPTION_REASON: null
    },

    // Invoice Configuration
    INVOICE_CONFIG: {
        // Invoice type codes
        TYPES: {
            STANDARD: '388', // Standard Invoice
            SIMPLIFIED: '388', // Simplified Invoice
            DEBIT_NOTE: '383',
            CREDIT_NOTE: '381'
        },

        // Transaction type codes
        TRANSACTION_TYPES: {
            STANDARD: '0100000', // Standard B2B
            SIMPLIFIED: '0200000', // Simplified B2C
            STANDARD_DEBIT: '0100000',
            STANDARD_CREDIT: '0100000',
            SIMPLIFIED_DEBIT: '0200000',
            SIMPLIFIED_CREDIT: '0200000'
        },

        // Currency
        CURRENCY: 'SAR',

        // Invoice counter prefix
        INVOICE_PREFIX: 'INV',

        // UUID version
        UUID_VERSION: 'v4'
    },

    // Logging Configuration
    LOGGING: {
        ENABLED: true,
        LOG_LEVEL: 'info', // 'error', 'warn', 'info', 'debug'
        LOG_FILE: './logs/zatca.log',
        ERROR_LOG_FILE: './logs/zatca-errors.log',
        MAX_FILE_SIZE: '10m',
        MAX_FILES: '14d'
    },

    // Retry Configuration
    RETRY_CONFIG: {
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000, // milliseconds
        BACKOFF_MULTIPLIER: 2
    },

    // Validation Rules
    VALIDATION: {
        MAX_LINE_ITEMS: 1000,
        MIN_INVOICE_AMOUNT: 0.01,
        MAX_INVOICE_AMOUNT: 999999999.99,
        REQUIRED_FIELDS: [
            'invoice_date',
            'company_id',
            'items'
        ]
    }
};
