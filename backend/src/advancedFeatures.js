import { Router } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Issue from './models/Issue.js';
import User from './models/User.js';
import { protect, allow } from './middleware/auth.js';

const router = Router();
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
  read: { type: Boolean, default: false },
}, { timestamps: true });
const Notification = mongoose.models.CivicNotification || mongoose.model('CivicNotification', notificationSchema);

export async function createNotification(io, userId, title, message, issueId = null) {
  if (!userId) return;
  const notification = await Notification.create({ user: userId, title, message, issue: issueId });
  io?.to(`user:${String(userId)}`).emit('notification:new', notification);
}

function tokenize(value = '') {
  return [...new Set(String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(x => x.length > 2))];
}
function similarity(a, b) {
  const aa = tokenize(a), bb = tokenize(b);
  if (!aa.length || !bb.length) return 0;
  const set = new Set(aa), intersection = bb.filter(x => set.has(x)).length;
  return intersection / new Set([...aa, ...bb]).size;
}

// A deterministic, transparent suggestion engine; no external AI service or API key is required.
router.post('/ai/suggest', protect, (req, res) => {
  const description = String(req.body.description || '').trim();
  if (description.length < 8) return res.status(400).json({ message: 'Please enter at least 8 characters of description.' });
  const text = description.toLowerCase();
  const rules = [
    { words: ['pothole','road','street','asphalt','crack'], category: 'Roads' },
    { words: ['garbage','trash','waste','dustbin','rubbish'], category: 'Sanitation' },
    { words: ['streetlight','street light','lamp','light pole','dark road'], category: 'Streetlight' },
    { words: ['water','leak','pipe','supply','tap'], category: 'Water Supply' },
    { words: ['drain','sewer','waterlogging','flood','blocked'], category: 'Drainage' },
    { words: ['unsafe','crime','theft','danger','harassment'], category: 'Public Safety' },
  ];
  const match = rules.find(r => r.words.some(w => text.includes(w)));
  const urgency = ['accident','injury','danger','exposed wire','open manhole','electrocution','fire','collapse'].some(w => text.includes(w))
    ? 'critical' : ['overflow','major','severe','blocked','no water','outage','deep pothole'].some(w => text.includes(w))
      ? 'high' : ['minor','small','occasionally'].some(w => text.includes(w)) ? 'low' : 'medium';
  const title = description.split(/[.!?\n]/)[0].trim().slice(0, 100);
  res.json({ category: match?.category || 'Other', priority: urgency, title, confidence: match ? 'keyword match' : 'general suggestion', note: 'Suggestions are automated and should be reviewed before submission.' });
});

router.get('/heatmap', protect, allow('officer','admin'), async (_req, res, next) => {
  try {
    const rows = await Issue.find({ status: { $ne: 'rejected' } }).select('location status priority').lean();
    const points = rows.filter(x => x.location?.coordinates?.length === 2).map(x => ({
      lat: x.location.coordinates[1], lng: x.location.coordinates[0],
      intensity: x.priority === 'critical' ? 1 : x.priority === 'high' ? .8 : x.priority === 'medium' ? .55 : .3,
      status: x.status
    }));
    res.json(points);
  } catch (e) { next(e); }
});

router.get('/notifications', protect, async (req, res, next) => {
  try {
    const items = await Notification.find({ user: req.user._id }).populate('issue', 'title status').sort({ createdAt: -1 }).limit(50);
    res.json(items);
  } catch (e) { next(e); }
});
router.patch('/notifications/:id/read', protect, async (req, res, next) => {
  try {
    const item = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
    if (!item) return res.status(404).json({ message: 'Notification not found' });
    res.json(item);
  } catch (e) { next(e); }
});
router.patch('/notifications/read-all', protect, async (req, res, next) => {
  try { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ message: 'All notifications marked as read' }); }
  catch (e) { next(e); }
});

router.post('/duplicates/check', protect, async (req, res, next) => {
  try {
    const { description = '', latitude, longitude, excludeId } = req.body;
    const lat = Number(latitude), lng = Number(longitude);
    if (String(description).trim().length < 8 || !Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ message: 'Description and valid map coordinates are required.' });
    const nearby = await Issue.find({
      ...(excludeId && mongoose.isValidObjectId(excludeId) ? { _id: { $ne: excludeId } } : {}),
      status: { $nin: ['rejected'] },
      location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: 500 } }
    }).select('title description category status address location createdAt').limit(20).lean();
    const matches = nearby.map(item => ({ ...item, similarity: similarity(description, item.description) }))
      .filter(x => x.similarity >= .22).sort((a,b) => b.similarity - a.similarity).slice(0,5);
    res.json({ possibleDuplicate: matches.length > 0, matches });
  } catch (e) { next(e); }
});

router.get('/workers/performance', protect, allow('officer','admin'), async (_req, res, next) => {
  try {
    const workers = await User.find({ role: 'worker', active: true }).select('name email department').lean();
    const metrics = await Promise.all(workers.map(async worker => {
      const rows = await Issue.find({ assignedTo: worker._id }).select('status createdAt resolvedAt').lean();
      const completed = rows.filter(x => x.status === 'resolved');
      const durations = completed.filter(x => x.resolvedAt).map(x => (new Date(x.resolvedAt) - new Date(x.createdAt)) / 3600000).filter(Number.isFinite);
      return { _id: worker._id, name: worker.name, department: worker.department, total: rows.length, completed: completed.length, pending: rows.filter(x => !['resolved','rejected'].includes(x.status)).length, averageResolutionHours: durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length*10)/10 : null };
    }));
    res.json(metrics);
  } catch (e) { next(e); }
});

router.post('/issues/:id/feedback', protect, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating), review = String(req.body.review || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Complaint not found' });
    if (String(issue.citizen) !== String(req.user._id)) return res.status(403).json({ message: 'Only the reporting citizen can submit feedback.' });
    if (issue.status !== 'resolved') return res.status(400).json({ message: 'Feedback is available after the complaint is resolved.' });
    if (issue.feedback?.rating) return res.status(409).json({ message: 'Feedback has already been submitted.' });
    issue.feedback = { rating, review, submittedAt: new Date() };
    await issue.save();
    res.status(201).json({ message: 'Thank you for your feedback.', feedback: issue.feedback });
  } catch (e) { next(e); }
});

export default router;
