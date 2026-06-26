import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { uploadImage } from '../services/cloudinary';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, '/tmp/uploads');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /upload/image
router.post('/image', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ success: false, error: err.message });
      }
      return next(err);
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    try {
      const url = await uploadImage(req.file.path, 'financeai');
      res.json({ success: true, data: { url }, message: 'Image uploaded successfully' });
    } catch (error) {
      next(error);
    }
  });
});

export default router;
