require('dotenv').config();
module.exports = {
  port: process.env.PORT || 3000,
  jwt: { secret: process.env.JWT_SECRET || 'lingshu_jwt_2026', expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  upload: { maxSize: (process.env.UPLOAD_MAX_SIZE || 10) * 1024 * 1024 },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  kimi: {
    apiKey: process.env.KIMI_API_KEY || '',
    baseUrl: process.env.KIMI_BASE_URL || 'https://api.siliconflow.cn',
    model: process.env.KIMI_MODEL || 'moonshotai/Kimi-K2.6',
  },
  oss: {
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || 'lingshu-uploads',
  },
};
