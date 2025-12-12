const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'zatca-integration' },
    transports: [
        // Write all logs to combined.log
        new winston.transports.File({
            filename: path.join(logsDir, 'zatca.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 14
        }),
        // Write errors to error.log
        new winston.transports.File({
            filename: path.join(logsDir, 'zatca-errors.log'),
            level: 'error',
            maxsize: 10485760,
            maxFiles: 14
        })
    ]
});

// If not in production, also log to console
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Helper functions for structured logging
const loggers = {
    // Log invoice submission
    logInvoiceSubmission: (invoiceId, status, response) => {
        logger.info('Invoice Submission', {
            invoiceId,
            status,
            timestamp: new Date().toISOString(),
            response: response ? JSON.stringify(response) : null
        });
    },

    // Log invoice validation
    logInvoiceValidation: (invoiceId, isValid, errors) => {
        if (isValid) {
            logger.info('Invoice Validation Success', {
                invoiceId,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.warn('Invoice Validation Failed', {
                invoiceId,
                errors,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Log API errors
    logAPIError: (endpoint, error, requestData) => {
        logger.error('ZATCA API Error', {
            endpoint,
            error: error.message,
            stack: error.stack,
            requestData: requestData ? JSON.stringify(requestData) : null,
            timestamp: new Date().toISOString()
        });
    },

    // Log XML generation
    logXMLGeneration: (invoiceId, success, error) => {
        if (success) {
            logger.info('XML Generation Success', {
                invoiceId,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.error('XML Generation Failed', {
                invoiceId,
                error: error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
        }
    },

    // Log QR code generation
    logQRGeneration: (invoiceId, success) => {
        logger.info('QR Code Generation', {
            invoiceId,
            success,
            timestamp: new Date().toISOString()
        });
    },

    // Log certificate operations
    logCertificateOperation: (operation, success, error) => {
        if (success) {
            logger.info('Certificate Operation Success', {
                operation,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.error('Certificate Operation Failed', {
                operation,
                error: error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
        }
    },

    // Log compliance check
    logComplianceCheck: (invoiceId, isCompliant, issues) => {
        if (isCompliant) {
            logger.info('Compliance Check Passed', {
                invoiceId,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.warn('Compliance Check Failed', {
                invoiceId,
                issues,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Log retry attempts
    logRetryAttempt: (operation, attempt, maxAttempts) => {
        logger.warn('Retry Attempt', {
            operation,
            attempt,
            maxAttempts,
            timestamp: new Date().toISOString()
        });
    },

    // Generic info log
    info: (message, meta) => {
        logger.info(message, { ...meta, timestamp: new Date().toISOString() });
    },

    // Generic error log
    error: (message, error, meta) => {
        logger.error(message, {
            error: error ? error.message : null,
            stack: error ? error.stack : null,
            ...meta,
            timestamp: new Date().toISOString()
        });
    },

    // Generic warning log
    warn: (message, meta) => {
        logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
    },

    // Generic debug log
    debug: (message, meta) => {
        logger.debug(message, { ...meta, timestamp: new Date().toISOString() });
    }
};

module.exports = loggers;
