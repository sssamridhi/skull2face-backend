const express        = require('express');
const router         = express.Router();
const auth           = require('../middleware/auth');
const User           = require('../models/User');
const Reconstruction = require('../models/Reconstruction');
const Log            = require('../models/Log');

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Admin access required' });
  next();
}

// GET /api/admin/cases
router.get('/cases', auth, adminOnly, async (req, res) => {
  try {
    const cases = await Reconstruction.find()
      .populate('userId', 'username role')
      .sort({ createdAt: -1 });
    res.json(cases);
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

// DELETE /api/admin/cases/:id
router.delete('/cases/:id', auth, adminOnly, async (req, res) => {
  try {
    const c = await Reconstruction.findById(req.params.id);
    await Reconstruction.findByIdAndDelete(req.params.id);
    await Log.create({ action:'delete', username: req.user.username || 'Admin', detail:'Case deleted by admin.', caseId: c?.caseId || '—' });
    res.json({ msg: 'Case deleted' });
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

// DELETE /api/admin/reset
router.delete('/reset', auth, adminOnly, async (req, res) => {
  try {
    await Reconstruction.deleteMany({});
    await Log.create({ action:'reset', username: req.user.username || 'Admin', detail:'All cases reset by admin.', caseId:'—' });
    res.json({ msg: 'All cases deleted' });
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

// GET /api/admin/users
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

// PATCH /api/admin/users/:id/toggle
router.patch('/users/:id/toggle', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    user.active = !user.active;
    await user.save();
    await Log.create({ action: user.active ? 'activate' : 'deactivate', username: req.user.username || 'Admin', detail:`Investigator ${user.username} marked as ${user.active ? 'active' : 'inactive'}.`, caseId:'—' });
    res.json({ msg: 'Status updated', active: user.active });
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

// GET /api/admin/logs
router.get('/logs', auth, adminOnly, async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 }).limit(50);
    res.json(logs);
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

// GET /api/admin/stats
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const total       = await Reconstruction.countDocuments();
    const completed   = await Reconstruction.countDocuments({ status: 'done' });
    const pending     = await Reconstruction.countDocuments({ status: 'pending' });
    const active      = await Reconstruction.countDocuments({ status: { $in: ['processing','active'] } });
    const investigators = await User.countDocuments({ role: 'investigator' });
    const todayStart  = new Date(); todayStart.setHours(0,0,0,0);
    const todayCount  = await Reconstruction.countDocuments({ createdAt: { $gte: todayStart } });

    // Monthly data for chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthly = await Reconstruction.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' }, status: '$status' },
        count: { $sum: 1 }
      }}
    ]);

    res.json({ total, completed, pending, active, investigators, todayCount, monthly });
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

module.exports = router;