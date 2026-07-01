function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasTrackingNumber(record) {
  return trimString(record && record.trackingNumber) !== '';
}

function getOutboundStatusInfo(record) {
  const isCompleted = record.outboundStatus === 'completed' || hasTrackingNumber(record);

  if (isCompleted) {
    return {
      outboundStatusText: '已出库',
      outboundStatusClass: 'status-done'
    };
  }

  return {
    outboundStatusText: '未出库',
    outboundStatusClass: 'status-pending'
  };
}

Page({
  data: {
    activeTab: 'inbound',
    today: '',
    inboundFilter: {
      customerName: '',
      trackingNumber: '',
      startDate: '',
      endDate: ''
    },
    outboundFilter: {
      customerName: '',
      startDate: '',
      endDate: ''
    },
    outboundPendingOnly: false,
    outboundOnly: false,
    showInboundFilters: false,
    showOutboundFilters: false,
    inboundRecords: [],
    outboundRecords: [],
    inboundCursor: null,
    outboundCursor: null,
    inboundHasMore: true,
    outboundHasMore: true,
    inboundLoading: false,
    outboundLoading: false,
    showDetail: false,
    detailRecord: {},
    detailTrackingNumber: '',
    detailShipPhotos: [],
    completingOutbound: false
  },

  onLoad(options = {}) {
    this.checkAuth();
    this.initCloud();
    this.setData({
      today: this.formatDate(new Date()),
      activeTab: options.tab === 'outbound' ? 'outbound' : 'inbound',
      outboundPendingOnly: options.pending === '1',
      outboundOnly: options.outboundOnly === '1',
      showInboundFilters: false,
      showOutboundFilters: false
    }, () => {
      if (this.data.activeTab === 'outbound') {
        this.queryOutbound();
      } else {
        this.queryInbound();
      }
    });
    if (options.outboundOnly === '1') {
      wx.setNavigationBarTitle({
        title: options.pending === '1' ? '待处理出库单' : '出库记录'
      });
    }
  },

  checkAuth() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  initCloud() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      const app = getApp();
      wx.cloud.init({
        env: app.globalData && app.globalData.env,
        traceUser: true
      });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab }, () => {
      if (tab === 'inbound' && this.data.inboundRecords.length === 0) {
        this.queryInbound();
      }
      if (tab === 'outbound' && this.data.outboundRecords.length === 0) {
        this.queryOutbound();
      }
    });
  },

  onInboundFilterInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`inboundFilter.${field}`]: value
    });
  },

  onStartDateChange(e) {
    this.setData({
      'inboundFilter.startDate': e.detail.value
    });
  },

  onEndDateChange(e) {
    this.setData({
      'inboundFilter.endDate': e.detail.value
    });
  },

  onOutboundFilterInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`outboundFilter.${field}`]: value
    });
  },

  onOutboundStartDateChange(e) {
    this.setData({
      'outboundFilter.startDate': e.detail.value
    });
  },

  onOutboundEndDateChange(e) {
    this.setData({
      'outboundFilter.endDate': e.detail.value
    });
  },

  toggleInboundFilters() {
    this.setData({
      showInboundFilters: !this.data.showInboundFilters
    });
  },

  toggleOutboundFilters() {
    this.setData({
      showOutboundFilters: !this.data.showOutboundFilters
    });
  },

  async queryInbound(isLoadMore = false) {
    isLoadMore = isLoadMore === true;
    if (!isLoadMore) {
      wx.showLoading({ title: '查询中...' });
    }
    this.setData({
      inboundLoading: true,
      inboundCursor: isLoadMore ? this.data.inboundCursor : null,
      inboundHasMore: true,
      inboundRecords: isLoadMore ? this.data.inboundRecords : []
    });

    try {
      const filter = this.data.inboundFilter;
      const res = await wx.cloud.callFunction({
        name: 'queryRecords',
        data: {
          data: {
            type: 'inbound',
            customerName: filter.customerName,
            trackingNumber: filter.trackingNumber,
            startDate: filter.startDate,
            endDate: filter.endDate,
            limit: 20,
            cursor: isLoadMore ? this.data.inboundCursor : null
          }
        }
      });

      if (res.result.success) {
        const records = res.result.data.map(record => {
          const phoneTotal = record.phoneModels && record.phoneModels.length > 0
            ? record.phoneModels.reduce((sum, phone) => sum + (phone.quantity || 0), 0)
            : 0;
          return {
            ...record,
            phoneTotal,
            packagePhotos: record.packagePhotos || [],
            phonePhotos: record.phonePhotos || []
          };
        });

        this.setData({
          inboundRecords: isLoadMore ? [...this.data.inboundRecords, ...records] : records,
          inboundCursor: res.result.cursor,
          inboundHasMore: res.result.hasMore,
          inboundLoading: false
        });

        if (!isLoadMore) {
          wx.hideLoading();
          wx.showToast({ title: `查询到${records.length}条记录`, icon: 'success' });
        }
      } else {
        this.setData({ inboundLoading: false });
        if (!isLoadMore) {
          wx.hideLoading();
          wx.showToast({ title: res.result.errMsg || '查询失败', icon: 'none' });
        }
      }
    } catch (e) {
      console.error('查询失败:', e);
      this.setData({ inboundLoading: false });
      if (!isLoadMore) {
        wx.hideLoading();
        wx.showToast({ title: '查询失败，请重试', icon: 'none' });
      }
    }
  },

  async queryOutbound(isLoadMore = false) {
    isLoadMore = isLoadMore === true;
    if (!isLoadMore) {
      wx.showLoading({ title: '查询中...' });
    }
    this.setData({
      outboundLoading: true,
      outboundCursor: isLoadMore ? this.data.outboundCursor : null,
      outboundHasMore: true,
      outboundRecords: isLoadMore ? this.data.outboundRecords : []
    });

    try {
      const filter = this.data.outboundFilter;
      const res = await wx.cloud.callFunction({
        name: 'queryRecords',
        data: {
          data: {
            type: 'outbound',
            customerName: filter.customerName,
            startDate: filter.startDate,
            endDate: filter.endDate,
            pendingOnly: this.data.outboundPendingOnly,
            limit: 20,
            cursor: isLoadMore ? this.data.outboundCursor : null
          }
        }
      });

      if (res.result.success) {
        const rawRecords = res.result.data || [];
        const records = rawRecords.map(record => {
          const phoneTotal = record.phoneModels && record.phoneModels.length > 0
            ? record.phoneModels.reduce((sum, phone) => sum + (phone.quantity || 0), 0)
            : 0;
          const statusInfo = getOutboundStatusInfo(record);
          return {
            ...record,
            phoneTotal,
            phonePhotos: record.phonePhotos || [],
            displayName: record.customerName || record.consignee || record.receiverName || '未填写客户',
            ...statusInfo
          };
        });

        this.setData({
          outboundRecords: isLoadMore ? [...this.data.outboundRecords, ...records] : records,
          outboundCursor: res.result.cursor,
          outboundHasMore: res.result.hasMore,
          outboundLoading: false
        });

        if (!isLoadMore) {
          wx.hideLoading();
          wx.showToast({ title: `查询到${records.length}条记录`, icon: 'success' });
        }
      } else {
        this.setData({ outboundLoading: false });
        if (!isLoadMore) {
          wx.hideLoading();
          wx.showToast({ title: res.result.errMsg || '查询失败', icon: 'none' });
        }
      }
    } catch (e) {
      console.error('查询失败:', e);
      this.setData({ outboundLoading: false });
      if (!isLoadMore) {
        wx.hideLoading();
        wx.showToast({ title: '查询失败，请重试', icon: 'none' });
      }
    }
  },

  resetInboundFilter() {
    this.setData({
      inboundFilter: {
        customerName: '',
        trackingNumber: '',
        startDate: '',
        endDate: ''
      },
      inboundRecords: [],
      inboundCursor: null,
      inboundHasMore: true
    });
  },

  resetOutboundFilter() {
    const keepPendingOnly = this.data.outboundOnly && this.data.outboundPendingOnly;
    this.setData({
      outboundFilter: {
        customerName: '',
        startDate: '',
        endDate: ''
      },
      outboundPendingOnly: keepPendingOnly,
      outboundRecords: [],
      outboundCursor: null,
      outboundHasMore: true
    });
  },

  clearOutboundPendingFilter() {
    this.setData({
      outboundPendingOnly: false,
      outboundRecords: [],
      outboundCursor: null,
      outboundHasMore: true
    });
    this.queryOutbound();
  },

  loadMoreInbound() {
    if (this.data.inboundLoading || !this.data.inboundHasMore) return;
    this.queryInbound(true);
  },

  loadMoreOutbound() {
    if (this.data.outboundLoading || !this.data.outboundHasMore) return;
    this.queryOutbound(true);
  },

  async viewInboundDetail(e) {
    wx.showLoading({ title: '加载中...' });
    const index = e.currentTarget.dataset.index;
    const record = this.data.inboundRecords[index];

    console.log('原始记录:', record);
    console.log('shopName:', record.shopName);
    console.log('type:', record.type);

    // 处理类型显示
    let typeText = '';
    if (record.type === 'return') {
      typeText = '归还';
    } else if (record.type === 'afterSale') {
      typeText = '售后';
    } else if (record.type === 'purchase') {
      typeText = '采购';
    } else if (record.type === 'recycle') {
      typeText = '回购';
    }

    console.log('typeText:', typeText);

    const processedRecord = await this.processPhotos(record);
    processedRecord.typeText = typeText;

    console.log('处理后的记录:', processedRecord);

    this.setData({
      detailRecord: processedRecord,
      showDetail: true
    }, () => {
      console.log('设置后的 detailRecord:', this.data.detailRecord);
    });
    wx.hideLoading();
  },

  async viewOutboundDetail(e) {
    wx.showLoading({ title: '加载中...' });
    const index = e.currentTarget.dataset.index;
    const record = this.data.outboundRecords[index];
    const processedRecord = await this.processPhotos(record);
    this.setData({
      detailRecord: processedRecord,
      detailTrackingNumber: processedRecord.trackingNumber || '',
      detailShipPhotos: [],
      showDetail: true
    });
    wx.hideLoading();
  },

  closeDetail() {
    this.setData({
      showDetail: false,
      detailTrackingNumber: '',
      detailShipPhotos: []
    });
  },

  onDetailTrackingInput(e) {
    this.setData({
      detailTrackingNumber: e.detail.value
    });
  },

  // 扫码录入快递单号
  scanDetailTracking() {
    wx.scanCode({
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        this.setData({ detailTrackingNumber: res.result });
        wx.showToast({ title: '扫码成功', icon: 'success' });
      },
      fail: (err) => {
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({ title: '扫码失败', icon: 'none' });
        }
      }
    });
  },

  // 拍摄/选择发货照片
  chooseShipPhotos() {
    const current = this.data.detailShipPhotos || [];
    const maxCount = 9 - current.length;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张照片', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ detailShipPhotos: [...current, ...res.tempFilePaths] });
      }
    });
  },

  deleteShipPhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = [...this.data.detailShipPhotos];
    photos.splice(index, 1);
    this.setData({ detailShipPhotos: photos });
  },

  previewShipPhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.detailShipPhotos;
    wx.previewImage({ current: photos[index], urls: photos });
  },

  // 展开/收起卡片的手机型号（超过3款时）
  toggleCardModels(e) {
    const index = e.currentTarget.dataset.index;
    const expanded = !this.data.outboundRecords[index].expanded;
    this.setData({ [`outboundRecords[${index}].expanded`]: expanded });
  },

  async completeDetailOutbound() {
    const record = this.data.detailRecord;
    const trackingNumber = this.data.detailTrackingNumber ? this.data.detailTrackingNumber.trim() : '';

    if (!record || !record._id) return;

    if (!trackingNumber) {
      wx.showToast({ title: '请填写快递单号', icon: 'none' });
      return;
    }

    if (this.data.completingOutbound) return;

    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ completingOutbound: true });

    try {
      // 上传发货照片到云存储
      const localPhotos = this.data.detailShipPhotos || [];
      const phonePhotoUrls = [];
      if (localPhotos.length > 0) {
        wx.showLoading({ title: '上传照片中...' });
        for (let i = 0; i < localPhotos.length; i++) {
          const cloudPath = `outbound/ship/${record._id}_${Date.now()}_${i}.jpg`;
          const uploadResult = await wx.cloud.uploadFile({ cloudPath, filePath: localPhotos[i] });
          phonePhotoUrls.push(uploadResult.fileID);
        }
      }

      wx.showLoading({ title: '发货中...' });
      const res = await wx.cloud.callFunction({
        name: 'completeOutbound',
        data: {
          outboundId: record._id,
          trackingNumber,
          completedBy: userInfo.nickname || '未知用户',
          phonePhotos: phonePhotoUrls,
          phoneModels: record.phoneModels || []
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({ title: '发货完成', icon: 'success' });
        this.setData({
          completingOutbound: false,
          showDetail: false,
          detailTrackingNumber: '',
          detailShipPhotos: []
        });
        this.queryOutbound();
      } else {
        this.setData({ completingOutbound: false });
        wx.showToast({
          title: (res.result && res.result.errMsg) || '发货失败',
          icon: 'none'
        });
      }
    } catch (e) {
      console.error('完成发货失败:', e);
      wx.hideLoading();
      this.setData({ completingOutbound: false });
      wx.showToast({ title: '发货失败，请重试', icon: 'none' });
    }
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({
      current,
      urls
    });
  },

  async processPhotos(record) {
    const allPhotos = [];

    if (record.packagePhotos && record.packagePhotos.length > 0) {
      allPhotos.push(...record.packagePhotos);
    }
    if (record.phonePhotos && record.phonePhotos.length > 0) {
      allPhotos.push(...record.phonePhotos);
    }

    if (allPhotos.length === 0) {
      return record;
    }

    // 获取所有照片的真实URL
    const urlMap = {};
    for (const photoID of allPhotos) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getRealImageUrl',
          data: { fileID: photoID }
        });
        if (res.result.success) {
          urlMap[photoID] = {
            original: res.result.realUrl,
            thumbnail: `${res.result.realUrl}?imageMogr2/thumbnail/200x200`
          };
        }
      } catch (err) {
        console.error('获取URL失败:', err);
        urlMap[photoID] = { original: photoID, thumbnail: photoID };
      }
    }

    // 替换照片URL
    const processed = { ...record };
    if (processed.packagePhotos) {
      processed.packagePhotos = processed.packagePhotos.map(p => urlMap[p]?.original || p);
      processed.packagePhotosThumbnail = processed.packagePhotos.map(p => urlMap[p]?.thumbnail || p);
      processed.packagePhotosLoaded = new Array(processed.packagePhotos.length).fill(false);
    }
    if (processed.phonePhotos) {
      processed.phonePhotos = processed.phonePhotos.map(p => urlMap[p]?.original || p);
      processed.phonePhotosThumbnail = processed.phonePhotos.map(p => urlMap[p]?.thumbnail || p);
      processed.phonePhotosLoaded = new Array(processed.phonePhotos.length).fill(false);
    }

    return processed;
  },

  onImageLoad(e) {
    const { photosArray, index } = e.currentTarget.dataset;
    const loadedKey = `${photosArray}Loaded`;
    this.setData({
      [`detailRecord.${loadedKey}[${index}]`]: true
    });
  },

  onImageError(e) {
    console.error('图片加载失败:', e);
    const { photosArray, index } = e.currentTarget.dataset;
    const loadedKey = `${photosArray}Loaded`;
    this.setData({
      [`detailRecord.${loadedKey}[${index}]`]: true
    });
  },

  getThumbnailUrl(fileID) {
    return `${fileID}?imageView2/2/w/200/h/200`;
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
