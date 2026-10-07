const session = require('express-session');

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// Mỗi thao tác dùng đúng một trong hai connection đã mở bằng mongoose.createConnection().
class MongoSessionStore extends session.Store {
  constructor(readSessions, writeSessions) {
    super();
    this.readSessions = readSessions;
    this.writeSessions = writeSessions;
  }

  get(sid, callback) {
    this.readSessions.findOne({ _id: sid, expiresAt: { $gt: new Date() } })
      .then(doc => callback(null, doc?.sess || null), callback);
  }

  set(sid, sess, callback = () => {}) {
    const expiresAt = sess.cookie?.expires
      ? new Date(sess.cookie.expires)
      : new Date(Date.now() + SESSION_LIFETIME_MS);
    this.writeSessions.updateOne(
      { _id: sid },
      { $set: { sess, expiresAt } },
      { upsert: true }
    ).then(() => callback(null), callback);
  }

  touch(sid, sess, callback = () => {}) {
    const expiresAt = sess.cookie?.expires
      ? new Date(sess.cookie.expires)
      : new Date(Date.now() + SESSION_LIFETIME_MS);
    this.writeSessions.updateOne(
      { _id: sid }, { $set: { expiresAt } }
    ).then(() => callback(null), callback);
  }

  destroy(sid, callback = () => {}) {
    this.writeSessions.deleteOne({ _id: sid })
      .then(() => callback(null), callback);
  }
}

module.exports = { MongoSessionStore };
