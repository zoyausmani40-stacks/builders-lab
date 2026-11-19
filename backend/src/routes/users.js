import { Router } from 'express';
import User from '../models/User.js';
import { protect, allow } from '../middleware/auth.js';
const router = Router();

// Active workers are available to officers and admins for complaint assignment.
router.get('/workers', protect, allow('officer', 'admin'), async (_req, res, next) => {
  try {
    res.json(await User.find({ role: 'worker', active: true }).select('name email department active createdAt').sort({ name: 1 }));
  } catch (e) { next(e); }
});

// Worker administration is restricted to admins.
router.get('/workers/manage', protect, allow('admin'), async (_req, res, next) => {
  try {
    res.json(await User.find({ role: 'worker' }).select('-password').sort({ createdAt: -1 }));
  } catch (e) { next(e); }
});

router.post('/workers', protect, allow('admin'), async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const department = String(req.body.department || 'General').trim();
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and temporary password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'This email is already registered.' });
    const worker = await User.create({ name, email, password, department: department || 'General', role: 'worker', active: true });
    res.status(201).json({ _id: worker._id, name: worker.name, email: worker.email, department: worker.department, role: worker.role, active: worker.active, createdAt: worker.createdAt });
  } catch (e) { next(e); }
});

router.patch('/workers/:id', protect, allow('admin'), async (req, res, next) => {
  try {
    const worker = await User.findOne({ _id: req.params.id, role: 'worker' });
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ message: 'Worker name cannot be empty.' });
      worker.name = name;
    }
    if (req.body.department !== undefined) worker.department = String(req.body.department).trim() || 'General';
    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
      const duplicate = await User.findOne({ email, _id: { $ne: worker._id } });
      if (duplicate) return res.status(409).json({ message: 'This email is already registered.' });
      worker.email = email;
    }
    if (req.body.password !== undefined && req.body.password !== '') {
      if (String(req.body.password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      worker.password = String(req.body.password);
    }
    if (req.body.active !== undefined) worker.active = Boolean(req.body.active);
    await worker.save();
    res.json({ _id: worker._id, name: worker.name, email: worker.email, department: worker.department, role: worker.role, active: worker.active, createdAt: worker.createdAt });
  } catch (e) { next(e); }
});


// Officer administration is restricted to admins.
router.get('/officers/manage', protect, allow('admin'), async (_req, res, next) => {
  try {
    res.json(await User.find({ role: 'officer' }).select('-password').sort({ createdAt: -1 }));
  } catch (e) { next(e); }
});

router.post('/officers', protect, allow('admin'), async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const department = String(req.body.department || 'General').trim() || 'General';
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and temporary password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'This email is already registered.' });
    const officer = await User.create({ name, email, password, department, role: 'officer', active: true });
    res.status(201).json({ _id: officer._id, name: officer.name, email: officer.email, department: officer.department, role: officer.role, active: officer.active, createdAt: officer.createdAt });
  } catch (e) { next(e); }
});

router.patch('/officers/:id', protect, allow('admin'), async (req, res, next) => {
  try {
    const officer = await User.findOne({ _id: req.params.id, role: 'officer' });
    if (!officer) return res.status(404).json({ message: 'Officer not found.' });
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ message: 'Officer name cannot be empty.' });
      officer.name = name;
    }
    if (req.body.department !== undefined) officer.department = String(req.body.department).trim() || 'General';
    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
      const duplicate = await User.findOne({ email, _id: { $ne: officer._id } });
      if (duplicate) return res.status(409).json({ message: 'This email is already registered.' });
      officer.email = email;
    }
    if (req.body.password !== undefined && req.body.password !== '') {
      if (String(req.body.password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      officer.password = String(req.body.password);
    }
    if (req.body.active !== undefined) officer.active = Boolean(req.body.active);
    await officer.save();
    res.json({ _id: officer._id, name: officer.name, email: officer.email, department: officer.department, role: officer.role, active: officer.active, createdAt: officer.createdAt });
  } catch (e) { next(e); }
});

// Keep the existing admin-only user listing endpoint.
router.get('/', protect, allow('admin'), async (_req, res, next) => {
  try { res.json(await User.find().select('-password').sort({ createdAt: -1 })); }
  catch (e) { next(e); }
});
export default router;
