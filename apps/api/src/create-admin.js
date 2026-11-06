// Creates a super administrator without touching any other data. Safe to run on a live database.
import './config/env.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from './config/db.js';
import { User } from './models/User.js';

const [, , emailArg, passwordArg, ...nameParts] = process.argv;
const email = (emailArg || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = passwordArg || process.env.ADMIN_PASSWORD || '';
const name = nameParts.join(' ') || process.env.ADMIN_NAME || 'Super Admin';

if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
  console.error('Usage: npm run create-admin -w @gateway/api -- you@company.com "a strong password" "Your Name"\nThe password needs at least 8 characters.');
  process.exit(1);
}
await connectDb();
if (await User.exists({ email })) console.log(`A user with the email ${email} already exists. Nothing was changed.`);
else { await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN' }); console.log(`Super administrator created: ${email}`); }
await mongoose.disconnect();
