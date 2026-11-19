import { Router } from 'express';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { protect, allow } from '../middleware/auth.js';
const router = Router();
router.get('/stats', protect, allow('officer','admin'), async (_req, res, next) => {
  try {
    const [total, users, statusRows, categoryRows, recent] = await Promise.all([
      Issue.countDocuments(), User.countDocuments(),
      Issue.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Issue.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Issue.find().populate('citizen','name').populate('assignedTo','name').sort({ createdAt: -1 }).limit(6)
    ]);
    const byStatus = Object.fromEntries(statusRows.map(x => [x._id, x.count]));
    res.json({ total, users, resolved: byStatus.resolved || 0, open: total - (byStatus.resolved || 0) - (byStatus.rejected || 0), byStatus, byCategory: categoryRows, recent });
  } catch (e) { next(e); }
});
export default router;
