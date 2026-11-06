import mongoose from 'mongoose';
// kind DAY: office or school day check-in. kind CLASS: joined a live class (session is set).
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  kind: { type: String, enum: ['DAY', 'CLASS'], default: 'DAY' },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSession' },
  status: { type: String, enum: ['PRESENT', 'LATE', 'ABSENT', 'LEAVE'], default: 'PRESENT' },
  checkIn: Date,
  checkOut: Date,
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: String,
}, { timestamps: true });
schema.index({ user: 1, date: 1, kind: 1, session: 1 }, { unique: true });
export const Attendance = mongoose.model('Attendance', schema);
