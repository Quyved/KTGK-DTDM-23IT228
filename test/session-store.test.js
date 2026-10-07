const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoSessionStore } = require('../src/mongo-session-store');

test('session đọc qua READ và ghi/cập nhật/xóa qua WRITE', async () => {
  const docs = new Map();
  const calls = [];
  const readSessions = {
    async findOne(query) {
      calls.push('READ.findOne');
      const doc = docs.get(query._id);
      return doc && doc.expiresAt > query.expiresAt.$gt ? doc : null;
    }
  };
  const writeSessions = {
    async updateOne(filter, update) {
      calls.push('WRITE.updateOne');
      docs.set(filter._id, { ...docs.get(filter._id), ...update.$set });
    },
    async deleteOne(filter) {
      calls.push('WRITE.deleteOne');
      docs.delete(filter._id);
    }
  };
  const store = new MongoSessionStore(readSessions, writeSessions);
  const call = (method, ...args) => new Promise((resolve, reject) => {
    store[method](...args, (error, value) => error ? reject(error) : resolve(value));
  });
  const sess = { cookie: { expires: new Date(Date.now() + 60_000) }, csrfToken: 'token' };
  await call('set', 'sid', sess);
  const secondInstance = new MongoSessionStore(readSessions, writeSessions);
  const restored = await new Promise((resolve, reject) => {
    secondInstance.get('sid', (error, value) => error ? reject(error) : resolve(value));
  });
  assert.equal(restored.csrfToken, 'token');
  await call('touch', 'sid', sess);
  await call('destroy', 'sid');
  assert.equal(await call('get', 'sid'), null);
  assert.deepEqual(calls, [
    'WRITE.updateOne', 'READ.findOne', 'WRITE.updateOne', 'WRITE.deleteOne', 'READ.findOne'
  ]);
});
