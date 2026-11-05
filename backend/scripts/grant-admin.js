// Local operator command only; never exposed through an HTTP endpoint.
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { auth } from '../config/firebase.js';
import { connectDB } from '../config/db.js';
import User from '../features/auth/models/User.js';
import { auditedChange } from '../features/admin/audit.service.js';
import { grantAdmin } from '../features/admin/bootstrap.js';

try {
  const { values } = parseArgs({
    options: { uid: { type: 'string' }, operator: { type: 'string' } },
    allowPositionals: false,
  });
  if (!values.uid || !values.operator)
    throw Error('Usage: pnpm grant-admin --uid FIREBASE_UID --operator "Your name"');
  await connectDB();
  await grantAdmin(values, { auth, User, auditedChange });
  console.log('Admin granted to the specified Firebase UID; audit entry recorded.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
