const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const config = require("./config");
const app = express();
// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
// 路由
app.use("/api/auth", require("./routes/auth"));
app.use("/api/module1", require("./routes/module1"));
app.use("/api/module2", require("./routes/module2"));
app.use("/api/module3", require("./routes/module3"));
// 健康检查
app.get("/api/health", (req, res) => res.json({ code: 200, msg: "灵枢服务运行中", data: { time: new Date().toISOString(), mode: "mock" } }));

// 统一错误处理，主要用于上传文件类型/大小校验
app.use((err, req, res, next) => {
  if (!err) return next();
  res.status(400).json({ code: 400, msg: err.message || "请求处理失败", data: null });
});

// 启动
app.listen(config.port, () => {
  console.log(`[Server] 灵枢后端已启动: http://localhost:${config.port}`);
  console.log("[Server] 当前使用内存 mock 数据，未连接数据库");
});

