Page({
  data: {
    pendingOutboundTotal: 0,
    pendingOutboundLoading: false
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    if (this.checkLogin()) {
      this.loadPendingOutboundOrders();
    }
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      // 未登录则跳转到登录页
      wx.reLaunch({
        url: '/pages/login/login' 
      });
      return false;
    }
    return true;
  },

  async loadPendingOutboundOrders() {
    if (this.data.pendingOutboundLoading) return;

    this.setData({ pendingOutboundLoading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'queryRecords',
        data: {
          data: {
            type: 'outbound',
            pendingOnly: true,
            limit: 1,
            cursor: null
          }
        }
      });

      if (res.result && res.result.success) {
        this.setData({
          pendingOutboundTotal: res.result.total || 0,
          pendingOutboundLoading: false
        });
      } else {
        this.setData({ pendingOutboundLoading: false });
      }
    } catch (e) {
      console.error('加载待处理出库单失败:', e);
      this.setData({ pendingOutboundLoading: false });
    }
  },

  stayOnPage() {
    // 保持在当前页面
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  goToInbound() {
    wx.navigateTo({
      url: '/pages/inbound/inbound'
    });
  },

  goToOutbound() {
    wx.navigateTo({
      url: '/pages/outbound/outbound'
    });
  },

  goToQuery() {
    wx.navigateTo({
      url: '/pages/query/query'
    });
  },

  goToPendingOutbound() {
    wx.navigateTo({
      url: '/pages/query/query?tab=outbound&pending=1&outboundOnly=1'
    });
  },

  goToDashboard() {
    wx.navigateTo({
      url: '/pages/dashboard/dashboard'
    });
  }
});
