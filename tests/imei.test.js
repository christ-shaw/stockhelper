const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const imei = require('../miniprogram/utils/imei');
const { openTaskStore, parseTotal } = require('../miniprogram/utils/imei-tasks');
const A = '490154203237518';
const B = '356938035643809';
const C = '012345678901237';
const time = '2026-11-17T08:00:00.000Z';

test('15-digit strings preserve leading zeroes; EID, SN and non-ASCII digits are rejected', () => {
  for (const value of [A, B, C]) assert.equal(imei.validFormat(value), true);
  for (const value of [Number(A), '', '1'.repeat(14), '1'.repeat(16), '1'.repeat(32), '１２３４５６７８９０１２３４５', 'ABC123456789012']) {
    assert.equal(imei.validFormat(value), false);
  }
});

test('Luhn check digit matches known IMEI examples', () => {
  for (const value of [A, B, C]) assert.equal(imei.validChecksum(value), true);
  assert.equal(imei.validChecksum(A.slice(0, -1) + '0'), false);
});

test('barcode extraction supports multiple complete tokens, deduplicates, and never slices EIDs', () => {
  assert.deepEqual(imei.extractBarcode(`IMEI1:${A}\nIMEI2:${B};${A}`), [A, B]);
  assert.deepEqual(imei.extractBarcode(`${C},${B}`), [C, B]);
  for (const value of ['1'.repeat(32), `X${A}`, `${A}Z`, `1${A}`, `${A}1`]) {
    assert.deepEqual(imei.extractBarcode(value), []);
  }
});

test('batch recording is atomic and prohibits duplicates within or across phones', () => {
  let book = imei.emptyBook();
  const original = JSON.stringify(book);
  assert.throws(() => imei.acceptBatch(book, [A, 'bad']), /15/);
  assert.throws(() => imei.acceptBatch(book, [A, A]), /重复/);
  assert.equal(JSON.stringify(book), original);
  book = imei.acceptBatch(book, [A], time);
  assert.throws(() => imei.acceptBatch(book, [A]), /重复/);
  book = imei.acceptBatch(book, [B], time);
  assert.equal(book.groupComplete, true);
  assert.deepEqual(book.pending, []);
  assert.deepEqual(book.phones[0].imeis, [A, B]);
  assert.throws(() => imei.acceptBatch(book, [C]), /下一组/);
  book = imei.nextGroup(book);
  assert.throws(() => imei.acceptBatch(book, [A]), /重复/);
});

test('partial groups block count changes, next group and overflow', () => {
  const book = imei.acceptBatch(imei.emptyBook(), [A], time);
  assert.throws(() => imei.setCount(book, 1), /录满/);
  assert.throws(() => imei.nextGroup(book), /录满/);
  assert.throws(() => imei.acceptBatch(book, [B, C]), /剩余/);
  assert.deepEqual(book.pending, [A]);
});

test('groups support 1 to 8 IMEIs and checksum enforcement is optional', () => {
  for (let count = 1; count <= 8; count++) {
    const values = Array.from({ length: count }, (_, i) => `00000000000000${i}`);
    const book = imei.acceptBatch(imei.setCount(imei.emptyBook(), count), values, time);
    assert.equal(book.phones[0].imeis.length, count);
    assert.equal(imei.validateBook(book), true);
  }
  for (const count of [0, 9, 1.5]) assert.throws(() => imei.setCount(imei.emptyBook(), count));
  assert.throws(() => imei.acceptBatch({ ...imei.emptyBook(), checkDigit: true }, ['1'.repeat(15)]), /校验/);
});

test('undo reopens the last completed phone with its original model/count', () => {
  let book = { ...imei.emptyBook(), currentModel: '三星 S20' };
  book = imei.acceptBatch(book, [A, B], time);
  book = imei.setCount(book, 3);
  book = imei.undo(book);
  assert.equal(book.perPhone, 2);
  assert.equal(book.currentModel, '三星 S20');
  assert.equal(book.groupComplete, false);
  assert.deepEqual(book.pending, [A]);
  assert.equal(book.phones.length, 0);
  book = imei.undo(book);
  assert.deepEqual(book.pending, []);
  assert.throws(() => imei.undo(book), /暂无/);
});

test('storage validation rejects corruption while preserving valid partial and completed books', () => {
  const book = imei.acceptBatch(imei.emptyBook(), [A, B], time);
  assert.equal(imei.validateBook(book), true);
  assert.equal(imei.validateBook(imei.acceptBatch(imei.emptyBook(), [A], time)), true);
  for (const invalid of [null, {}, { ...book, version: 2 }, { ...book, perPhone: 0 },
    { ...book, pending: [A] }, { ...book, phones: [book.phones[0], book.phones[0]] },
    { ...book, phones: [{ ...book.phones[0], time: 'invalid' }] },
    { ...book, phones: [{ ...book.phones[0], imeis: [Number(A)] }] }]) {
    assert.equal(imei.validateBook(invalid), false);
  }
});

test('CSV quotes fields, preserves zeroes, neutralizes model formulas, and excludes pending phones', () => {
  let book = { ...imei.emptyBook(), currentModel: '三星, S20 "美版"' };
  book = imei.acceptBatch(book, [A, B], time);
  book = imei.nextGroup(book);
  book = imei.setCount(book, 1);
  book.currentModel = ' =1+1';
  book = imei.acceptBatch(book, [C], time);
  book = imei.nextGroup(book);
  book = imei.setCount(book, 2);
  book = imei.acceptBatch(book, ['000000000000000'], time);
  const csv = imei.toCsv(book);
  assert.ok(csv.startsWith('\uFEFF"序号","采集时间","手机型号","IMEI1","IMEI2"\r\n'));
  assert.ok(csv.includes('"三星, S20 ""美版"""'));
  assert.ok(csv.includes('"\'=1+1","012345678901237",""'));
  assert.ok(!csv.includes('000000000000000'));
  assert.equal(csv.split('\r\n').length, 4);
});

function mountPage(name, wx, options = {}) {
  let definition;
  const filename = path.resolve(__dirname, '../miniprogram/pages/imei/' + name + '.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { Page: page => { definition = page; }, wx, require: createRequire(filename) }, { filename });
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)), setData(data) { Object.assign(this.data, data); } };
  if (page.onLoad) page.onLoad(options);
  if (page.onShow) page.onShow();
  return page;
}

function mockWeChat() {
  const writes = [], messages = [];
  const storage = new Map([['userInfo', { openid: 'test-user' }]]);
  const wx = {
    getStorageSync: key => storage.has(key) ? structuredClone(storage.get(key)) : '',
    setStorageSync(key, value) {
      const copy = JSON.parse(JSON.stringify(value));
      storage.set(key, copy);
      writes.push({ key, value: copy });
    },
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    showModal: args => messages.push(args), showToast: args => messages.push(args),
    reLaunch: args => messages.push(args), navigateTo: args => messages.push(args),
    redirectTo: args => messages.push(args), setNavigationBarTitle() {}, vibrateShort() {}
  };
  return { wx, storage, messages, writes };
}

function loadPage(stored = '', overrides = {}) {
  const mock = mockWeChat();
  const { wx, storage, writes } = mock;
  const task = openTaskStore(wx).create('测试任务', stored.currentModel || '测试型号', '');
  if (stored) storage.set(writes[0].key, { ...task, book: stored });
  writes.length = 0;
  Object.assign(wx, overrides);
  return { ...mock, page: mountPage('imei', wx, { id: task.id }) };
}

test('page persists under current account and reloads partial groups', () => {
  const { page, writes } = loadPage();
  page.addCandidates([A], '手动');
  page.acceptSelected();
  assert.match(writes[0].key, /^imei_task_v1_test-user:/);
  const reloaded = loadPage(writes[0].value.book).page;
  assert.equal(reloaded.data.book.pending[0], A);
  assert.equal(reloaded.data.remaining, 1);
});

test('page storage failure keeps all candidates and does not claim successful recording', () => {
  const { page, messages } = loadPage('', { setStorageSync() { throw new Error('quota'); } });
  page.addCandidates([A, B], '条码');
  page.acceptSelected();
  assert.equal(page.data.phoneCount, 0);
  assert.equal(page.data.candidates.length, 2);
  assert.equal(messages[0].title, '保存失败');
});

test('page protects corrupt storage and requires authenticated account', () => {
  const broken = loadPage({ version: 99 });
  assert.ok(broken.page.data.storageError);
  assert.equal(broken.page.commit(imei.emptyBook()), false);
  assert.equal(broken.writes.length, 0);
  const signedOut = loadPage('', { getStorageSync: () => '' });
  assert.equal(signedOut.messages[0].url, '/pages/login/login');
});

test('WeChat scanCode accepts one selected barcode per launch, including a result delivered before onShow', async () => {
  const calls = [];
  const { page, writes } = loadPage('', { scanCode(options) { calls.push(options); } });
  const first = page.scanWithWeChat();
  await page.scanWithWeChat();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].scanType.join(','), 'barCode');
  assert.equal(calls[0].onlyFromCamera, false);
  page.onHide();
  calls[0].success({ result: A, scanType: 'CODE_128' });
  await first;
  page.onShow();
  assert.equal(page.data.candidates[0].value, A);
  assert.equal(page.data.candidates.length, 1);
  const second = page.scanWithWeChat();
  calls[1].success({ result: B, scanType: 'CODE_128' });
  await second;
  assert.equal(page.data.candidates[1].value, B);
  assert.equal(page.data.canRecord, true);
  assert.equal(writes.length, 0);
  await page.scanWithWeChat();
  assert.equal(calls.length, 2);
  page.acceptSelected();
  assert.equal(page.data.book.phones[0].imeis.join(','), [A, B].join(','));
  const next = page.nextGroup();
  assert.equal(calls.length, 3);
  calls[2].fail({ errMsg: 'scanCode:fail cancel' });
  await next;
  assert.equal(page.data.wechatScanBusy, false);
});

test('WeChat scanCode preserves a partial group on cancel, EID, duplicate and failure, and ignores late results on unload', async () => {
  let call;
  const { page, writes } = loadPage('', { scanCode(options) { call = options; } });
  page.addCandidates([A], '手动');
  for (const [callback, payload, message] of [
    ['fail', { errMsg: 'scanCode:fail cancel' }, null],
    ['success', { result: '1'.repeat(32) }, /EID/],
    ['success', { result: A }, /已采集/],
    ['fail', { errMsg: 'scanCode:fail' }, /重试/]
  ]) {
    const previousStatus = page.data.status;
    const scanning = page.scanWithWeChat();
    call[callback](payload);
    await scanning;
    if (message) assert.match(page.data.status, message);
    else assert.equal(page.data.status, previousStatus);
    assert.equal(page.data.wechatScanBusy, false);
    assert.equal(page.data.candidates.length, 1);
  }
  const late = page.scanWithWeChat();
  page.onUnload();
  call.success({ result: B });
  await late;
  assert.equal(page.data.candidates.length, 1);
  assert.equal(writes.length, 0);
});

test('quick confirmation respects checksum settings and keeps the full group after a storage error', () => {
  const { page, messages } = loadPage('', { setStorageSync() { throw new Error('quota'); } });
  page.addCandidates([A, B], '条码');
  page.acceptSelected();
  assert.equal(page.data.canRecord, true);
  assert.equal(page.data.phoneCount, 0);
  assert.equal(page.data.candidates.length, 2);
  assert.equal(messages[0].title, '保存失败');
  page.renderBook({ ...imei.emptyBook(), checkDigit: true });
  page.clearCandidates();
  page.addCandidates([A, '111111111111111'], '手动');
  assert.equal(page.data.canRecord, false);
  page.acceptSelected();
  assert.equal(messages.length, 1);
});

test('candidate overflow requires explicit selection and allows correcting IMEI order', () => {
  const { page } = loadPage();
  page.addCandidates([A, B, C], '微信扫一扫');
  assert.equal(page.data.selectedCount, 0);
  page.toggleCandidate({ currentTarget: { dataset: { value: A } } });
  page.toggleCandidate({ currentTarget: { dataset: { value: B } } });
  page.moveCandidateUp({ currentTarget: { dataset: { index: 1 } } });
  page.acceptSelected();
  assert.equal(page.data.book.phones[0].imeis.join(','), `${B},${A}`);
  assert.equal(page.data.candidates.length, 0);
});

test('restored partial phone can be completed by a native scan without changing earlier records or settings', async () => {
  const completed = imei.acceptBatch({ ...imei.emptyBook(), currentModel: 'iPhone', checkDigit: true }, [A, B], time);
  const partial = imei.acceptBatch(imei.nextGroup(completed), [C], time);
  const last = '000000000000000';
  const { page, writes } = loadPage(partial, { scanCode: options => options.success({ result: last }) });
  await page.scanWithWeChat();
  assert.equal(writes.length, 0);
  page.acceptSelected();
  const saved = writes[0].value.book;
  assert.deepEqual(saved.phones[0], completed.phones[0]);
  assert.deepEqual(saved.phones[1].imeis, [C, last]);
  assert.equal(saved.phones[1].model, 'iPhone');
  assert.equal(saved.checkDigit, true);
});

test('manual input can finish a group when the native scanner is unavailable', async () => {
  const { page, writes } = loadPage();
  await page.scanWithWeChat();
  assert.match(page.data.status, /手动输入/);
  page.toggleManualInput();
  for (const value of [A, B]) {
    page.onManualInput({ detail: { value } });
    page.addManual();
  }
  assert.equal(writes.length, 0);
  page.acceptSelected();
  assert.deepEqual(writes[0].value.book.phones[0].imeis, [A, B]);
});

test('manual entry rejects pasted EIDs without truncating them', () => {
  const { page, messages } = loadPage();
  page.onManualInput({ detail: { value: '1'.repeat(32) } });
  page.addManual();
  assert.equal(page.data.candidates.length, 0);
  assert.equal(page.data.manualInput.length, 32);
  assert.match(messages[0].title, /15/);
});

test('export opens the native share dialog within the tap and keeps the UTF-8 CSV until sharing finishes', async () => {
  const book = imei.acceptBatch(imei.emptyBook(), [A, B], time);
  const events = [];
  let finish, writtenPath;
  const { page, writes } = loadPage(book, {
    env: { USER_DATA_PATH: '/test' },
    getFileSystemManager: () => ({
      writeFileSync(path, data, encoding) {
        writtenPath = path;
        events.push('write');
        assert.equal(encoding, 'utf8');
        assert.equal(data, imei.toCsv(book));
      },
      unlink(options) { events.push('unlink'); assert.equal(options.filePath, writtenPath); }
    }),
    shareFileMessage(options) {
      events.push('share');
      assert.equal(options.filePath, writtenPath);
      assert.match(options.fileName, /^[a-zA-Z0-9-]+\.csv$/);
      finish = options.success;
    }
  });
  const exporting = page.exportCsv();
  page.exportCsv();
  assert.deepEqual(events, ['write', 'share']);
  finish();
  await exporting;
  assert.deepEqual(events, ['write', 'share', 'unlink']);
  assert.equal(page.data.exporting, false);
  assert.equal(page.data.exportNotice, '');
  assert.equal(writes.length, 0);
});

test('partial export requires a tap, allows dismissal and exports only completed phones', async () => {
  let book = imei.acceptBatch(imei.emptyBook(), [A, B], time);
  book = imei.acceptBatch(imei.nextGroup(book), [C], time);
  const events = [];
  const { page } = loadPage(book, {
    env: { USER_DATA_PATH: '/test' },
    getFileSystemManager: () => ({
      writeFileSync(path, data) { events.push('write'); assert.equal(data, imei.toCsv(book)); assert.ok(!data.includes(C)); },
      unlink() {}
    }),
    shareFileMessage(options) { events.push('share'); options.success(); }
  });
  page.exportCsv();
  assert.match(page.data.exportNotice, /只导出已完成的 1 台/);
  page.dismissExportNotice();
  assert.deepEqual(events, []);
  assert.equal(page.data.book.pending[0], C);
  page.exportCsv();
  const exporting = page.exportCsv();
  assert.deepEqual(events, ['write', 'share']);
  await exporting;
});

test('desktop export writes an actual CSV with leading zeroes and uses the native save dialog', async t => {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imei-export-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const book = imei.acceptBatch(imei.emptyBook(), [C, A], time);
  let saved;
  const { page } = loadPage(book, {
    env: { USER_DATA_PATH: dir },
    getDeviceInfo: () => ({ platform: 'mac' }),
    getFileSystemManager: () => ({
      writeFileSync: fs.writeFileSync,
      unlink: ({ filePath }) => fs.unlinkSync(filePath)
    }),
    saveFileToDisk(options) { saved = fs.readFileSync(options.filePath, 'utf8'); options.success(); }
  });
  await page.exportCsv();
  assert.equal(saved, imei.toCsv(book));
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('file failures identify the stage and let the user explicitly copy the same CSV without touching records', async () => {
  const book = imei.acceptBatch(imei.emptyBook(), [A, B], time);
  for (const failing of ['write', 'share', 'missing']) {
    let copied, shares = 0;
    const { page, writes } = loadPage(book, {
      env: { USER_DATA_PATH: '/test' },
      getFileSystemManager: () => ({
        writeFileSync() { if (failing === 'write') throw new Error('ENOSPC'); },
        unlink() {}
      }),
      shareFileMessage: failing === 'missing' ? undefined : options => {
        shares++;
        options.fail({ errMsg: 'shareFileMessage:fail permission denied', errno: 42 });
      },
      setClipboardData(options) { copied = options.data; options.success(); }
    });
    await page.exportCsv();
    assert.equal(shares, failing === 'share' ? 1 : 0);
    assert.match(page.data.exportNotice, failing === 'write' ? /CSV 文件写入失败。ENOSPC/
      : failing === 'share' ? /分享文件失败.*permission denied.*42/ : /未提供文件分享接口/);
    assert.equal(copied, undefined);
    await page.copyExportCsv();
    assert.equal(copied, imei.toCsv(book));
    assert.equal(page.data.exportNotice, '');
    assert.equal(writes.length, 0);
  }
});

test('share cancellation releases the export and account changes block clipboard fallback', async () => {
  const book = imei.acceptBatch(imei.emptyBook(), [A, B], time);
  let removed = 0;
  const { page, storage, wx } = loadPage(book, {
    env: { USER_DATA_PATH: '/test' },
    getFileSystemManager: () => ({ writeFileSync() {}, unlink() { removed++; } }),
    shareFileMessage(options) { options.fail({ errMsg: 'shareFileMessage:fail cancel' }); },
    setClipboardData() { assert.fail('another account cannot copy these records'); }
  });
  await page.exportCsv();
  assert.equal(page.data.exporting, false);
  assert.equal(page.data.exportNotice, '');
  assert.equal(removed, 1);
  wx.shareFileMessage = undefined;
  await page.exportCsv();
  storage.set('userInfo', { openid: 'other' });
  await page.copyExportCsv();
  assert.match(page.data.exportNotice, /账号/);
});

test('wizard validates each step, preserves back navigation, creates once and lists local creation time', () => {
  const { wx, messages, writes } = mockWeChat();
  const list = mountPage('tasks', wx);
  assert.equal(list.data.tasks.length, 0);
  list.createTask();
  assert.equal(messages.pop().url, '/pages/imei/create');
  const wizard = mountPage('create', wx);
  const input = (field, value) => wizard.onInput({ currentTarget: { dataset: { field } }, detail: { value } });
  input('name', '   ');
  wizard.next();
  assert.equal(wizard.data.step, 1);
  input('name', ' 到货盘点 ');
  wizard.next();
  wizard.next();
  assert.equal(wizard.data.step, 2);
  input('model', 'iPhone 16');
  wizard.next();
  wizard.previous();
  assert.equal(wizard.data.model, 'iPhone 16');
  wizard.next();
  for (const invalid of ['0', '-1', '2.5', '1e3']) {
    input('total', invalid);
    wizard.next();
    assert.match(wizard.data.error, /正整数/);
  }
  assert.equal(writes.length, 0);
  input('total', '');
  wizard.next();
  wizard.next();
  assert.equal(writes.length, 1);
  const task = writes[0].value;
  assert.equal(task.name, '到货盘点');
  assert.equal(task.model, 'iPhone 16');
  assert.equal(task.total, null);
  assert.equal(task.status, 'active');
  assert.equal(task.owner, 'test-user');
  assert.equal(messages.pop().url, '/pages/imei/imei?id=' + task.id);
  list.onShow();
  assert.match(list.data.tasks[0].createdAt, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  assert.equal(parseTotal('20'), 20);
});

test('resume a task from the list, count complete phones and confirm completion only once', async () => {
  const { wx, messages } = mockWeChat();
  const store = openTaskStore(wx);
  const task = store.create('任务一', 'iPhone', '1');
  const other = store.create('任务二', '三星', '');
  const list = mountPage('tasks', wx);
  list.openTask({ currentTarget: { dataset: { id: task.id, scan: true } } });
  assert.equal(messages.pop().url, '/pages/imei/imei?id=' + task.id + '&scan=1');
  let nextCode = A;
  wx.scanCode = options => options.success({ result: nextCode });
  const first = mountPage('imei', wx, { id: task.id, scan: '1' });
  await first.onReady();
  first.acceptSelected();
  assert.equal(first.data.phoneCount, 0);
  first.onUnload();
  const page = mountPage('imei', wx, { id: task.id, scan: '1' });
  nextCode = B;
  await page.onReady();
  page.acceptSelected();
  assert.equal(page.data.phoneCount, 1);
  assert.equal(store.get(other.id).book.phones.length, 0);
  const prompt = messages.pop();
  assert.match(prompt.title, /达到计划台数/);
  prompt.success({ confirm: false });
  prompt.complete();
  assert.equal(store.get(task.id).status, 'active');
  page.finishTask();
  const confirm = messages.pop();
  confirm.success({ confirm: true });
  confirm.complete();
  assert.equal(store.get(task.id).status, 'completed');
  assert.equal(page.data.completed, true);
  assert.equal(page.commit(imei.emptyBook()), false);
  list.onShow();
  assert.equal(list.data.tasks.find(item => item.id === task.id).status, 'completed');
  const readOnly = mountPage('imei', wx, { id: task.id, scan: '1' });
  wx.scanCode = () => assert.fail('completed task opened scanner');
  await readOnly.onReady();
  await readOnly.scanWithWeChat();
  assert.equal(readOnly.data.history.length, 1);
  let csv;
  wx.env = { USER_DATA_PATH: '/test' };
  wx.getFileSystemManager = () => ({ writeFileSync(path, data) { csv = data; }, unlink() {} });
  wx.shareFileMessage = args => args.success();
  await readOnly.exportCsv();
  assert.match(csv, new RegExp(A));
});

test('manual completion with no target keeps saved partial phone visible and excludes it from completed count', () => {
  const { wx, messages } = mockWeChat();
  const store = openTaskStore(wx);
  const task = store.create('按实际数量采集', 'Pixel', '');
  const page = mountPage('imei', wx, { id: task.id });
  page.addCandidates([A], '手动');
  page.acceptSelected();
  page.addCandidates([B], '手动');
  page.finishTask();
  const prompt = messages.pop();
  assert.match(prompt.content, /部分号码会保留/);
  assert.match(prompt.content, /候选将清除/);
  prompt.success({ confirm: true });
  const reopened = mountPage('imei', wx, { id: task.id });
  assert.equal(reopened.data.phoneCount, 0);
  assert.equal(reopened.data.book.pending[0], A);
  assert.equal(reopened.data.completed, true);
});

test('legacy migration is account scoped, retryable after storage failure and preserves active and completed records', () => {
  const { wx, storage } = mockWeChat();
  const book = imei.acceptBatch(imei.nextGroup(imei.acceptBatch(imei.emptyBook(), [A, B])), [C]);
  storage.set('imei_scan_v1_test-user', book);
  const store = openTaskStore(wx);
  const write = wx.setStorageSync;
  wx.setStorageSync = () => { throw new Error('quota'); };
  assert.throws(() => store.list(), /quota/);
  wx.setStorageSync = write;
  const [legacy] = store.list();
  assert.deepEqual(legacy.book, book);
  assert.equal(store.list().length, 1);
  const second = store.create('另一项', 'iPhone', 2);
  storage.set('userInfo', { openid: 'test-user:other' });
  assert.throws(() => store.get(legacy.id), /账号/);
  const another = openTaskStore(wx);
  assert.equal(another.list().length, 0);
  assert.throws(() => another.get(second.id), /找不到/);
  assert.deepEqual(storage.get('imei_scan_v1_test-user'), book);
});

test('stale task updates cannot overwrite newer scans or reopen completed tasks', () => {
  const { wx } = mockWeChat();
  const store = openTaskStore(wx);
  const original = store.create('分组采集', 'iPhone', '');
  const updated = store.update(original, imei.acceptBatch(original.book, [A]));
  assert.throws(() => store.update(original, original.book), /更新/);
  store.update(updated, updated.book, 'completed');
  assert.throws(() => store.update(updated, imei.emptyBook()), /任务已完成/);
});
