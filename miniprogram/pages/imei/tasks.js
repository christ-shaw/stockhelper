const { openTaskStore, formatTime } = require('../../utils/imei-tasks');

Page({
  data: { tasks: [], error: '' },

  onShow() {
    try {
      const store = openTaskStore(wx);
      if (!store) { this.setData({ tasks: [] }); return; }
      const tasks = store.list().map(task => ({
        id: task.id, name: task.name, status: task.status, createdAt: formatTime(task.createdAt)
      }));
      this.setData({ tasks, error: '' });
    } catch (error) {
      this.setData({ tasks: [], error: error.message || '读取本机任务失败，请重新进入页面' });
    }
  },

  createTask() { wx.navigateTo({ url: '/pages/imei/create' }); },

  openTask(event) {
    const { id, scan } = event.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/imei/imei?id=' + encodeURIComponent(id) + (scan ? '&scan=1' : '') });
  }
});
