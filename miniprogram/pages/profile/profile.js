Page({
  data: {
    userInfo: null,
    debugInfo: ''
  },

  onLoad() {
    this.checkAuth();
  },

  onShow() {
    this.checkAuth();
  },

  checkAuth() {
    const userInfo = wx.getStorageSync('userInfo');

    // 调试信息
    console.log('Profile - 读取到的 userInfo:', userInfo);
    console.log('Profile - userInfo 对象结构:', JSON.stringify(userInfo, null, 2));

    if (!userInfo) {
      // 未登录则跳转到登录页
      wx.reLaunch({
        url: '/pages/login/login'
      });
      return;
    }

    this.setData({
      userInfo,
      debugInfo: `openid: ${userInfo.openid}\nnickname: ${userInfo.nickname}\navatarUrl: ${userInfo.avatarUrl}`
    });
  },

  // 调试：显示用户信息
  showDebugInfo() {
    wx.showModal({
      title: '用户信息',
      content: this.data.debugInfo || '无数据',
      showCancel: false
    });
  },

  // 调试：重新获取用户信息
  async refreshUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      });

      console.log('Profile - 云函数返回:', res.result);

      if (res.result && (res.result.isAuthorized || res.result.isWhitelisted)) {
        const userInfo = {
          openid: res.result.openid,
          nickname: res.result.nickname,
          avatarUrl: res.result.avatarUrl,
          role: res.result.role,
          actionPermissions: res.result.actionPermissions
        };

        wx.setStorageSync('userInfo', userInfo);
        this.setData({ userInfo });

        wx.showToast({
          title: '刷新成功',
          icon: 'success'
        });
      }
    } catch (err) {
      console.error('刷新失败:', err);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    }
  },

  stayOnPage() {
    // 保持在当前页面
  },

  goToIndex() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          this.setData({ userInfo: null });
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          // 跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  },

  goToAbout() {
    wx.showModal({
      title: '关于',
      content: '库存助手 v1.0.0\n专业的库存管理工具',
      showCancel: false
    });
  }
});
