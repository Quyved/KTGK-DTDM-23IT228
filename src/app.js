const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { engine } = require('express-handlebars');
const { listBooks, addBook } = require('./books');

function createApp({ config, ReadBook, WriteBook, sessionStore }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 1);
  app.engine('handlebars', engine({ defaultLayout: 'main' }));
  app.set('view engine', 'handlebars');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(express.json({ limit: '10kb' }));
  app.use(session({
    name: 'book.sid',
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.production,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/', (_req, res) => res.redirect('/books'));

  app.get('/books', async (req, res) => {
    console.log(`[READ] GET /books using ${config.readUsername}`);
    try {
      if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      const books = await listBooks(ReadBook);
      res.render('home', {
        books,
        message: req.query.added === '1' ? 'Đã thêm sách thành công.' : null,
        csrfToken: req.session.csrfToken,
        studentName: config.studentName,
        studentId: config.studentId,
        prefix: config.prefix,
        vatRate: config.vatRate
      });
    } catch (error) {
      console.error('[READ] Không thể đọc books:', error);
      res.status(503).send('Không thể tải danh sách sách. Kiểm tra kết nối READ.');
    }
  });

  app.post('/books', async (req, res) => {
    console.log(`[WRITE] POST /books using ${config.writeUsername}`);
    try {
      if (!req.is('application/json')) {
        const expected = Buffer.from(String(req.session.csrfToken || ''));
        const actual = Buffer.from(String(req.body?.csrfToken || ''));
        if (!expected.length || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
          return res.status(403).send('Phiên biểu mẫu không hợp lệ. Hãy tải lại trang.');
        }
      }
      const book = await addBook(WriteBook, req.body || {}, config.prefix, config.vatRate);
      if (req.is('application/json')) return res.status(201).json(book);
      res.redirect(303, '/books?added=1');
    } catch (error) {
      if (error.code === 11000) return res.status(409).send('Mã sách đã tồn tại.');
      if (error.message && /^(Mã sách|Tên sách|Giá gốc)/.test(error.message)) {
        return res.status(400).send(error.message);
      }
      console.error('[WRITE] Không thể thêm sách:', error);
      res.status(503).send('Không thể thêm sách. Kiểm tra kết nối WRITE.');
    }
  });

  app.use((error, _req, res, _next) => {
    console.error('Lỗi session hoặc request:', error);
    res.status(503).send('Hệ thống tạm thời không thể xử lý yêu cầu.');
  });

  return app;
}

module.exports = { createApp };
