const mongoose = require('mongoose');

const energyReadingSchema = new mongoose.Schema({
  watts: { type: Number, required: true },
  source: { type: String, enum: ['solar', 'grid', 'battery'], default: 'grid' },
  batteryLevel: { type: Number, min: 0, max: 100, default: 100 },
  solarGeneration: { type: Number, default: 0 },
  gridConsumption: { type: Number, default: 0 },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false });

// Compound index for time-series queries
energyReadingSchema.index({ timestamp: -1, source: 1 });

module.exports = mongoose.model('EnergyReading', energyReadingSchema);
