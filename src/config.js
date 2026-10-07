require('dotenv').config();

function createConfig(env = process.env) {
  const studentName = 'Trần Thanh Quý';
  const studentId = '23IT228';
  const prefix = studentId.slice(-3);
  const vatRate = Number(studentId.slice(-1)) + 4;
  const dbName = `DB_${studentId}`;
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT không hợp lệ.');
  }
  function parseUri(key, suffix) {
    const value = env[key];
    if (!value) throw new Error(`Cần cấu hình ${key} trong biến môi trường.`);
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error(`${key} không hợp lệ.`); }
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
        decodeURIComponent(parsed.username) !== `${studentId}_${suffix}`) {
      throw new Error(`${key} phải dùng tài khoản ${studentId}_${suffix}.`);
    }
    return value;
  }
  const readUri = parseUri('MONGO_READ_URI', 'read');
  const writeUri = parseUri('MONGO_WRITE_URI', 'write');
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET phải có ít nhất 32 ký tự trong biến môi trường.');
  }
  return {
    studentName, studentId, prefix, vatRate, dbName, port,
    readUri, writeUri,
    sessionSecret,
    production: env.NODE_ENV === 'production',
    readUsername: `${studentId}_read`,
    writeUsername: `${studentId}_write`
  };
}

module.exports = { createConfig };
