import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { uploadToCloudinary } from '../services/cloudinary';
import { AppError } from '../middleware/error';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Upload Image ──────────────────────────────────────────────
router.post('/image', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { image } = req.body;
  if (!image) throw new AppError(400, 'Image is required');

  const url = await uploadToCloudinary(image, 'financeai/uploads');
  res.json({ url });
}));

export default router;
