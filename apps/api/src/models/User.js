import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true }, role: { type: String, enum: ['SUPER_ADMIN','ADMIN','TRAINER','STUDENT','PLACEMENT_OFFICER','SUPPORT'], default: 'STUDENT' },
  studentId: String, program: String, batch: String, phone: String, avatar: String, active: { type: Boolean, default: true }
}, { timestamps: true });
export const User = mongoose.model('User', userSchema);
