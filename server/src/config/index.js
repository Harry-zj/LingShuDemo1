require('dotenv').config();
module.exports = {
  port: process.env.PORT || 3000,
  jwt: { secret: process.env.JWT_SECRET || 'lingshu_jwt_2026', expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  upload: { maxSize: (process.env.UPLOAD_MAX_SIZE || 10) * 1024 * 1024 }
};
