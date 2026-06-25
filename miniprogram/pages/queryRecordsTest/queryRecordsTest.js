Page({
  data: {
    hasIssueFilter: 'all', // all, true, false
    limit: 20,
    customerName: '',
    trackingNumber: '',
    model: '',
    startDate: '',
    endDate: '',
    queryResults: [],
    cursor: null,
    hasMore: false,
    total: 0,
    currentPage: 1,
    hasPrev: false,
    hasNext: false,
    hasData: false,
    hasSearched: false,
    loading: false
  },

  // 选择 hasIssue 过滤条件
  selectHasIssue(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ hasIssueFilter: value });
  },

  // 输入框事件
  onLimitInput(e) {
    this.setData({ limit: parseInt(e.detail.value) || 20 });
  },

  onCustomerNameInput(e) {
    this.setData({ customerName: e.detail.value });
  },

  onTrackingNumberInput(e) {
    this.setData({ trackingNumber: e.detail.value });
  },

  onModelInput(e) {
    this.setData({ model: e.detail.value });
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
  },

  // 测试查询记录
  testQueryRecords() {
    if (this.data.loading) return;

    this.setData({
      loading: true,
      currentPage: 1,
      cursor: null,
      hasPrev: false
    });

    // 构建 hasIssue 参数
    let hasIssue = undefined;
    if (this.data.hasIssueFilter === 'true') {
      hasIssue = true;
    } else if (this.data.hasIssueFilter === 'false') {
      hasIssue = false;
    }

    // 构建查询参数
    const params = {
      type: 'inbound',
      limit: this.data.limit,
      cursor: null
    };

    // 添加可选参数
    if (hasIssue !== undefined) {
      params.hasIssue = hasIssue;
    }
    if (this.data.customerName.trim()) {
      params.customerName = this.data.customerName.trim();
    }
    if (this.data.trackingNumber.trim()) {
      params.trackingNumber = this.data.trackingNumber.trim();
    }
    if (this.data.model.trim()) {
      params.model = this.data.model.trim();
    }
    if (this.data.startDate) {
      params.startDate = this.data.startDate;
    }
    if (this.data.endDate) {
      params.endDate = this.data.endDate;
    }

    console.log('查询参数:', params);

    wx.cloud.callFunction({
      name: 'queryRecords',
      data: { data: params }
    }).then(res => {
      const result = res.result;
      console.log('查询结果:', result);

      if (result.success) {
        this.setData({
          queryResults: result.data || [],
          cursor: result.cursor,
          hasMore: result.hasMore,
          total: result.data ? result.data.length : 0,
          hasNext: result.hasMore,
          hasData: true,
          hasSearched: true,
          loading: false
        });

        wx.showToast({
          title: `查询到 ${result.data ? result.data.length : 0} 条记录`,
          icon: 'none',
          duration: 2000
        });
      } else {
        this.setData({
          queryResults: [],
          hasData: false,
          loading: false
        });
        wx.showToast({
          title: result.errMsg || '查询失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('查询失败:', err);
      this.setData({
        queryResults: [],
        hasData: false,
        loading: false
      });
      wx.showToast({
        title: err.errMsg || err.message || '查询失败',
        icon: 'none'
      });
    });
  },

  // 上一页
  prevPage() {
    if (this.data.currentPage <= 1 || this.data.loading) return;

    this.setData({
      loading: true,
      currentPage: this.data.currentPage - 1
    });

    // 计算上一页的 cursor
    const prevCursor = Math.max(0, (this.data.currentPage - 1) * this.data.limit - this.data.limit);

    this.loadPage(prevCursor);
  },

  // 下一页
  nextPage() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({
      loading: true,
      currentPage: this.data.currentPage + 1
    });

    this.loadPage(this.data.cursor);
  },

  // 加载指定页
  loadPage(cursor) {
    // 构建 hasIssue 参数
    let hasIssue = undefined;
    if (this.data.hasIssueFilter === 'true') {
      hasIssue = true;
    } else if (this.data.hasIssueFilter === 'false') {
      hasIssue = false;
    }

    // 构建查询参数
    const params = {
      type: 'inbound',
      limit: this.data.limit,
      cursor: cursor
    };

    // 添加可选参数
    if (hasIssue !== undefined) {
      params.hasIssue = hasIssue;
    }
    if (this.data.customerName.trim()) {
      params.customerName = this.data.customerName.trim();
    }
    if (this.data.trackingNumber.trim()) {
      params.trackingNumber = this.data.trackingNumber.trim();
    }
    if (this.data.model.trim()) {
      params.model = this.data.model.trim();
    }
    if (this.data.startDate) {
      params.startDate = this.data.startDate;
    }
    if (this.data.endDate) {
      params.endDate = this.data.endDate;
    }

    console.log('分页查询参数:', params);

    wx.cloud.callFunction({
      name: 'queryRecords',
      data: { data: params }
    }).then(res => {
      const result = res.result;
      console.log('分页查询结果:', result);

      if (result.success) {
        this.setData({
          queryResults: result.data || [],
          cursor: result.cursor,
          hasMore: result.hasMore,
          total: result.data ? result.data.length : 0,
          hasNext: result.hasMore,
          hasPrev: this.data.currentPage > 1,
          loading: false
        });
      } else {
        this.setData({ loading: false });
        wx.showToast({
          title: result.errMsg || '查询失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('分页查询失败:', err);
      this.setData({ loading: false });
      wx.showToast({
        title: err.errMsg || err.message || '查询失败',
        icon: 'none'
      });
    });
  },

  // 重置过滤条件
  resetFilters() {
    this.setData({
      hasIssueFilter: 'all',
      limit: 20,
      customerName: '',
      trackingNumber: '',
      model: '',
      startDate: '',
      endDate: '',
      queryResults: [],
      cursor: null,
      hasMore: false,
      total: 0,
      currentPage: 1,
      hasPrev: false,
      hasNext: false,
      hasData: false,
      hasSearched: false
    });
  },

  // 清空查询结果
  clearResults() {
    this.setData({
      queryResults: [],
      cursor: null,
      hasMore: false,
      total: 0,
      currentPage: 1,
      hasPrev: false,
      hasNext: false,
      hasData: false
    });
  },

  // 格式化时间
  formatTime(time) {
    if (!time) return '';
    if (time.$date) {
      time = new Date(time.$date);
    } else if (typeof time === 'string') {
      time = new Date(time);
    }
    const year = time.getFullYear();
    const month = String(time.getMonth() + 1).padStart(2, '0');
    const day = String(time.getDate()).padStart(2, '0');
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
});
