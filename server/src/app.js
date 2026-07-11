const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const config = require("./config");
const { initDatabase } = require("./config/database");
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
app.get("/api/health", (req, res) => res.json({ code: 200, msg: "灵枢服务运行中", data: { time: new Date().toISOString() } }));
// 启动
app.listen(config.port, async () => {
  console.log(`[Server] 灵枢后端已启动: http://localhost:${config.port}`);
  await initDatabase();
});

