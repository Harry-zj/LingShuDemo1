class Response {
  static success(data = null, msg = 'success') { return { code: 200, msg, data }; }
  static error(msg = 'error', code = 400) { return { code, msg, data: null }; }
  static list(list = [], total = 0, page = 1, pageSize = 10) {
    return { code: 200, msg: 'success', data: { list, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } } };
  }
}
module.exports = Response;
