Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    needInput: false,
    nickname: '',
    avatarUrl: '',
    openid: '',
    unauthorizedOpenid: '',
    unauthorizedMessage: ''
  },

  onLoad() {
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo && cachedUserInfo.openid) {
      this.setData({
        userInfo: cachedUserInfo,
        hasUserInfo: true
      });
      this.checkAndLogin({ silent: true });
    }
  },

  // 用户主动点击登录按钮
  async startLogin() {
    this.checkAndLogin();
  },

  // 检查白名单并登录
  async checkAndLogin(options = {}) {
    if (!options.silent) {
      wx.showLoading({ title: '登录中...' });
    }

    try {
      // 先调用登录，不传昵称头像
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      });

      const result = cloudRes.result || {};
      const { isAuthorized, isWhitelisted, nickname, avatarUrl, openid, role, actionPermissions, errMsg } = result;

      console.log("openid = ",openid)
      if (isAuthorized || isWhitelisted) {
        // 已在后台授权
        if (nickname && avatarUrl) {
          const userInfo = { openid, nickname, avatarUrl, role, actionPermissions };
          wx.setStorageSync('userInfo', userInfo);
          this.setData({
            userInfo,
            hasUserInfo: true,
            needInput: false,
            unauthorizedOpenid: '',
            unauthorizedMessage: ''
          });
          wx.hideLoading();
          if (!options.silent) {
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            });
          }
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/index/index'
            });
          }, 500);
        } else {
          // 数据库没有昵称或头像，让用户填写
          this.setData({
            needInput: true,
            openid,
            hasUserInfo: false,
            unauthorizedOpenid: '',
            unauthorizedMessage: ''
          });
          wx.hideLoading();
        }
      } else {
        wx.removeStorageSync('userInfo');
        wx.hideLoading();
        this.setData({
          userInfo: null,
          hasUserInfo: false,
          needInput: false,
          openid: openid || '',
          unauthorizedOpenid: openid || '',
          unauthorizedMessage: errMsg || '当前用户暂无小程序访问权限，请联系管理员'
        });
        if (!options.silent) {
          wx.showToast({
            title: '暂无权限',
            icon: 'none'
          });
        }
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

  copyOpenid() {
    const openid = this.data.unauthorizedOpenid || this.data.openid;
    if (!openid) {
      wx.showToast({
        title: '暂无 openid',
        icon: 'none'
      });
      return;
    }
    wx.setClipboardData({
      data: openid,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        });
      }
    });
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

      const result = cloudRes.result || {};
      if (result.isAuthorized || result.isWhitelisted) {
        const userInfo = {
          openid: result.openid,
          nickname: result.nickname,
          avatarUrl: result.avatarUrl,
          role: result.role,
          actionPermissions: result.actionPermissions
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
      } else {
        wx.removeStorageSync('userInfo');
        wx.hideLoading();
        this.setData({
          userInfo: null,
          hasUserInfo: false,
          needInput: false,
          openid: result.openid || openid || '',
          unauthorizedOpenid: result.openid || openid || '',
          unauthorizedMessage: result.errMsg || '当前用户暂无小程序访问权限，请联系管理员'
        });
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
