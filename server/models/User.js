const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username:   { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['admin', 'investigator'], default: 'investigator' },
  active:     { type: Boolean, default: true },
  createdAt:  { type: Date, default: Date.now },

  // Profile fields
  fullName:   { type: String, default: '' },
  department: { type: String, default: 'Forensic Division' },
  email:      { type: String, default: '' },
  phone:      { type: String, default: '' },
  avatar:     { type: String, default: '' }  // base64 or URL
});

module.exports = mongoose.model('User', UserSchema);