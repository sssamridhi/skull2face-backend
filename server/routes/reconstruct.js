const express        = require('express');
const router         = express.Router();
const multer         = require('multer');
const axios          = require('axios');
const fs             = require('fs');
const path           = require('path');
const auth           = require('../middleware/auth');
const Reconstruction = require('../models/Reconstruction');
const Log            = require('../models/Log');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, `skull_${Date.now()}_${file.fieldname}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).fields([
  { name: 'skull',      maxCount: 1 },
  { name: 'skull_side', maxCount: 1 }
]);

router.post('/upload', auth, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ msg: 'File upload error: ' + err.message });
    const frontalFile = req.files?.skull?.[0];
    const sideFile    = req.files?.skull_side?.[0];
    if (!frontalFile) return res.status(400).json({ msg: 'No frontal skull image uploaded' });
    const { description, caseId, gender, age, skinTone, hairColor } = req.body;
    try {
      const record = new Reconstruction({
        userId: req.user.id, skullImage: frontalFile.filename,
        description: description || '', caseId: caseId || '',
        traits: { gender, age, skinTone, hairColor }, status: 'processing'
      });
      await record.save();

      // Log case submission
      const username = (await require('../models/User').findById(req.user.id))?.username || 'Investigator';
      await Log.create({ action:'submit', username, detail:'New case submitted for reconstruction.', caseId: caseId || record._id.toString() });

      const sfBase64 = fs.readFileSync(frontalFile.path).toString('base64');
      const ssBase64 = sideFile ? fs.readFileSync(sideFile.path).toString('base64') : null;
      const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/reconstruct`, {
        record_id:  record._id.toString(),
        sf_image:   sfBase64,
        ss_image:   ssBase64,
        gender:     gender    || 'Auto Detect',
        age:        age       || 'Auto',
        hair_color: hairColor || 'Auto',
        skin_tone:  req.body.skinTone || 'Auto'
      }, { timeout: 600000 });
      const aiData = aiResponse.data;
      if (!aiData.success) throw new Error(aiData.error || 'AI service failed');
      const outputFilename = `face_${record._id}.png`;
      fs.writeFileSync(path.join('uploads', outputFilename), Buffer.from(aiData.face_b64, 'base64'));
      record.faceOutput = outputFilename;
      record.detectedGender = aiData.detected_gender;
      record.confidence = aiData.confidence;
      record.status = 'done';
      await record.save();

      // Log reconstruction complete
      await Log.create({ action:'complete', username, detail:'AI reconstruction completed successfully.', caseId: caseId || record._id.toString() });
      res.json({ msg: 'Reconstruction complete', record, face_b64: aiData.face_b64, detected_gender: aiData.detected_gender, confidence: aiData.confidence });
    } catch (err) {
      console.error('Reconstruction error:', err.message);
      res.status(500).json({ msg: 'Reconstruction failed: ' + err.message });
    }
  });
});

router.get('/history', auth, async (req, res) => {
  try {
    const records = await Reconstruction.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(records);
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

router.get('/download/:id', auth, async (req, res) => {
  try {
    const record = await Reconstruction.findOne({ _id: req.params.id, userId: req.user.id });
    if (!record || !record.faceOutput) return res.status(404).json({ msg: 'Not found' });
    res.download(path.join(__dirname, '../uploads', record.faceOutput));
  } catch { res.status(500).json({ msg: 'Server error' }); }
});

module.exports = router;