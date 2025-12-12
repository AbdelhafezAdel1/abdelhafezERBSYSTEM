const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InvoiceItemSchema = new Schema({
    description: String,
    category: String,
    quantity: Number,
    unit_price: Number,
    line_total: Number,
    taxable: { type: Boolean, default: true }
});

const InvoiceSchema = new Schema({
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    date: Date,
    customs_office: String,
    shipment_type: String,
    notes: String,
    status: { type: String, default: 'Draft' },
    qr_code: String,
    total_before_tax: Number,
    clearance_fee: Number,
    vat_amount: Number,
    total_after_tax: Number,
    items: [InvoiceItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
