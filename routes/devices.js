const router = require('express').Router();
const Device = require('../models/Device');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const devices = await Device.find({ user: req.user._id });
    res.json({ devices });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const device = await Device.create({ ...req.body, user: req.user._id });
    res.status(201).json({ device });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body, { new: true }
    );
    if (!device) return res.status(404).json({ error: 'Not found' });
    res.json({ device });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Device.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
