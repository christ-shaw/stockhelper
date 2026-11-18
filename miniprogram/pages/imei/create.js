const { openTaskStore } = require('../../utils/imei-tasks');
const { countOptions } = require('../../utils/imei');

Page({
  data: { step: 1, name: '', model: '', perPhone: null, countOptions, total: '', error: '', submitting: false, createdId: '' },

  onLoad() { this.store = openTaskStore(wx); },

  onInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value, error: '' });
  },

  previous() {
    if (this.data.step > 1 && !this.data.submitting) this.setData({ step: this.data.step - 1, error: '' });
  },

  chooseCount(event) {
    const perPhone = Number(event.currentTarget.dataset.count);
    if (countOptions.includes(perPhone)) this.setData({ perPhone, error: '' });
  },

  next() {
    if (!this.store || this.data.submitting) return;
    try {
      this.store.checkAccount();
      const { name, model, perPhone, total, step } = this.data;
      if (!name.trim()) throw new Error('请输入任务名称');
      if (step > 1 && !model.trim()) throw new Error('请输入手机型号');
      if (step >= 3 && !countOptions.includes(perPhone)) throw new Error('请选择每台手机需要录入的 IMEI 数量');
      if (step < 4) { this.setData({ step: step + 1, error: '' }); return; }
      this.setData({ submitting: true, error: '' });
      // Retry navigation without creating a duplicate if the detail page failed to open.
      if (!this.data.createdId) this.setData({ createdId: this.store.create(name, model, total, perPhone).id });
      wx.redirectTo({ url: '/pages/imei/imei?id=' + encodeURIComponent(this.data.createdId),
        fail: () => this.setData({ submitting: false, error: '任务已创建，可重新打开详情或返回列表查看' })
      });
    } catch (error) {
      this.setData({ submitting: false, error: error.message || '创建任务失败，请重试' });
    }
  }
});
