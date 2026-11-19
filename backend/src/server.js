import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import issueRoutes from './routes/issues.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';
import advancedFeatureRoutes from './advancedFeatures.js';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET','POST','PATCH'] } });
app.set('io', io);
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id active');
    if (!user || !user.active) return next(new Error('Unauthorized'));
    socket.data.userId = String(user._id);
    next();
  } catch { next(new Error('Unauthorized')); }
});
io.on('connection', socket => {
  socket.join(`user:${socket.data.userId}`);
});
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes);
app.use('/uploads', express.static(path.resolve('uploads')));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'CivicGrid API' }));
app.use('/api/issues', issueRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/advanced', advancedFeatureRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});
const port = process.env.PORT || 5000;
connectDB().then(() => server.listen(port, () => console.log(`CivicGrid API listening on ${port}`)))
  .catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
