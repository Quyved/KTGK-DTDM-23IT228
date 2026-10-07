const { createConfig } = require('./config');
const { connectDatabase } = require('./database');
const { MongoSessionStore } = require('./mongo-session-store');
const { createApp } = require('./app');

async function main() {
  const config = createConfig();
  const database = await connectDatabase(config);
  const sessionStore = new MongoSessionStore(database.readSessions, database.writeSessions);
  const app = createApp({ ...database, config, sessionStore });
  const server = app.listen(config.port, () => {
    console.log(`Ứng dụng chạy trên http://localhost:${config.port}`);
  });
  const shutdown = () => server.close(() => database.close().catch(console.error));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('Không thể khởi động ứng dụng:', error.message);
  process.exitCode = 1;
});
