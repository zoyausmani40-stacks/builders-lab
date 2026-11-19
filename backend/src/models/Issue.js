import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  status: String, message: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now }
}, { _id: false });

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 3000 },
  category: { type: String, enum: ['Roads','Sanitation','Streetlight','Water Supply','Drainage','Public Safety','Other'], required: true },
  priority: { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  status: { type: String, enum: ['submitted','under_review','assigned','in_progress','resolved','rejected'], default: 'submitted' },
  address: { type: String, default: '' },
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [77.6737, 27.4924] } },
  photo: { type: String, default: '' },
  resolutionPhoto: { type: String, default: '' },
  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  department: { type: String, default: 'General' },
  resolutionNote: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  feedback: { rating: { type: Number, min: 1, max: 5, default: null }, review: { type: String, maxlength: 1000, default: '' }, submittedAt: { type: Date, default: null } },
  timeline: [eventSchema]
}, { timestamps: true });

issueSchema.index({ location: '2dsphere' });
issueSchema.index({ status: 1, priority: 1, createdAt: -1 });
export default mongoose.model('Issue', issueSchema);
