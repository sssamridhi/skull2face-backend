const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

// GET /api/user/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch {
    res.status(500).json({ msg: 'Server error' });
  }
});

// PUT /api/user/profile — save profile changes
router.put('/profile', auth, async (req, res) => {
  const { fullName, department, email, phone, avatar } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (fullName   !== undefined) user.fullName   = fullName;
    if (department !== undefined) user.department = department;
    if (email      !== undefined) user.email      = email;
    if (phone      !== undefined) user.phone      = phone;
    if (avatar     !== undefined) user.avatar     = avatar;

    await user.save();
    res.json({ msg: 'Profile updated', user: { fullName: user.fullName, department: user.department, email: user.email, phone: user.phone, avatar: user.avatar } });
  } catch {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;