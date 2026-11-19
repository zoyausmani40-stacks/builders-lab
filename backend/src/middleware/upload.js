import multer from 'multer';
import path from 'path';
import fs from 'fs';

const dir = path.resolve('uploads');
fs.mkdirSync(dir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname).toLowerCase()}`)
});
const fileFilter = (_req, file, cb) => {
  if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype)) return cb(new Error('Only JPG, PNG and WEBP images are allowed'));
  cb(null, true);
};
export const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
