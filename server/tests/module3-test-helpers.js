"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const serverRoot = path.resolve(__dirname, "..");
const servicePath = path.join(serverRoot, "src/services/module3/service.js");
const controllerPath = path.join(serverRoot, "src/controllers/module3Controller.js");
const routesPath = path.join(serverRoot, "src/routes/module3.js");
const appPath = path.join(serverRoot, "src/app.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`未找到起始标记：${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`未找到结束标记：${endMarker}`);
  return source.slice(start, end);
}

function loadServiceInternals() {
  const source = `${read(servicePath)}\nmodule.exports.__test__ = {\n  normalizeIds,\n  calculateLevel,\n  nextStatusAfter,\n  canStudentEdit,\n  readonlyReason,\n  isInScope,\n  isFinalStatus,\n};\n`;
  const testModule = new Module(servicePath, module);
  testModule.filename = servicePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(servicePath));
  const defaultRequire = testModule.require.bind(testModule);
  testModule.require = request => {
    if (request === "../../config/database") return { pool: {} };
    if (request === "../zongce/fillService") return { getFillDataPreview: async () => ({}) };
    return defaultRequire(request);
  };
  testModule._compile(source, servicePath);
  return testModule.exports.__test__;
}

module.exports = {
  serverRoot,
  servicePath,
  controllerPath,
  routesPath,
  appPath,
  read,
  between,
  loadServiceInternals,
};
