const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('express-session');
const { validateBook } = require('../src/books');
const { createApp } = require('../src/app');

const config = {
  studentName: 'Trần Thanh Quý', studentId: '23IT228', prefix: '228', vatRate: 12,
  readUsername: '23IT228_read', writeUsername: '23IT228_write',
  sessionSecret: 'test-secret-with-at-least-32-characters'
};

test('mã sách và VAT được kiểm tra trước khi ghi', () => {
  const book = validateBook({ code: '228-A', title: 'Sách thử', author: 'Tác giả', price: '101' }, '228', 12);
  assert.equal(book.priceAfterVAT, 113.12);
  assert.throws(() => validateBook({ code: '999-A', title: 'Sách thử', author: 'Tác giả', price: '100' }, '228', 12), /bắt đầu bằng 228/);
});

test('GET chỉ đọc qua READ model; POST chỉ ghi qua WRITE model', async () => {
  let reads = 0;
  let writes = 0;
  const ReadBook = {
    find() {
      reads++;
      return { sort() { return this; }, limit() { return this; }, lean() { return this; }, async exec() { return []; } };
    }
  };
  const WriteBook = {
    async create(book) { writes++; return book; }
  };
  const server = createApp({ config, ReadBook, WriteBook, sessionStore: new session.MemoryStore() }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const getResponse = await fetch(`${base}/books`);
    assert.equal(getResponse.status, 200);
    const page = await getResponse.text();
    assert.match(page, /Trần Thanh Quý.*23IT228.*12%/s);
    const csrfToken = page.match(/name="csrfToken" value="([a-f0-9]+)"/)?.[1];
    const cookie = getResponse.headers.get('set-cookie')?.split(';')[0];
    assert.ok(csrfToken && cookie);
    assert.equal(reads, 1);
    assert.equal(writes, 0);

    const postResponse = await fetch(`${base}/books`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '228-A', title: 'Sách thử', author: 'Tác giả', price: 101 })
    });
    assert.equal(postResponse.status, 201);
    assert.equal((await postResponse.json()).priceAfterVAT, 113.12);
    assert.equal(reads, 1);
    assert.equal(writes, 1);

    const formResponse = await fetch(`${base}/books`, {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams({ csrfToken, code: '228-B', title: 'Sách biểu mẫu', author: 'Tác giả', price: '100' })
    });
    assert.equal(formResponse.status, 303);
    assert.equal(writes, 2);

    const missingTokenResponse = await fetch(`${base}/books`, {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams({ code: '228-C', title: 'Thiếu token', author: 'Tác giả', price: '100' })
    });
    assert.equal(missingTokenResponse.status, 403);
    assert.equal(writes, 2);

    const invalidResponse = await fetch(`${base}/books`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '999-A', title: 'Sai', author: 'Tác giả', price: 100 })
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal(writes, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
