const db = require('./db.js');
async function run() {
  const res = await db.query("SELECT id, total_after_tax, zatca_response FROM invoices WHERE zatca_status = 'REPORTED' ORDER BY id DESC LIMIT 1");
  const inv = res.rows[0];
  if(inv && inv.zatca_response) {
      console.log('Invoice ID:', inv.id);
      console.log('Total After Tax in DB:', inv.total_after_tax);
      console.log('ZATCA Reporting Status:', inv.zatca_response.status);
      console.log('Clearance/Reporting Result:', JSON.stringify(inv.zatca_response.rawResponse?.validationResults || {}, null, 2));
      
      // The payload sent to ZATCA isn't explicitly saved inside zatca_response, 
      // but we can look at what values are in there.
  }
  process.exit(0);
}
run();
