// pages/operationLogs/operationLogs.js
Page({
  data: {
    logs: [],
    cursor: null,
    limit: 20,
    total: 0,
    hasMore: true,
    loading: false,

    // 筛选条件
    filter: {
      logType: '',
      operationType: '',
      operator: '',
      startDate: '',
      endDate: ''
    },

    today: ''
  },

  onLoad() {
    const today = this.formatDate(new Date());
    this.setData({ today });
    this.loadLogs();
  },

  // 加载操作记录
  async loadLogs(isLoadMore = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const { filter, limit, cursor } = this.data;

      const res = await wx.cloud.callFunction({
        name: 'getOperationLogs',
        data: {
          limit,
          cursor: isLoadMore ? cursor : undefined,
          ...filter
        }
      });

      if (res.result.success) {
        const newLogs = res.result.data;
        const logs = isLoadMore ? [...this.data.logs, ...newLogs] : newLogs;

        this.setData({
          logs,
          cursor: res.result.cursor,
          total: res.result.total,
          hasMore: res.result.hasMore,
          loading: false
        });
      } else {
        wx.showToast({ title: res.result.errMsg || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error('加载操作记录失败:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ cursor: null, logs: [], hasMore: true });
    this.loadLogs().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadLogs(true);
    }
  },

  // 筛选条件改变
  onFilterChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`filter.${field}`]: value
    });
  },

  // 日志类型改变
  onLogTypeChange(e) {
    this.setData({
      'filter.logType': e.detail.value
    });
  },

  // 操作类型改变
  onOperationTypeChange(e) {
    this.setData({
      'filter.operationType': e.detail.value
    });
  },

  // 开始日期改变
  onStartDateChange(e) {
    this.setData({
      'filter.startDate': e.detail.value
    });
  },

  // 结束日期改变
  onEndDateChange(e) {
    this.setData({
      'filter.endDate': e.detail.value
    });
  },

  // 查询
  queryLogs() {
    this.setData({ cursor: null, logs: [], hasMore: true });
    this.loadLogs();
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      filter: {
        logType: '',
        operationType: '',
        operator: '',
        startDate: '',
        endDate: ''
      },
      cursor: null,
      logs: [],
      hasMore: true
    });
    this.loadLogs();
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取操作类型文本
  getOperationTypeText(type) {
    const typeMap = {
      'create': '新增',
      'update': '修改',
      'delete': '删除'
    };
    return typeMap[type] || type;
  },

  // 获取日志类型文本
  getLogTypeText(type) {
    const typeMap = {
      'inbound': '入库',
      'outbound': '出库'
    };
    return typeMap[type] || type;
  },

  // 获取操作类型颜色
  getOperationTypeColor(type) {
    const colorMap = {
      'create': '#52c41a',
      'update': '#1890ff',
      'delete': '#ff4d4f'
    };
    return colorMap[type] || '#999';
  }
});
