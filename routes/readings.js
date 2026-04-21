const router = require('express').Router();
const EnergyReading = require('../models/EnergyReading');
const Alert = require('../models/Alert');
const authMiddleware = require('../middleware/auth');

// GET /api/readings — last 100 readings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 100, source, from, to } = req.query;
    const filter = {};
    if (source) filter.source = source;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }
    const readings = await EnergyReading.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit));
    res.json({ readings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/readings/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const reading = await EnergyReading.findById(req.params.id);
    if (!reading) return res.status(404).json({ error: 'Not found' });
    res.json({ reading });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/readings — add new reading + check alert thresholds
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { watts, source, batteryLevel, solarGeneration, gridConsumption } = req.body;
    const reading = await EnergyReading.create({
      watts, source, batteryLevel, solarGeneration, gridConsumption
    });

    // Check thresholds and create alerts
    const user = req.user;
    const io = req.app.get('io');
    const alerts = [];

    if (watts > user.alertThresholds.maxWatts) {
      const alert = await Alert.create({
        user: user._id, type: 'high_usage', severity: 'critical',
        message: `High usage detected: ${Math.round(watts)}W exceeds your ${user.alertThresholds.maxWatts}W limit`,
        threshold: user.alertThresholds.maxWatts, actualValue: watts
      });
      alerts.push(alert);
      if (io) io.emit('new-alert', alert);
    }

    if (batteryLevel !== undefined && batteryLevel < user.alertThresholds.minBattery) {
      const alert = await Alert.create({
        user: user._id, type: 'low_battery', severity: 'warning',
        message: `Battery low: ${batteryLevel}% is below your ${user.alertThresholds.minBattery}% threshold`,
        threshold: user.alertThresholds.minBattery, actualValue: batteryLevel
      });
      alerts.push(alert);
      if (io) io.emit('new-alert', alert);
    }

    if (io) io.emit('new-reading', reading);
    res.status(201).json({ reading, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/readings/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await EnergyReading.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
