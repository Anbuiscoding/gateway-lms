import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  type: { type: String, enum: ['SICK', 'CASUAL', 'OTHER'], default: 'CASUAL' },
  reason: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  decisionNote: String,
}, { timestamps: true });
export const Leave = mongoose.model('Leave', schema);
