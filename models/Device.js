const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['solar_panel', 'battery', 'appliance', 'meter'], required: true },
  location: { type: String, default: 'Home' },
  isActive: { type: Boolean, default: true },
  ratedWatts: { type: Number, default: 0 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
