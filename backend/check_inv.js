const db = require('./db.js');
async function run() {
  const invRes = await db.query("SELECT * FROM invoices WHERE id IN (285, 286) ORDER BY id");
  const invoices = invRes.rows;
  
  for(let invoice of invoices) {
      const itemsRes = await db.query("SELECT * FROM invoice_items WHERE invoice_id = $1", [invoice.id]);
      const items = itemsRes.rows;
      console.log(`=== فاتورة رقم #${invoice.id} ===`);
      console.log("الإجمالي:", invoice.total_after_tax);
      console.log("الأصناف:", items.map(i => `${i.description} - السعر: ${i.unit_price}`));
      console.log("-----------------------");
  }
  process.exit(0);
}
run();
