const test = require('node:test');
const assert = require('node:assert/strict');
const { createConfig } = require('../src/config');
const { connectDatabase } = require('../src/database');

test('cấu hình đọc đúng hai URI và từ chối nhầm tài khoản', () => {
  const env = {
    MONGO_READ_URI: 'mongodb+srv://23IT228_read:readpass@example.mongodb.net/DB_23IT228',
    MONGO_WRITE_URI: 'mongodb+srv://23IT228_write:writepass@example.mongodb.net/DB_23IT228',
    SESSION_SECRET: 'test-secret-with-at-least-32-characters',
    PORT: '3000'
  };
  const config = createConfig(env);
  assert.equal(config.dbName, 'DB_23IT228');
  assert.equal(config.readUri, env.MONGO_READ_URI);
  assert.equal(config.writeUri, env.MONGO_WRITE_URI);
  assert.equal(config.vatRate, 12);
  assert.throws(() => createConfig({ ...env, MONGO_WRITE_URI: env.MONGO_READ_URI }), /write/);
});

test('tạo hai connection và hai model riêng, cùng collection books', async () => {
  const calls = [];
  const driver = {
    createConnection(uri, options) {
      const connection = {
        asPromise: async () => connection,
        model(name, _schema, collection) { return { name, collection, uri }; },
        db: { collection(name) { return { name, uri }; } },
        close: async () => {}
      };
      calls.push({ uri, options });
      return connection;
    }
  };
  const config = {
    readUri: 'read-uri', writeUri: 'write-uri', dbName: 'DB_23IT228'
  };
  const database = await connectDatabase(config, driver);
  assert.deepEqual(calls.map(call => call.uri), ['read-uri', 'write-uri']);
  assert.ok(calls.every(call => call.options.dbName === 'DB_23IT228' && call.options.autoIndex === false && call.options.autoCreate === false));
  assert.deepEqual(database.ReadBook, { name: 'ReadBook', collection: 'books', uri: 'read-uri' });
  assert.deepEqual(database.WriteBook, { name: 'WriteBook', collection: 'books', uri: 'write-uri' });
  assert.deepEqual(database.readSessions, { name: 'sessions', uri: 'read-uri' });
  assert.deepEqual(database.writeSessions, { name: 'sessions', uri: 'write-uri' });
  await database.close();
});
