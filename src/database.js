const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  code: { type: String, required: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true },
  priceAfterVAT: { type: Number, required: true },
  vatRate: { type: Number, required: true },
  createdAt: { type: Date, required: true }
}, { versionKey: false, autoIndex: false, autoCreate: false });

async function connectDatabase(config, driver = mongoose) {
  const options = { dbName: config.dbName, serverSelectionTimeoutMS: 7000, autoIndex: false, autoCreate: false };

  async function connectOne(uri, label) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const connection = driver.createConnection(uri, options);
      try {
        await connection.asPromise();
        return connection;
      } catch (error) {
        await connection.close().catch(() => {});
        const transient = /Mongo(Network|ServerSelection)Error|MongooseServerSelectionError/.test(error.name) &&
          /TLS|SSL|ECONN|ETIMEDOUT|ENOTFOUND|server selection/i.test(error.message);
        if (!transient || attempt === 5) {
          throw new Error(`${label} connection failed: ${error.message}`, { cause: error });
        }
        console.warn(`[${label}] Kết nối tạm lỗi; thử lại (${attempt}/5).`);
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  // Hai tài khoản mở connection độc lập và bắt đầu kết nối đồng thời.
  const [readResult, writeResult] = await Promise.allSettled([
    connectOne(config.readUri, 'READ'),
    connectOne(config.writeUri, 'WRITE')
  ]);
  if (readResult.status === 'rejected' || writeResult.status === 'rejected') {
    await Promise.allSettled([
      readResult.status === 'fulfilled' ? readResult.value.close() : Promise.resolve(),
      writeResult.status === 'fulfilled' ? writeResult.value.close() : Promise.resolve()
    ]);
    throw readResult.status === 'rejected' ? readResult.reason : writeResult.reason;
  }
  const readConnection = readResult.value;
  const writeConnection = writeResult.value;
  return {
    ReadBook: readConnection.model('ReadBook', bookSchema, 'books'),
    WriteBook: writeConnection.model('WriteBook', bookSchema, 'books'),
    readSessions: readConnection.db.collection('sessions'),
    writeSessions: writeConnection.db.collection('sessions'),
    async close() { await Promise.all([readConnection.close(), writeConnection.close()]); }
  };
}

module.exports = { connectDatabase };
