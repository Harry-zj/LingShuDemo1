# 灵枢 - 云服务器部署指南

## 1. 服务器环境
- Ubuntu 20.04+ LTS，2核4G内存
- 需安装：Node.js 18+、MySQL 8.0+、Nginx、Git、PM2

## 2. 安装基础环境
```bash
ssh root@服务器IP
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx mysql-server
npm install -g pm2
pm2 startup systemd
```

## 3. 配置 MySQL
```bash
mysql -u root -p
```
```sql
CREATE DATABASE lingshu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER lingshu@localhost IDENTIFIED BY "你的强密码";
GRANT ALL PRIVILEGES ON lingshu.* TO lingshu@localhost;
FLUSH PRIVILEGES;
EXIT;
```

## 4. 部署项目
```bash
mkdir -p /var/www && cd /var/www
git clone 你的仓库地址 lingshu && cd lingshu

# 后端
cd server && npm install
nano .env  # 修改数据库连接和JWT密钥
pm2 start src/app.js --name lingshu-api && pm2 save
curl http://localhost:3000/api/health  # 验证

# 前端
cd ../client && npm install && npm run build
```

## 5. Nginx 配置
```nginx
server {
    listen 80;
    server_name 你的域名或IP;
    root /var/www/lingshu/client/dist;
    index index.html;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 20M;
    }

    location /uploads {
        # 旧附件和填表结果文件（新附件已迁移至 OSS，此路径仅用于兼容）
        alias /var/www/lingshu/server/uploads;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json;
}
```

## 6. SSL/HTTPS（推荐）
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名.com
```

## 7. Alibaba Cloud OSS 配置（材料附件存储）

### 前提条件
- 阿里云账号（已实名认证）
- 开通对象存储 OSS 服务

### 创建 Bucket
1. 登录 [OSS 控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket：
   - Bucket 名称：lingshu-uploads（可自定义）
   - 区域：选择与 ECS 相同的地域（内网访问免流量费）
   - 存储类型：标准存储
   - 读写权限：公共读（Public Read）
3. 记录 Bucket 名称和区域

### 配置访问凭证（推荐 RAM 子账户）
1. 登录 [RAM 控制台](https://ram.console.aliyun.com/)
2. 创建用户 → 编程访问
3. 授权策略：AliyunOSSFullAccess
4. 保存 AccessKey ID 和 AccessKey Secret

### 配置后端环境变量
在 server/.env 中修改：
```
OSS_REGION=oss-cn-hangzhou        # 替换为你的 Bucket 区域
OSS_ACCESS_KEY_ID=LTAI5t...       # 替换为你的 AccessKey ID
OSS_ACCESS_KEY_SECRET=...         # 替换为你的 AccessKey Secret
OSS_BUCKET=lingshu-uploads        # 替换为你的 Bucket 名称
```

### 验证 OSS 配置
```bash
# 启动后端后上传测试文件
curl -X POST http://localhost:3000/api/zongce/materials \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试"}'
# 上传附件后检查数据库：attachments.file_path 应为 https:// 开头的 OSS URL
```

### 旧文件兼容
- server/uploads/ 中的旧附件继续通过 Nginx /uploads 路径提供访问
- 系统自动识别 file_path 是完整 OSS URL 还是裸文件名
- 新上传走 OSS，旧文件无需手动迁移

## 8. 防火墙
```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
```

## 9. 日常维护
```bash
pm2 logs lingshu-api       # 查看日志
pm2 restart lingshu-api    # 重启后端

# 更新部署：
cd /var/www/lingshu && git pull origin main
cd server && npm install --production && pm2 restart lingshu-api
cd ../client && npm install && npm run build
```

## 10. 常见问题
| 问题 | 排查方向 |
|------|----------|
| API无响应 | pm2 status，检查3000端口 |
| 数据库连接失败 | .env配置是否正确，MySQL是否启动 |
| 前端空白页 | dist目录是否存在，Nginx root路径 |
| 上传失败 | Nginx client_max_body_size，uploads目录权限 |
| 502错误 | 后端是否正常运行，pm2 restart |

