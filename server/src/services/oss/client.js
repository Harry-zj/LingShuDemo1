const OSS = require('ali-oss');
const config = require('../../config');

let client = null;

function getClient() {
  if (!client) {
    client = new OSS({
      region: config.oss.region,
      accessKeyId: config.oss.accessKeyId,
      accessKeySecret: config.oss.accessKeySecret,
      bucket: config.oss.bucket,
    });
  }
  return client;
}

module.exports = { getClient };
