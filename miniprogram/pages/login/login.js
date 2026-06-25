Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    needInput: false,
    nickname: '',
    avatarUrl: ''
  },

  onLoad() {
    // 检查本地缓存
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo && cachedUserInfo.openid) {
      this.setData({
        userInfo: cachedUserInfo,
        hasUserInfo: true
      });
      // 已登录则跳转到首页
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/index/index'
        });
      }, 500);
      return;
    }

    // 没有缓存，显示登录页面让用户主动点击登录
    // 不再自动调用 checkAndLogin()
  },

  // 用户主动点击登录按钮
  async startLogin() {
    this.checkAndLogin();
  },

  // 检查白名单并登录
  async checkAndLogin() {
    wx.showLoading({ title: '登录中...' });

    try {
      // 先调用登录，不传昵称头像
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      });

      const { isWhitelisted, nickname, avatarUrl, openid } = cloudRes.result;

      console.log("openid = ",openid)
      if (isWhitelisted) {
        // 在白名单中
        if (nickname && avatarUrl) {
          // 数据库已有信息，缓存到本地，但不跳转
          const userInfo = { openid, nickname, avatarUrl };
          wx.setStorageSync('userInfo', userInfo);
          wx.hideLoading();
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/index/index'
            });
          }, 500);
        } else {
          // 数据库没有昵称或头像，让用户填写
          this.setData({
            needInput: true,
            openid
          });
          wx.hideLoading();
        }
      } else {
        // 不在白名单
        wx.hideLoading();
        wx.showModal({
          title: '登录失败',
          content: '您暂无权限使用此小程序',
          showCancel: false,
          confirmText: '我知道了'
        });
      }
    } catch (err) {
      console.error('登录失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    this.setData({
      avatarUrl: e.detail.avatarUrl
    });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  // 提交用户信息
  async submitUserInfo() {
    const { nickname, avatarUrl, openid } = this.data;

    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    if (!avatarUrl) {
      wx.showToast({
        title: '请选择头像',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      // 调用云函数，这次传昵称头像（会保存到数据库）
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          nickname,
          avatarUrl
        }
      });

      if (cloudRes.result.isWhitelisted) {
        const userInfo = {
          openid: cloudRes.result.openid,
          nickname: cloudRes.result.nickname,
          avatarUrl: cloudRes.result.avatarUrl
        };
        this.setData({
          userInfo,
          hasUserInfo: true,
          needInput: false
        });
        wx.setStorageSync('userInfo', userInfo);
        wx.hideLoading();
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/index/index'
          });
        }, 500);
      }
    } catch (err) {
      console.error('保存用户信息失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  onReady() {
    // onLoad 已处理，这里不需要重复处理
  }
});
