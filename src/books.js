function validateBook(input, prefix, vatRate) {
  const code = String(input.code || '').trim();
  const title = String(input.title || '').trim();
  const author = String(input.author || '').trim();
  const rawPrice = String(input.price ?? '').trim();
  if (!code.startsWith(prefix) || !/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
    throw new Error(`Mã sách phải bắt đầu bằng ${prefix}, dài tối đa 40 ký tự và chỉ dùng chữ, số, _ hoặc -.`);
  }
  if (!title || title.length > 150 || !author || author.length > 100) {
    throw new Error('Tên sách hoặc tác giả không hợp lệ.');
  }
  if (!/^(0|[1-9]\d*)$/.test(rawPrice)) {
    throw new Error('Giá gốc phải là số nguyên không âm.');
  }
  const price = Number(rawPrice);
  if (!Number.isSafeInteger(price) || price > 1_000_000_000) {
    throw new Error('Giá gốc vượt quá giới hạn cho phép.');
  }
  const priceAfterVAT = Math.round(price * (100 + vatRate)) / 100;
  return { _id: code, code, title, author, price, priceAfterVAT, vatRate, createdAt: new Date() };
}

async function listBooks(ReadBook) {
  const books = await ReadBook.find({}, 'code title author price priceAfterVAT')
    .sort({ createdAt: -1 }).limit(100).lean().exec();
  const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  return books.map(book => ({
    ...book,
    price: `${formatter.format(book.price)} ₫`,
    priceAfterVAT: `${formatter.format(book.priceAfterVAT)} ₫`
  }));
}

async function addBook(WriteBook, input, prefix, vatRate) {
  const book = validateBook(input, prefix, vatRate);
  await WriteBook.create(book);
  return book;
}

module.exports = { validateBook, listBooks, addBook };
