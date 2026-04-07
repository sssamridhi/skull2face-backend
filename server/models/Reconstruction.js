const mongoose = require('mongoose');

const ReconstructionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  skullImage:  { type: String, required: true },
  faceOutput:  { type: String },
  description: { type: String, default: '' },
  caseId:      { type: String, default: '' },
  traits: {
    gender:   { type: String },
    age:      { type: String },
    skinTone: { type: String },
    hairColor:{ type: String }
  },
  status:      { type: String, enum: ['pending','processing','done','failed'], default: 'pending' },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Reconstruction', ReconstructionSchema);