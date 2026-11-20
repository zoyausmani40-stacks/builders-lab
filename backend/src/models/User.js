import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['citizen', 'officer', 'worker', 'admin'], default: 'citizen' },
  department: { type: String, default: 'General' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function(candidate) { return bcrypt.compare(candidate, this.password); };
export default mongoose.model('User', userSchema);
