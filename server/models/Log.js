const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  action:    { type: String, required: true }, // 'login', 'submit', 'complete', 'register', 'delete', 'reset'
  username:  { type: String, required: true },
  detail:    { type: String, default: '' },
  caseId:    { type: String, default: '—' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', LogSchema);