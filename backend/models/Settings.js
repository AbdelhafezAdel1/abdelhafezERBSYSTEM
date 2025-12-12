const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SettingsSchema = new Schema({
    company_name_ar: String,
    company_name_en: String,
    vat_number: String,
    bank_account: String,
    address: String,
    phone: String,
    email: String,
    logo_path: String,
    stamp_path: String
});

module.exports = mongoose.model('Settings', SettingsSchema);
