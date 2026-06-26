import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';
import { AppError } from '../middleware/error';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export async function uploadImage(filePath: string, folder: string = 'financeai'): Promise<string> {
  if (!config.cloudinary.cloudName) {
    throw new AppError(503, 'Cloudinary not configured');
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      transformation: [{ width: 500, height: 500, crop: 'limit', quality: 'auto' }],
    });
    return result.secure_url;
  } catch (error: any) {
    console.error('❌ Cloudinary upload error:', error.message);
    throw new AppError(500, 'Failed to upload image');
  }
}

export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error: any) {
    console.error('❌ Cloudinary delete error:', error.message);
  }
}
