import axios from 'axios';
import pkg from 'zatca-xml-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
const { EGS } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ZATCA_COMPLIANCE_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance';

const COMPANY = {
    vatNumber: '310137521300003',
    crnNumber: '7052683492',
    organizationName: 'Issa Yousuf Al Amer Customs Clearance',
    organizationUnitName: 'Dammam Branch',
    commonNamePrefix: 'TST',
    solutionName: 'ERB-APP',
    model: 'EGS-Model-1',
    customId: 'EGS-1',
    branchIndustry: 'Customs Clearance',
    location: {
        city: 'Dammam',
        city_subdivision: 'Ash Shifa',
        street: 'Prince Mohammed bin Fahd St',
        plot_identification: '1234',
        building: '8',
        postal_zone: '32236'
    }
};

function ensureOpenSSL() {
    try {
        execSync('openssl version', { stdio: 'ignore' });
        return;
    } catch (_) {
        const gitPath = 'C:\\Program Files\\Git\\usr\\bin';
        process.env.PATH = `${gitPath}${path.delimiter}${process.env.PATH}`;
        execSync('openssl version', { stdio: 'ignore' });
    }
}

async function generatePrivateKeyAndCsr() {
    const egs = new EGS({
        uuid: 'ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
        custom_id: COMPANY.customId,
        model: COMPANY.model,
        CRN_number: COMPANY.crnNumber,
        VAT_name: COMPANY.organizationName,
        VAT_number: COMPANY.vatNumber,
        branch_name: COMPANY.organizationUnitName,
        branch_industry: COMPANY.branchIndustry,
        location: COMPANY.location
    });

    await egs.generateNewKeysAndCSR(true, COMPANY.solutionName);

    const egsData = egs.get();
    const csrPem = String(egsData.csr || '').trim();
    if (!csrPem) {
        throw new Error('CSR generation failed: empty csr payload');
    }

    const csrPayload = Buffer.from(csrPem, 'utf8').toString('base64');

    return {
        privateKeyPem: egsData.private_key,
        csrPem,
        csrPayload,
        serialNumberPattern: '1-ABC|2-xyz|3-uuid',
        commonName: `${COMPANY.commonNamePrefix}-${COMPANY.vatNumber}`
    };
}

function extractZatcaErrorDetails(error) {
    if (error.response?.data) {
        const body = error.response.data;
        const firstError = Array.isArray(body.errors) && body.errors.length > 0 ? body.errors[0] : null;
        return {
            status: error.response.status,
            body,
            reasonCode: firstError?.code || body.code || body.errorCategory || body.errorCode || 'UNKNOWN',
            reasonMessage: firstError?.message || body.message || body.errorMessage || 'Unknown error from ZATCA'
        };
    }

    return {
        status: null,
        body: null,
        reasonCode: error.code || 'NETWORK_ERROR',
        reasonMessage: error.message || 'Network error while contacting ZATCA'
    };
}

export async function requestComplianceCSID(otp, csrPayload) {
    const response = await axios.post(
        ZATCA_COMPLIANCE_URL,
        { csr: csrPayload },
        {
            headers: {
                OTP: String(otp).trim(),
                'Accept-Version': 'V2',
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            timeout: 20000
        }
    );
    return response.data;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║ ZATCA Production Onboarding — Compliance CSID Request          ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    console.log(`🔗 Endpoint: ${ZATCA_COMPLIANCE_URL}`);

    const otp = process.env.ZATCA_OTP || process.argv[2];
    if (!otp || String(otp).trim().length < 4) {
        console.error('❌ OTP مطلوب: node src/tax/onboarding.js 123456');
        process.exit(1);
    }

    const certsDir = path.join(__dirname, '..', '..', 'certs');
    await fs.mkdir(certsDir, { recursive: true });

    try {
        ensureOpenSSL();
        const { privateKeyPem, csrPem, csrPayload, serialNumberPattern, commonName } =
            await generatePrivateKeyAndCsr();

        console.log('✅ CSR generated with required fields:');
        console.log(`   - commonName: ${commonName}`);
        console.log(`   - serialNumber pattern: ${serialNumberPattern}`);
        console.log(`   - organizationIdentifier: ${COMPANY.vatNumber}`);
        console.log(`   - organizationUnitName: ${COMPANY.organizationUnitName}`);
        console.log(`   - organizationName: ${COMPANY.organizationName}`);
        console.log('   - countryName: SA');

        console.log('\n🚀 Sending compliance request to ZATCA...');
        const data = await requestComplianceCSID(otp, csrPayload);

        const privateKeyPath = path.join(certsDir, 'private-key.pem');
        const csrPath = path.join(certsDir, 'taxpayer.csr');
        await fs.writeFile(privateKeyPath, privateKeyPem, 'utf8');
        await fs.writeFile(csrPath, csrPem, 'utf8');

        await fs.writeFile(
            path.join(certsDir, 'ccsid.json'),
            JSON.stringify(
                {
                    binarySecurityToken: data.binarySecurityToken,
                    secret: data.secret,
                    requestId: data.requestID || data.requestId || null,
                    dispositionMessage: data.dispositionMessage || null,
                    savedAt: new Date().toISOString()
                },
                null,
                2
            ),
            'utf8'
        );

        console.log('\n✅ Compliance CSID created successfully.');
        console.log(`📁 Private Key: ${privateKeyPath}`);
        console.log(`📁 CSR: ${csrPath}`);
        console.log(`📁 CSID: ${path.join(certsDir, 'ccsid.json')}`);
    } catch (error) {
        const details = extractZatcaErrorDetails(error);
        console.error('\n❌ Compliance request failed.');
        if (details.status) console.error(`HTTP Status: ${details.status}`);
        console.error(`Reason Code: ${details.reasonCode}`);
        console.error(`Reason Message: ${details.reasonMessage}`);
        if (details.body) {
            console.error('Response Body:');
            console.error(JSON.stringify(details.body, null, 2));
        }
        process.exitCode = 1;
    }
}

main();
