import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  domain: { type: String, required: true },
  language: { type: String, required: true },
  topic: String,
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: { type: Date, required: true },
  durationMin: { type: Number, default: 60 },
  batch: String,
  starterCode: { type: String, default: '' },
  status: { type: String, enum: ['SCHEDULED', 'LIVE', 'ENDED'], default: 'SCHEDULED' },
  startedAt: Date,
  endedAt: Date,
}, { timestamps: true });
export const ClassSession = mongoose.model('ClassSession', schema);
