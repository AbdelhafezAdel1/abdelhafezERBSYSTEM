const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BondSchema = new Schema({
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    type: { type: String, enum: ['Receipt', 'Payment'] },
    amount: Number,
    date: Date,
    notes: String
}, { timestamps: true });

module.exports = mongoose.model('Bond', BondSchema);
