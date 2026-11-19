import { Router } from 'express';
import Issue from '../models/Issue.js';
import { protect, allow } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { canViewIssue } from '../utils/issueAccess.js';
import { createNotification } from '../advancedFeatures.js';

const router = Router();
const populate = [{ path: 'citizen', select: 'name email' }, { path: 'assignedTo', select: 'name email department' }, { path: 'timeline.by', select: 'name role' }];
const emitIssue = (req, issue) => req.app.get('io')?.emit('issue:updated', { issueId: String(issue._id), status: issue.status });

router.use(protect);

router.post('/', upload.single('photo'), async (req, res, next) => {
  try {
    const { title, description, category, address, latitude, longitude } = req.body;
    if (!title || !description || !category) return res.status(400).json({ message: 'Title, description and category are required' });
    const lat = Number(latitude), lng = Number(longitude);
    const coordinates = Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : [77.6737, 27.4924];
    const issue = await Issue.create({
      title, description, category, address: address || '',
      location: { type: 'Point', coordinates },
      photo: req.file ? `/uploads/${req.file.filename}` : '',
      citizen: req.user._id, department: category,
      timeline: [{ status: 'submitted', message: 'Complaint submitted by citizen', by: req.user._id }]
    });
    const full = await Issue.findById(issue._id).populate(populate);
    emitIssue(req, full);
    await createNotification(req.app.get('io'), req.user._id, 'Complaint submitted', `Your complaint “${full.title}” was submitted successfully.`, full._id);
    res.status(201).json(full);
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'citizen') filter.citizen = req.user._id;
    if (req.user.role === 'worker') filter.assignedTo = req.user._id;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const issues = await Issue.find(filter).populate(populate).sort({ createdAt: -1 });
    res.json(issues);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id).populate(populate);
    if (!issue) return res.status(404).json({ message: 'Complaint not found' });
    if (!canViewIssue(issue, req.user)) return res.status(403).json({ message: 'Access denied' });
    res.json(issue);
  } catch (e) { next(e); }
});

router.patch('/:id/review', allow('officer','admin'), async (req, res, next) => {
  try {
    const { priority, decision, note } = req.body;
    const update = {};
    if (priority && ['low','medium','high','critical'].includes(priority)) update.priority = priority;
    if (decision === 'reject') update.status = 'rejected';
    else if (decision === 'verify') update.status = 'under_review';
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Complaint not found' });
    Object.assign(issue, update);
    issue.timeline.push({ status: issue.status, message: note || (decision === 'reject' ? 'Complaint rejected after review' : 'Complaint reviewed by officer'), by: req.user._id });
    await issue.save();
    const full = await Issue.findById(issue._id).populate(populate); emitIssue(req, full); await createNotification(req.app.get('io'), issue.citizen, 'Complaint reviewed', `Your complaint “${issue.title}” was reviewed.`, issue._id); res.json(full);
  } catch (e) { next(e); }
});

router.patch('/:id/assign', allow('officer','admin'), async (req, res, next) => {
  try {
    const { workerId, department } = req.body;
    const User = (await import('../models/User.js')).default;
    const worker = await User.findOne({ _id: workerId, role: 'worker', active: true });
    if (!worker) return res.status(400).json({ message: 'Select a valid active field worker' });
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Complaint not found' });
    if (issue.status === 'resolved' || issue.status === 'rejected') return res.status(400).json({ message: 'Closed complaints cannot be assigned' });
    issue.assignedTo = worker._id; issue.department = department || worker.department; issue.status = 'assigned';
    issue.timeline.push({ status: 'assigned', message: `Assigned to ${worker.name}`, by: req.user._id });
    await issue.save();
    const full = await Issue.findById(issue._id).populate(populate); emitIssue(req, full); await createNotification(req.app.get('io'), worker._id, 'New complaint assigned', `You have been assigned “${issue.title}”.`, issue._id); await createNotification(req.app.get('io'), issue.citizen, 'Worker assigned', `A field worker has been assigned to “${issue.title}”.`, issue._id); res.json(full);
  } catch (e) { next(e); }
});

router.patch('/:id/status', upload.single('resolutionPhoto'), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!['in_progress','resolved'].includes(status)) return res.status(400).json({ message: 'Allowed status values: in_progress, resolved' });
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Complaint not found' });
    const isManager = ['officer','admin'].includes(req.user.role);
    if (!isManager && (req.user.role !== 'worker' || String(issue.assignedTo) !== String(req.user._id))) return res.status(403).json({ message: 'Only the assigned worker or an officer can update this complaint' });
    if (!issue.assignedTo && !isManager) return res.status(400).json({ message: 'Complaint must be assigned first' });
    issue.status = status; issue.resolutionNote = note || issue.resolutionNote;
    if (status === 'resolved' && !issue.resolvedAt) issue.resolvedAt = new Date();
    if (req.file) issue.resolutionPhoto = `/uploads/${req.file.filename}`;
    issue.timeline.push({ status, message: note || (status === 'resolved' ? 'Work marked as resolved' : 'Field work started'), by: req.user._id });
    await issue.save();
    const full = await Issue.findById(issue._id).populate(populate); emitIssue(req, full); await createNotification(req.app.get('io'), issue.citizen, status === 'resolved' ? 'Complaint resolved' : 'Work started', status === 'resolved' ? `Your complaint “${issue.title}” has been marked resolved. Please leave feedback.` : `Work has started on “${issue.title}”.`, issue._id); res.json(full);
  } catch (e) { next(e); }
});

export default router;
