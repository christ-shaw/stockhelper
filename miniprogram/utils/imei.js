// Keep IMEIs as strings, including leading zeroes. No database writes are made here.
const MAX_PER_PHONE = 8;

function validFormat(value) {
  return typeof value === 'string' && /^[0-9]{15}$/.test(value);
}

function validChecksum(value) {
  if (!validFormat(value)) return false;
  return value.split('').reduce((sum, digit, index) => {
    let number = Number(digit) * (index % 2 ? 2 : 1);
    return sum + (number > 9 ? number - 9 : number);
  }, 0) % 10 === 0;
}

function emptyBook() {
  return { version: 1, perPhone: 2, checkDigit: false, currentModel: '', pending: [], phones: [], groupComplete: false };
}

function validateBook(book) {
  if (!book || book.version !== 1 || !Number.isInteger(book.perPhone) || book.perPhone < 1 || book.perPhone > MAX_PER_PHONE
    || typeof book.currentModel !== 'string' || typeof book.checkDigit !== 'boolean'
    || typeof book.groupComplete !== 'boolean' || !Array.isArray(book.pending) || !Array.isArray(book.phones)
    || book.pending.length >= book.perPhone || (book.groupComplete && (book.pending.length || !book.phones.length))) return false;
  const values = [...book.pending];
  const ids = new Set();
  for (const phone of book.phones) {
    if (!phone || typeof phone.id !== 'string' || !phone.id || ids.has(phone.id)
      || typeof phone.time !== 'string' || !Number.isFinite(Date.parse(phone.time)) || typeof phone.model !== 'string'
      || !Array.isArray(phone.imeis) || !phone.imeis.length || phone.imeis.length > MAX_PER_PHONE) return false;
    ids.add(phone.id);
    values.push(...phone.imeis);
  }
  return values.every(validFormat) && new Set(values).size === values.length;
}

function knownValues(book) {
  return new Set(book.pending.concat(...book.phones.map(phone => phone.imeis)));
}

// A 32-digit EID, a serial number or a longer numeric token must never be truncated.
function extractBarcode(text) {
  const found = [];
  const pattern = /(^|[^A-Za-z0-9])([0-9]{15})(?![A-Za-z0-9])/g;
  let match;
  while ((match = pattern.exec(String(text || '')))) {
    if (!found.includes(match[2])) found.push(match[2]);
  }
  return found;
}

// All validation happens before building the next state, so a failed batch is atomic.
function acceptBatch(book, values, time = new Date().toISOString()) {
  if (book.groupComplete) throw new Error('本台已完成，请换手机后开始下一组');
  if (!values.length) throw new Error('请先选择要录入的 IMEI');
  if (book.pending.length + values.length > book.perPhone) throw new Error('所选数量超过本台剩余数量，请核对手机归属');
  const known = knownValues(book);
  for (const value of values) {
    if (!validFormat(value)) throw new Error('IMEI 必须是完整的 15 位数字');
    if (known.has(value)) throw new Error('IMEI 已录入，不能重复收录');
    if (book.checkDigit && !validChecksum(value)) throw new Error('IMEI 校验位不正确，请核对号码');
    known.add(value);
  }
  const pending = book.pending.concat(values);
  if (pending.length < book.perPhone) return { ...book, pending };
  return {
    ...book, pending: [], groupComplete: true,
    phones: book.phones.concat({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, time, model: book.currentModel.trim(), imeis: pending })
  };
}

function setCount(book, count) {
  if (book.pending.length) throw new Error('请先录满本台或撤销本台号码，再修改数量');
  if (!Number.isInteger(count) || count < 1 || count > MAX_PER_PHONE) throw new Error('每台数量应为 1～8 个');
  return { ...book, perPhone: count };
}

function nextGroup(book) {
  if (!book.groupComplete) throw new Error('请先录满当前手机');
  return { ...book, groupComplete: false };
}

function undo(book) {
  if (book.pending.length) return { ...book, pending: book.pending.slice(0, -1), groupComplete: false };
  const last = book.phones[book.phones.length - 1];
  if (!last) throw new Error('暂无可撤销的号码');
  return { ...book, phones: book.phones.slice(0, -1), perPhone: last.imeis.length,
    currentModel: last.model, pending: last.imeis.slice(0, -1), groupComplete: false };
}

function safeText(value) {
  return /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
}

function toCsv(book) {
  const width = book.phones.reduce((max, phone) => Math.max(max, phone.imeis.length), 0) || book.perPhone;
  const row = cells => cells.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
  const lines = [row(['序号', '采集时间', '手机型号'].concat(Array.from({ length: width }, (_, i) => `IMEI${i + 1}`)))];
  book.phones.forEach((phone, index) => {
    lines.push(row([index + 1, phone.time, safeText(phone.model)].concat(phone.imeis, Array(width - phone.imeis.length).fill(''))));
  });
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

module.exports = { validFormat, validChecksum, emptyBook, validateBook, knownValues, extractBarcode,
  acceptBatch, setCount, nextGroup, undo, toCsv };
