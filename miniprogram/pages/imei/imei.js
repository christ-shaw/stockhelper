const imei = require('../../utils/imei');
const { openTaskStore, formatTime } = require('../../utils/imei-tasks');
const HISTORY_PAGE_SIZE = 30;

Page({
  data: {
    taskName: '', model: '', total: null, completed: false,
    book: imei.emptyBook(),
    countOptions: imei.countOptions,
    candidates: [],
    selectedCount: 0,
    canRecord: false,
    remaining: 2,
    manualInput: '',
    showManualInput: false,
    showSettings: false,
    wechatScanBusy: false,
    exporting: false,
    exportNotice: '',
    storageError: '',
    status: '',
    duplicateNotice: '',
    history: [],
    historyLimit: HISTORY_PAGE_SIZE,
    phoneCount: 0,
    imeiCount: 0
  },

  onLoad(options = {}) {
    try {
      this.store = openTaskStore(wx);
      if (!this.store) return;
      if (!options.id) { wx.redirectTo({ url: '/pages/imei/tasks' }); return; }
      this.loadTask(options.id);
      this.scanOnReady = options.scan === '1';
    } catch (error) {
      this.setData({ storageError: error.message || '读取本机任务失败，请重新进入页面' });
    }
  },

  loadTask(id) {
    const task = this.store.get(id);
    if (this.task && this.task.revision === task.revision && !this.data.storageError) return;
    if (this.task) this.clearCandidates();
    this.task = task;
    this.setData({ taskName: task.name, model: task.model, total: task.total,
      completed: task.status === 'completed', storageError: '' });
    this.renderBook(task.book);
    if (task.book.pending.length) this.setData({ status: `已恢复本台 ${task.book.pending.length} 个号码` });
    wx.setNavigationBarTitle({ title: task.name });
  },

  onReady() {
    if (this.scanOnReady && this.task && !this.data.completed && !this.data.storageError) {
      return this.data.book.groupComplete ? this.nextGroup() : this.scanWithWeChat();
    }
  },

  onShow() {
    const wasHidden = this.hidden;
    this.hidden = false;
    if (wasHidden && this.task) {
      try { this.loadTask(this.task.id); }
      catch (error) { this.setData({ storageError: error.message || '读取任务失败' }); }
    }
    this.showDuplicateAlert();
  },

  onHide() { this.hidden = true; },

  onUnload() { this.disposed = true; },

  renderBook(book) {
    const limit = this.data.historyLimit;
    const history = book.phones.slice(-limit).map((phone, index) => ({
      ...phone,
      number: Math.max(0, book.phones.length - limit) + index + 1,
      displayTime: formatTime(phone.time)
    })).reverse();
    this.setData({
      book, history, phoneCount: book.phones.length,
      imeiCount: book.phones.reduce((sum, phone) => sum + phone.imeis.length, 0),
      remaining: book.groupComplete ? 0 : book.perPhone - book.pending.length
    });
    this.setCandidates(this.data.candidates);
  },

  commit(book, status = 'active') {
    if (!this.task || this.data.completed || this.data.storageError || this.disposed) return false;
    try {
      this.task = this.store.update(this.task, book, status);
      this.setData({ completed: status === 'completed' });
      this.renderBook(book);
      return true;
    } catch (error) {
      wx.showModal({ title: '保存失败', content: error.message || '请检查微信存储空间后重试', showCancel: false });
      return false;
    }
  },

  finishTask() {
    if (!this.task || this.data.completed || this.finishing || this.data.wechatScanBusy || this.data.exporting) return;
    const { phoneCount, total, book, candidates } = this.data;
    const reached = total !== null && phoneCount >= total;
    let content = `已完成 ${phoneCount} 台。结束后可查看和导出记录。`;
    if (book.pending.length) content += '本台已保存的部分号码会保留，不计入完成台数。';
    if (candidates.length) content += '尚未保存的候选将清除。';
    this.finishing = true;
    wx.showModal({
      title: reached ? '已达到计划台数，完成任务？' : '完成扫码任务？',
      content, confirmText: '完成任务', cancelText: '暂不完成',
      success: result => {
        if (result.confirm && this.commit(this.data.book, 'completed')) this.clearCandidates();
      },
      complete: () => { this.finishing = false; }
    });
  },

  notify(title) { wx.showToast({ title, icon: 'none' }); },

  toggleSettings() {
    this.setData({ showSettings: !this.data.showSettings });
  },

  onCountChange(e) {
    try {
      this.commit(imei.setCount(this.data.book, Number(e.detail.value) + 1));
    } catch (error) { this.notify(error.message); }
  },

  onCheckDigitChange(e) {
    this.commit({ ...this.data.book, checkDigit: e.detail.value });
  },

  setCandidates(candidates) {
    const selected = candidates.filter(item => item.selected);
    const { book, remaining } = this.data;
    const canRecord = !this.data.completed && !book.groupComplete && selected.length > 0 && selected.length <= remaining
      && (!book.checkDigit || selected.every(item => item.checksumValid));
    this.setData({ candidates, selectedCount: selected.length, canRecord, status: '', duplicateNotice: '', exportNotice: '' });
  },

  showDuplicateAlert() {
    if (!this.duplicateAlertPending || this.hidden || this.disposed) return;
    this.duplicateAlertPending = false;
    if (this.data.duplicateNotice && !this.data.storageError) {
      wx.showModal({ title: 'IMEI 号码重复', content: this.data.duplicateNotice, showCancel: false, confirmText: '知道了' });
    }
  },

  addCandidates(values, source) {
    const { book, candidates, remaining } = this.data;
    if (this.data.completed || book.groupComplete || this.data.storageError) return;
    const known = imei.knownValues(book);
    const existing = new Set(candidates.map(item => item.value));
    const duplicates = values.filter(value => known.has(value) || existing.has(value));
    const added = values.filter(value => !known.has(value) && !existing.has(value));
    if (candidates.length + added.length > 24) {
      this.setData({ status: '候选最多 24 条，请逐条采集' });
    } else if (added.length) {
      const selected = candidates.length + added.length <= remaining;
      this.setCandidates([
        ...(selected ? candidates : candidates.map(item => ({ ...item, selected: false }))),
        ...added.map(value => ({ value, source, selected, checksumValid: imei.validChecksum(value) }))
      ]);
    }
    if (duplicates.length) {
      const slots = book.pending.concat(candidates.filter(item => item.selected).map(item => item.value));
      const messages = duplicates.map(value => {
        const slot = slots.indexOf(value);
        if (slot >= 0) return `${value} 已采集为本台 IMEI${slot + 1}。`;
        return existing.has(value) ? `${value} 已在本台候选中。` : `${value} 已在本任务的手机记录中。`;
      });
      const next = book.pending.length + this.data.selectedCount + 1;
      messages.push(next <= book.perPhone && this.data.candidates.length < remaining
        ? `请${source === '手动' ? '输入' : '扫描'}本台的 IMEI${next}。` : '请核对本台候选号码。');
      this.setData({ duplicateNotice: messages.join('\n'), status: '' });
      this.duplicateAlertPending = true;
      this.showDuplicateAlert();
    }
  },

  toggleCandidate(e) {
    const value = e.currentTarget.dataset.value;
    this.setCandidates(this.data.candidates.map(item => item.value === value ? { ...item, selected: !item.selected } : item));
  },

  removeCandidate(e) {
    this.setCandidates(this.data.candidates.filter(item => item.value !== e.currentTarget.dataset.value));
  },

  moveCandidateUp(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index <= 0 || index >= this.data.candidates.length) return;
    const candidates = this.data.candidates.slice();
    [candidates[index - 1], candidates[index]] = [candidates[index], candidates[index - 1]];
    this.setCandidates(candidates);
  },

  clearCandidates() { this.setCandidates([]); },

  onManualInput(e) { this.setData({ manualInput: e.detail.value }); },

  toggleManualInput() {
    this.setData({ showManualInput: !this.data.showManualInput });
  },

  addManual() {
    const value = this.data.manualInput.trim();
    if (!imei.validFormat(value)) { this.notify('请输入完整的 15 位数字'); return; }
    this.addCandidates([value], '手动');
    this.setData({ manualInput: '' });
  },

  async scanWithWeChat() {
    const { book, candidates, remaining, wechatScanBusy, exporting, storageError } = this.data;
    if (wechatScanBusy || exporting || storageError || !this.task || this.data.completed || book.groupComplete
      || candidates.length >= remaining || this.hidden || this.disposed) return;
    if (!wx.scanCode) { this.setData({ status: '当前微信无法打开扫一扫，请手动输入 IMEI' }); return; }
    this.setData({ wechatScanBusy: true });
    try {
      const scan = await new Promise((resolve, reject) => wx.scanCode({
        onlyFromCamera: false, scanType: ['barCode'], success: resolve, fail: reject
      }));
      // The native view can deliver its result before the page's onShow event.
      if (this.disposed || this.data.storageError || this.data.completed || this.data.book.groupComplete || this.data.book.phones.length !== book.phones.length
        || this.data.candidates.length >= this.data.remaining) return;
      const values = imei.extractBarcode(scan.result);
      if (!values.length) {
        this.setData({ status: /^\d{32}$/.test(scan.result) ? '扫到的是 EID，请扫 IMEI 或 IMEI2 下方的条码'
          : '未读到完整的 15 位 IMEI，请重新选择条码' });
        return;
      }
      this.addCandidates(values, '微信扫一扫');
    } catch (error) {
      if (!this.disposed && !/cancel|取消/i.test(error.errMsg || error.message || '')) {
        this.setData({ status: '微信扫一扫未成功，请重试或手动输入' });
      }
    } finally {
      if (!this.disposed) this.setData({ wechatScanBusy: false });
    }
  },

  acceptSelected() {
    if (this.data.wechatScanBusy || !this.data.canRecord) return;
    const values = this.data.candidates.filter(item => item.selected).map(item => item.value);
    try {
      const book = imei.acceptBatch(this.data.book, values);
      if (!this.commit(book)) return;
      this.setCandidates(book.groupComplete ? [] : this.data.candidates.filter(item => !values.includes(item.value)));
      if (!book.groupComplete) {
        this.setData({ status: `已保存 ${book.pending.length} 个，本台还需 ${book.perPhone - book.pending.length} 个 IMEI` });
      }
      wx.vibrateShort({ type: 'light' });
      if (book.groupComplete && this.data.phoneCount === this.data.total) this.finishTask();
    } catch (error) { this.notify(error.message); }
  },

  nextGroup() {
    if (this.data.exporting || this.data.wechatScanBusy || !this.data.book.groupComplete) return;
    try {
      if (!this.commit(imei.nextGroup(this.data.book))) return;
      this.setData({ manualInput: '', showManualInput: false });
      return this.scanWithWeChat();
    } catch (error) { this.notify(error.message); }
  },

  undoLast() {
    if (this.data.wechatScanBusy || this.data.exporting) return;
    wx.showModal({
      title: '撤销最后一个 IMEI',
      content: this.data.book.pending.length ? '撤销本台最后录入的号码，其他号码保留。' : '将最近一台恢复为未完成状态，并移除它的最后一个 IMEI。',
      success: result => {
        if (!result.confirm) return;
        try {
          if (!this.commit({ ...imei.undo(this.data.book), currentModel: this.task.model })) return;
          this.clearCandidates();
          this.setData({ status: '已撤销，请继续核对当前手机' });
        } catch (error) { this.notify(error.message); }
      }
    });
  },

  editPhoneModel(e) {
    const id = e.currentTarget.dataset.id;
    const phone = this.data.book.phones.find(item => item.id === id);
    if (!phone) return;
    wx.showModal({
      title: '修改这台手机的型号', editable: true, content: phone.model, placeholderText: '例如：三星 S20 128GB',
      success: result => {
        if (!result.confirm) return;
        const phones = this.data.book.phones.map(item => item.id === id ? { ...item, model: (result.content || '').trim() } : item);
        this.commit({ ...this.data.book, phones });
      }
    });
  },

  showMoreHistory() {
    this.setData({ historyLimit: this.data.historyLimit + HISTORY_PAGE_SIZE });
    this.renderBook(this.data.book);
  },

  clearBook() {
    if (this.data.wechatScanBusy || this.data.exporting) return;
    wx.showModal({
      title: '清空本任务采集记录',
      content: `将删除 ${this.data.phoneCount} 台已完成记录和本台未完成号码，无法撤销。请先导出 CSV。`,
      confirmText: '确认清空', confirmColor: '#d14343',
      success: result => {
        if (!result.confirm) return;
        const book = { ...imei.emptyBook(), perPhone: this.data.book.perPhone, currentModel: this.data.book.currentModel, checkDigit: this.data.book.checkDigit };
        if (!this.commit(book)) return;
        this.clearCandidates();
        this.setData({ manualInput: '', historyLimit: HISTORY_PAGE_SIZE, status: '采集记录已清空，可以开始新批次' });
      }
    });
  },

  dismissExportNotice() { this.setData({ exportNotice: '' }); },

  exportCsv() {
    if (this.data.exporting || !this.data.phoneCount || this.data.wechatScanBusy || this.data.storageError) return;
    if (!this.data.exportNotice && (this.data.book.pending.length || this.data.candidates.length)) {
      this.setData({ exportNotice: `本次只导出已完成的 ${this.data.phoneCount} 台，未完成的号码会留在任务中。` });
      return;
    }
    return this.deliverCsv(false);
  },

  copyExportCsv() {
    if (this.data.exportNotice) return this.deliverCsv(true);
  },

  async deliverCsv(copy) {
    if (this.disposed || this.hidden || !this.task || this.data.storageError || this.data.exporting
      || this.data.wechatScanBusy || !this.data.phoneCount) return;
    this.setData({ exporting: true });
    let fs, filePath;
    let stage = '读取任务';
    try {
      const latest = this.store.get(this.task.id);
      if (latest.revision !== this.task.revision) {
        this.loadTask(latest.id);
        this.setData({ exportNotice: '任务记录已更新，请核对后重新导出已完成的手机。' });
        return;
      }
      stage = 'CSV 生成';
      const csv = imei.toCsv(latest.book);
      if (copy) {
        stage = 'CSV 复制';
        if (!wx.setClipboardData) throw new Error('当前客户端未提供剪贴板接口');
        await new Promise((resolve, reject) => wx.setClipboardData({ data: csv, success: resolve, fail: reject }));
      } else {
        const platform = wx.getDeviceInfo ? wx.getDeviceInfo().platform : '';
        const saveToDisk = (platform === 'windows' || platform === 'mac') && typeof wx.saveFileToDisk === 'function';
        stage = saveToDisk ? '保存文件' : '分享文件';
        if (!saveToDisk && !wx.shareFileMessage) throw new Error('当前客户端未提供文件分享接口，可选择复制 CSV');
        stage = 'CSV 文件写入';
        if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) throw new Error('本机文件目录不可用');
        fs = wx.getFileSystemManager();
        const fileName = `IMEI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.csv`;
        filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
        // Open the native dialog in the same tap that authorizes the export.
        fs.writeFileSync(filePath, csv, 'utf8');
        stage = saveToDisk ? '保存文件' : '分享文件';
        await new Promise((resolve, reject) => {
          const options = { filePath, success: resolve, fail: reject };
          if (saveToDisk) wx.saveFileToDisk(options);
          else wx.shareFileMessage({ ...options, fileName });
        });
      }
      if (!this.disposed) this.dismissExportNotice();
    } catch (error) {
      if (!this.disposed) {
        const detail = error && (error.errMsg || error.message) || String(error || '');
        const code = error && (error.errCode || error.errno);
        if (/cancel|取消/i.test(detail)) this.dismissExportNotice();
        else this.setData({ exportNotice: `${stage}失败。${detail || '微信未返回具体原因'}${code ? '（' + code + '）' : ''}` });
      }
    } finally {
      if (filePath && fs) {
        try { fs.unlink({ filePath, fail: () => {} }); } catch (_) { /* Best-effort cleanup of this export only. */ }
      }
      if (!this.disposed) this.setData({ exporting: false });
    }
  }
});
