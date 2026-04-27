const db = require('./db.js');
async function run() {
  try { await db.query("ALTER TABLE invoices ADD COLUMN zatca_status VARCHAR(20) DEFAULT 'pending'"); } catch(e){}
  try { await db.query("ALTER TABLE invoices ADD COLUMN zatca_reported_at TIMESTAMP"); } catch(e){}
  try { await db.query("ALTER TABLE invoices ADD COLUMN zatca_uuid VARCHAR(255)"); } catch(e){}
  try { await db.query("ALTER TABLE invoices ADD COLUMN zatca_response JSONB"); } catch(e){}
  console.log("Columns ensured.");
  process.exit(0);
}
run();
