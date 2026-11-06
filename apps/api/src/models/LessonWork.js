import mongoose from 'mongoose';
// A student's own saved code (and video position) for one lesson.
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, required: true },
  code: { type: String, default: '' },
  language: String,
  position: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ student: 1, lesson: 1 }, { unique: true });
export const LessonWork = mongoose.model('LessonWork', schema);
