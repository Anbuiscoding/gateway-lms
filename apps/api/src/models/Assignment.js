import mongoose from 'mongoose';
const assignment = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  instructions: { type: String, default: '' },
  batch: { type: String, default: '' }, // empty = every student
  dueAt: { type: Date, required: true },
  maxMarks: { type: Number, default: 100 },
  allowLate: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
export const Assignment = mongoose.model('Assignment', assignment);

const submission = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answer: { type: String, default: '' },
  link: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  late: { type: Boolean, default: false },
  status: { type: String, enum: ['SUBMITTED', 'GRADED'], default: 'SUBMITTED' },
  marks: Number,
  feedback: { type: String, default: '' },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gradedAt: Date,
}, { timestamps: true });
submission.index({ assignment: 1, student: 1 }, { unique: true });
export const Submission = mongoose.model('Submission', submission);
