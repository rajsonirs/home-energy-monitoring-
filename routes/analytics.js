const router = require('express').Router();
const EnergyReading = require('../models/EnergyReading');
const authMiddleware = require('../middleware/auth');

// GET /api/analytics/daily — daily totals for last 30 days
router.get('/daily', authMiddleware, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data = await EnergyReading.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          totalWatts: { $sum: '$watts' },
          avgWatts: { $avg: '$watts' },
          maxWatts: { $max: '$watts' },
          totalSolar: { $sum: '$solarGeneration' },
          totalGrid: { $sum: '$gridConsumption' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/peak — peak consumption hours
router.get('/peak', authMiddleware, async (req, res) => {
  try {
    const data = await EnergyReading.aggregate([
      {
        $group: {
          _id: { hour: { $hour: '$timestamp' } },
          avgWatts: { $avg: '$watts' },
          maxWatts: { $max: '$watts' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/sources — solar vs grid breakdown
router.get('/sources', authMiddleware, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data = await EnergyReading.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$source',
          totalWatts: { $sum: '$watts' },
          avgWatts: { $avg: '$watts' },
          count: { $sum: 1 }
        }
      }
    ]);
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/prediction — moving average next-day forecast
router.get('/prediction', authMiddleware, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyData = await EnergyReading.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dayOfMonth: '$timestamp' },
          avgWatts: { $avg: '$watts' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // 7-day simple moving average
    const values = dailyData.map(d => d.avgWatts);
    const prediction = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;

    // Hourly breakdown prediction based on peak data
    const hourlyPeak = await EnergyReading.aggregate([
      {
        $group: {
          _id: { $hour: '$timestamp' },
          avgWatts: { $avg: '$watts' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      prediction: Math.round(prediction),
      dailyData,
      hourlyBreakdown: hourlyPeak,
      basedOnDays: values.length
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/summary — dashboard summary stats
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [todayStats, weekStats, latest] = await Promise.all([
      EnergyReading.aggregate([
        { $match: { timestamp: { $gte: oneDayAgo } } },
        { $group: { _id: null, avg: { $avg: '$watts' }, max: { $max: '$watts' }, total: { $sum: '$watts' } } }
      ]),
      EnergyReading.aggregate([
        { $match: { timestamp: { $gte: oneWeekAgo } } },
        { $group: { _id: null, avg: { $avg: '$watts' }, total: { $sum: '$watts' } } }
      ]),
      EnergyReading.findOne().sort({ timestamp: -1 })
    ]);

    res.json({
      today: todayStats[0] || { avg: 0, max: 0, total: 0 },
      week: weekStats[0] || { avg: 0, total: 0 },
      latest: latest || null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
