const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['high_usage', 'low_battery', 'outage', 'custom'], required: true },
  message: { type: String, required: true },
  threshold: { type: Number },
  actualValue: { type: Number },
  isRead: { type: Boolean, default: false },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' }
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
