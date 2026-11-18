const imei = require('./imei');

function formatTime(time) {
  const date = new Date(time);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseTotal(input) {
  const text = String(input == null ? '' : input).trim();
  if (!text) return null;
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 1) throw new Error('手机数量请输入正整数，或留空');
  return value;
}

// Keep each task and its scan book in one storage entry so progress changes are atomic.
function openTaskStore(api) {
  const user = api.getStorageSync('userInfo');
  if (!user || !user.openid) {
    api.reLaunch({ url: '/pages/login/login' });
    return null;
  }
  const owner = user.openid;
  const prefix = `imei_task_v1_${encodeURIComponent(owner)}:`;
  function checkAccount() {
    const active = api.getStorageSync('userInfo');
    if (!active || active.openid !== owner) throw new Error('登录账号已更换，请返回任务列表');
  }
  function get(id) {
    checkAccount();
    const task = api.getStorageSync(prefix + id);
    if (!task) throw new Error('当前账号下找不到此任务');
    if (task.owner !== owner || task.id !== id || !Number.isSafeInteger(task.revision)
      || typeof task.name !== 'string' || typeof task.model !== 'string' || !Number.isFinite(Date.parse(task.createdAt))
      || (task.total !== null && (!Number.isSafeInteger(task.total) || task.total < 1))
      || !['active', 'completed'].includes(task.status) || !imei.validateBook(task.book)) {
      throw new Error('任务记录格式异常，请保留本机数据并联系管理员');
    }
    return task;
  }
  function writeNew(id, name, model, total, book) {
    const task = { id, owner, name, model, total, book, createdAt: new Date().toISOString(), status: 'active', revision: 1 };
    api.setStorageSync(prefix + id, task);
    return task;
  }
  function list() {
    checkAccount();
    const ids = api.getStorageInfoSync().keys.filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
    if (!ids.includes('legacy')) {
      const legacy = api.getStorageSync('imei_scan_v1_' + owner);
      if (legacy !== '' && legacy != null) {
        if (!imei.validateBook(legacy)) throw new Error('旧采集记录格式异常，请保留本机数据并联系管理员');
        if (legacy.phones.length || legacy.pending.length || legacy.currentModel || legacy.checkDigit || legacy.perPhone !== 2) {
          writeNew('legacy', '历史采集记录', legacy.currentModel, null, legacy);
          ids.push('legacy');
        }
      }
    }
    return ids.map(get).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  function create(name, model, quantity, perPhone) {
    checkAccount();
    name = name.trim();
    model = model.trim();
    if (!name) throw new Error('请输入任务名称');
    if (!model) throw new Error('请输入手机型号');
    const total = parseTotal(quantity);
    const book = imei.setCount(imei.emptyBook(), perPhone);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    if (api.getStorageSync(prefix + id)) throw new Error('创建失败，请重试');
    return writeNew(id, name, model, total, { ...book, currentModel: model });
  }
  function update(previous, book, status = 'active') {
    const task = get(previous.id);
    if (task.status === 'completed') throw new Error('任务已完成');
    if (task.revision !== previous.revision) throw new Error('任务记录已更新，请返回任务列表后重新进入');
    if (!imei.validateBook(book)) throw new Error('采集记录格式异常');
    const next = { ...task, status, book, revision: task.revision + 1 };
    api.setStorageSync(prefix + task.id, next);
    return next;
  }
  return { list, get, create, update, checkAccount };
}

module.exports = { openTaskStore, formatTime, parseTotal };
