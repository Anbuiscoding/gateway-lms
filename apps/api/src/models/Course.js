import mongoose from 'mongoose';
const chapterSchema = new mongoose.Schema({ at: Number, title: String }, { _id: false });
const lessonSchema = new mongoose.Schema({ title: String, type: { type: String, enum: ['VIDEO','TEXT','QUIZ','ASSIGNMENT','LAB'], default: 'VIDEO' }, duration: Number, content: String, videoUrl: { type: String, default: '' }, language: { type: String, default: 'javascript' }, starterCode: { type: String, default: '' }, notes: { type: String, default: '' }, chapters: [chapterSchema] }, { _id: true });
const moduleSchema = new mongoose.Schema({ title: String, order: Number, lessons: [lessonSchema] }, { _id: true });
const courseSchema = new mongoose.Schema({ title: { type: String, required: true }, slug: { type: String, unique: true }, description: String, level: String, durationHours: Number, trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: { type: String, enum: ['DRAFT','PUBLISHED','ARCHIVED'], default: 'DRAFT' }, modules: [moduleSchema], tags: [String], source: { provider: String, url: String, retrievedAt: Date } }, { timestamps: true });
export const Course = mongoose.model('Course', courseSchema);
