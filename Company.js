const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CompanySchema = new Schema({
    name: { type: String, required: true },
    vat_number: String,
    contact_person: String,
    phone: String,
    address: String,
    bank_account: String
});

module.exports = mongoose.model('Company', CompanySchema);
