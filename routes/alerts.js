const router = require('express').Router();
const Alert = require('../models/Alert');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const alerts = await Alert.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ alerts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true }, { new: true }
    );
    res.json({ alert });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/clear', authMiddleware, async (req, res) => {
  try {
    await Alert.deleteMany({ user: req.user._id, isRead: true });
    res.json({ message: 'Cleared read alerts' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
