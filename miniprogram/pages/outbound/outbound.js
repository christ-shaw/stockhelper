// pages/outbound/outbound.js
Page({
  data: {
    outboundForm: {
      customerName: '',
      outboundDate: '',
      trackingNumber: '',
      phoneModels: [],
      phonePhotos: []
    },
    totalQuantity: 0,
    submitting: false,
    scanning: false,
    // 手机型号选择相关
    allModels: [],
    groupedModels: [],
    letters: [],
    productBrands: [],
    currentProducts: [],
    currentSpecs: [],
    currentBrandIndex: -1,
    currentProductIndex: -1,
    filteredProductOptions: [],
    showModelPickerFlag: false,
    pickerIndex: -1,
    scrollIntoView: '',
    modelSearchKeyword: '',
    touchStartY: {},
    isSwipe: {}
  },

  onLoad() {
    this.checkAuth();
    this.initCloud();
    this.loadPhoneModels();
    this.setData({
      'outboundForm.outboundDate': this.formatDate(new Date())
    });
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
      wx.cloud.init({
        traceUser: true
      });
    }
  },

  async loadPhoneModels() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageProductModels',
        data: { action: 'getProductTree' }
      });
      if (res.result.success) {
        let productBrands = [];
        if (Array.isArray(res.result.data)) {
          productBrands = this.normalizeProductBrands(res.result.data);
        }
        const currentProducts = productBrands[0] ? productBrands[0].products : [];
        const currentSpecs = currentProducts[0] ? currentProducts[0].specs : [];
        this.setData({
          productBrands,
          currentProducts,
          currentSpecs,
          currentBrandIndex: productBrands.length > 0 ? 0 : -1,
          currentProductIndex: currentProducts.length > 0 ? 0 : -1
        });
      }
    } catch (e) {
      console.error('加载手机型号失败:', e);
    }
  },

  normalizeProductBrands(brands) {
    return (brands || []).filter(brand => brand && brand.enabled !== false).map(brand => {
      const products = Array.isArray(brand.products) && brand.products.length > 0
        ? brand.products
        : (brand.models || []).map((model, index) => ({
          name: model,
          enabled: true,
          sort: (index + 1) * 10,
          specs: [{ name: '默认', enabled: true, sort: 10 }]
        }));

      return {
        brand: brand.brand,
        products: products.filter(product => product && product.enabled !== false).map(product => ({
          name: product.name,
          specs: (product.specs && product.specs.length > 0 ? product.specs : [{ name: '默认', enabled: true, sort: 10 }])
            .filter(spec => spec && spec.enabled !== false)
        }))
      };
    }).filter(brand => brand.brand && brand.products.length > 0);
  },

  groupModelsByLetter(models) {
    const grouped = {};
    const letters = [];

    models.forEach(model => {
      const firstChar = model.charAt(0).toUpperCase();
      if (!grouped[firstChar]) {
        grouped[firstChar] = [];
        letters.push(firstChar);
      }
      grouped[firstChar].push(model);
    });

    letters.sort();
    Object.keys(grouped).forEach(key => {
      grouped[key].sort();
    });

    const groupedModels = letters.map(letter => ({
      letter,
      models: grouped[letter]
    }));

    this.setData({ groupedModels, letters });
  },

  scrollToLetter(e) {
    const letter = e.currentTarget.dataset.letter;
    this.setData({ scrollIntoView: '' });
    setTimeout(() => {
      this.setData({ scrollIntoView: `letter-${letter}` });
    }, 50);
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`outboundForm.${field}`]: value
    });
  },

  bindDateChange(e) {
    this.setData({
      'outboundForm.outboundDate': e.detail.value
    });
  },

  startScan() {
    this.setData({ scanning: true });

    wx.scanCode({
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        this.setData({
          'outboundForm.trackingNumber': res.result,
          scanning: false
        });
        wx.showToast({ title: '扫码成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('扫码失败:', err);
        this.setData({ scanning: false });
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({ title: '扫码失败', icon: 'none' });
        }
      }
    });
  },

  // 手机型号选择相关方法
  addPhoneModel() {
    const phoneModels = this.data.outboundForm.phoneModels;
    phoneModels.push({ model: '', quantity: 1 });
    this.setData({ 'outboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  showModelPicker(e) {
    const index = e.currentTarget.dataset.index;
    const selected = this.data.outboundForm.phoneModels[index] || {};
    const pickerState = this.getPickerStateFromModel(selected);
    this.setData({
      showModelPickerFlag: true,
      pickerIndex: index,
      scrollIntoView: '',
      modelSearchKeyword: '',
      ...pickerState
    });
  },

  getPickerStateFromModel(selected) {
    const brands = this.data.productBrands || [];
    let brandIndex = brands.findIndex(brand => brand.brand === selected.brand);
    if (brandIndex < 0) brandIndex = brands.length > 0 ? 0 : -1;

    const currentProducts = brandIndex >= 0 ? brands[brandIndex].products || [] : [];
    let productIndex = currentProducts.findIndex(product => product.name === selected.productName);
    if (productIndex < 0) productIndex = currentProducts.length > 0 ? 0 : -1;

    const currentSpecs = productIndex >= 0 ? currentProducts[productIndex].specs || [] : [];
    return {
      currentBrandIndex: brandIndex,
      currentProductIndex: productIndex,
      currentProducts,
      currentSpecs
    };
  },

  selectPickerBrand(e) {
    const brandIndex = Number(e.currentTarget.dataset.brandIndex);
    const brand = this.data.productBrands[brandIndex];
    const currentProducts = brand ? brand.products || [] : [];
    const currentSpecs = currentProducts[0] ? currentProducts[0].specs || [] : [];
    this.setData({
      currentBrandIndex: brandIndex,
      currentProductIndex: currentProducts.length > 0 ? 0 : -1,
      currentProducts,
      currentSpecs
    });
  },

  selectPickerProduct(e) {
    const productIndex = Number(e.currentTarget.dataset.productIndex);
    const product = this.data.currentProducts[productIndex];
    this.setData({
      currentProductIndex: productIndex,
      currentSpecs: product ? product.specs || [] : []
    });
  },

  selectPickerSpec(e) {
    const specIndex = Number(e.currentTarget.dataset.specIndex);
    const brand = this.data.productBrands[this.data.currentBrandIndex];
    const product = this.data.currentProducts[this.data.currentProductIndex];
    const spec = this.data.currentSpecs[specIndex];

    if (!brand || !product || !spec) {
      wx.showToast({ title: '请选择完整型号', icon: 'none' });
      return;
    }

    const model = spec.name && spec.name !== '默认'
      ? `${brand.brand} / ${product.name} / ${spec.name}`
      : `${brand.brand} / ${product.name}`;
    const phoneModels = [...this.data.outboundForm.phoneModels];
    const validIndex = this.data.pickerIndex >= 0 ? this.data.pickerIndex : 0;

    if (!phoneModels[validIndex]) {
      wx.showToast({ title: '请先添加手机型号', icon: 'none' });
      return;
    }

    phoneModels[validIndex] = {
      ...phoneModels[validIndex],
      model,
      brand: brand.brand,
      productName: product.name,
      specName: spec.name
    };

    this.setData({
      'outboundForm.phoneModels': phoneModels,
      showModelPickerFlag: false,
      pickerIndex: -1
    });
  },

  onModelSearch(e) {
    const keyword = e.detail.value;
    this.setData({ modelSearchKeyword: keyword });
    this.filterProductOptions(keyword);
  },

  filterModels(keyword) {
    if (!keyword || keyword.trim() === '') {
      this.groupModelsByLetter(this.data.allModels);
      return;
    }
    const filtered = this.data.allModels.filter(model =>
      model.toLowerCase().includes(keyword.toLowerCase())
    );
    this.groupModelsByLetter(filtered);
  },

  filterProductOptions(keyword) {
    const text = (keyword || '').trim().toLowerCase();
    if (!text) {
      this.setData({ filteredProductOptions: [] });
      return;
    }

    const options = [];
    (this.data.productBrands || []).forEach((brand, brandIndex) => {
      (brand.products || []).forEach((product, productIndex) => {
        (product.specs || []).forEach((spec, specIndex) => {
          const label = spec.name && spec.name !== '默认'
            ? `${brand.brand} / ${product.name} / ${spec.name}`
            : `${brand.brand} / ${product.name}`;
          if (label.toLowerCase().includes(text)) {
            options.push({ label, brandIndex, productIndex, specIndex });
          }
        });
      });
    });

    this.setData({ filteredProductOptions: options.slice(0, 80) });
  },

  selectFilteredProduct(e) {
    const optionIndex = Number(e.currentTarget.dataset.optionIndex);
    const option = this.data.filteredProductOptions[optionIndex];
    if (!option) return;

    this.setData({
      currentBrandIndex: option.brandIndex,
      currentProductIndex: option.productIndex,
      currentProducts: this.data.productBrands[option.brandIndex].products || [],
      currentSpecs: this.data.productBrands[option.brandIndex].products[option.productIndex].specs || []
    }, () => {
      this.selectPickerSpec({
        currentTarget: {
          dataset: {
            specIndex: option.specIndex
          }
        }
      });
    });
  },

  onItemTouchStart(e) {
    const phoneModelIndex = e.currentTarget.dataset.index;
    const modelIndex = e.currentTarget.dataset.modelIndex;
    const touch = e.touches[0];
    const touchStartY = { ...this.data.touchStartY };
    touchStartY[`${phoneModelIndex}_${modelIndex}`] = touch.clientY;
    this.setData({ touchStartY });
  },

  onItemTouchEnd(e) {
    const phoneModelIndex = e.currentTarget.dataset.index;
    const modelIndex = e.currentTarget.dataset.modelIndex;
    const touch = e.changedTouches[0];
    const key = `${phoneModelIndex}_${modelIndex}`;
    const startY = this.data.touchStartY[key] || 0;
    const endY = touch.clientY;
    const distance = Math.abs(endY - startY);

    const isSwipe = distance > 10;
    const isSwipeData = { ...this.data.isSwipe };
    isSwipeData[key] = isSwipe;
    this.setData({ isSwipe: isSwipeData });
  },

  selectModel(e) {
    const phoneModelIndex = e.currentTarget.dataset.index;
    const modelIndex = e.currentTarget.dataset.modelIndex;
    const model = e.currentTarget.dataset.model;
    const key = `${phoneModelIndex}_${modelIndex}`;

    const isSwipeData = { ...this.data.isSwipe };
    isSwipeData[key] = false;
    this.setData({ isSwipe: isSwipeData });

    const index = this.data.pickerIndex;
    const phoneModels = [...this.data.outboundForm.phoneModels];

    const validIndex = (index >= 0 && phoneModels[index]) ? index : phoneModelIndex;

    if (validIndex >= 0 && phoneModels[validIndex]) {
      phoneModels[validIndex] = {
        ...phoneModels[validIndex],
        model: model
      };
    } else {
      wx.showToast({ title: '请先添加手机型号', icon: 'none' });
      return;
    }

    this.setData({
      'outboundForm.phoneModels': phoneModels,
      showModelPickerFlag: false,
      pickerIndex: -1
    });
  },

  deletePhoneModel(e) {
    const index = e.currentTarget.dataset.index;
    const phoneModels = this.data.outboundForm.phoneModels;
    phoneModels.splice(index, 1);
    this.setData({ 'outboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  onPhoneQuantityInput(e) {
    const index = e.currentTarget.dataset.index;
    const rawValue = e.detail.value;
    const phoneModels = this.data.outboundForm.phoneModels;
    phoneModels[index].quantity = rawValue === '' ? '' : (parseInt(rawValue) || '');
    this.setData({ 'outboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  onPhoneQuantityBlur(e) {
    const index = e.currentTarget.dataset.index;
    const phoneModels = this.data.outboundForm.phoneModels;
    const quantity = parseInt(phoneModels[index].quantity);
    phoneModels[index].quantity = quantity > 0 ? quantity : 1;
    this.setData({ 'outboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  changeQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    const phoneModels = this.data.outboundForm.phoneModels;
    let quantity = parseInt(phoneModels[index].quantity) || 0;

    if (type === 'increase') {
      quantity = quantity + 1;
    } else if (type === 'decrease') {
      quantity = Math.max(0, quantity - 1);
    }

    phoneModels[index].quantity = quantity;
    this.setData({ 'outboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  calculateTotalQuantity() {
    const phoneModels = this.data.outboundForm.phoneModels;
    const total = phoneModels.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    this.setData({ totalQuantity: total });
  },

  // 照片相关方法
  choosePhonePhotos() {
    const currentCount = this.data.outboundForm.phonePhotos.length;
    const maxCount = 9 - currentCount;

    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张照片', icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const phonePhotos = this.data.outboundForm.phonePhotos;
        phonePhotos.push(...res.tempFilePaths);
        this.setData({ 'outboundForm.phonePhotos': phonePhotos });
      }
    });
  },

  deletePhonePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const phonePhotos = this.data.outboundForm.phonePhotos;
    phonePhotos.splice(index, 1);
    this.setData({ 'outboundForm.phonePhotos': phonePhotos });
  },

  previewPhonePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const phonePhotos = this.data.outboundForm.phonePhotos;
    wx.previewImage({
      current: phonePhotos[index],
      urls: phonePhotos
    });
  },

  async submitOutbound() {
    const form = this.data.outboundForm;

    if (!form.customerName) {
      wx.showToast({ title: '请输入客户姓名', icon: 'none' });
      return;
    }

    if (!form.phoneModels || form.phoneModels.length === 0) {
      wx.showToast({ title: '请添加至少一个手机型号', icon: 'none' });
      return;
    }

    for (let i = 0; i < form.phoneModels.length; i++) {
      if (!form.phoneModels[i].model) {
        wx.showToast({ title: `请选择第${i + 1}个手机型号`, icon: 'none' });
        return;
      }
      if (!form.phoneModels[i].quantity || form.phoneModels[i].quantity <= 0) {
        wx.showToast({ title: `请输入第${i + 1}个手机的有效数量`, icon: 'none' });
        return;
      }
    }

    if (!form.outboundDate) {
      wx.showToast({ title: '请选择出库日期', icon: 'none' });
      return;
    }

    if (!form.phonePhotos || form.phonePhotos.length === 0) {
      wx.showToast({ title: '请至少上传一张手机照片', icon: 'none' });
      return;
    }

    if (this.data.submitting) {
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '上传图片中...' });

    try {
      // 上传手机照片到云存储
      let phonePhotoUrls = [];
      if (form.phonePhotos && form.phonePhotos.length > 0) {
        for (let i = 0; i < form.phonePhotos.length; i++) {
          const filePath = form.phonePhotos[i];
          const cloudPath = `outbound/phone/${form.customerName}_${Date.now()}_${i}.jpg`;
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath
          });
          phonePhotoUrls.push(uploadResult.fileID);
        }
      }

      wx.showLoading({ title: '保存记录中...' });

      // 调用云函数保存出库记录
      const res = await wx.cloud.callFunction({
        name: 'saveOutbound',
        data: {
          data: {
            customerName: form.customerName,
            outboundDate: form.outboundDate || this.formatDate(new Date()),
            trackingNumber: form.trackingNumber || '',
            phoneModels: form.phoneModels,
            phonePhotos: phonePhotoUrls
          }
        }
      });

      if (res.result.success) {
        // 保存操作记录
        try {
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo) {
            await wx.cloud.callFunction({
              name: 'saveOperationLog',
              data: {
                operationType: 'create',
                logType: 'outbound',
                logId: res.result._id,
                operationContent: form.customerName,
                operator: userInfo.nickname || '未知用户',
                operatorOpenid: userInfo.openid,
                operationTime: this.formatTime(new Date())
              }
            });
            console.log('操作记录保存成功');
          }
        } catch (logError) {
          console.error('保存操作记录失败:', logError);
        }

        this.setData({
          outboundForm: {
            customerName: '',
            outboundDate: this.formatDate(new Date()),
            trackingNumber: '',
            phoneModels: [],
            phonePhotos: []
          },
          totalQuantity: 0
        });

        wx.hideLoading();
        wx.showToast({ title: '出库成功', icon: 'success' });
      } else {
        wx.hideLoading();
        wx.showToast({ title: res.result.errMsg || '提交失败', icon: 'none' });
      }
    } catch (e) {
      console.error('提交出库失败:', e);
      wx.hideLoading();
      wx.showToast({ title: '提交失败,请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  formatTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
