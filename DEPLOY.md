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

## 7. 防火墙
```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
```

## 8. 日常维护
```bash
pm2 logs lingshu-api       # 查看日志
pm2 restart lingshu-api    # 重启后端

# 更新部署：
cd /var/www/lingshu && git pull origin main
cd server && npm install --production && pm2 restart lingshu-api
cd ../client && npm install && npm run build
```

## 9. 常见问题
| 问题 | 排查方向 |
|------|----------|
| API无响应 | pm2 status，检查3000端口 |
| 数据库连接失败 | .env配置是否正确，MySQL是否启动 |
| 前端空白页 | dist目录是否存在，Nginx root路径 |
| 上传失败 | Nginx client_max_body_size，uploads目录权限 |
| 502错误 | 后端是否正常运行，pm2 restart |

