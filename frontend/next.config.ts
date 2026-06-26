/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['res.cloudinary.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = nextConfig;
