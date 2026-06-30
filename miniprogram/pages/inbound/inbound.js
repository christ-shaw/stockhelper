// pages/inbound/inbound.js
Page({
  data: {
    inboundForm: {
      inboundDate: '',
      trackingNumber: '',
      customerName: '',
      shopId: '',
      shopName: '',
      type: 'return',
      phoneModels: [],
      packagePhotos: [],
      phonePhotos: [],
      hasIssue: false,
      remark: ''
    },
    scanning: false,
    allModels: [],
    groupedModels: [],
    letters: [],
    productBrands: [],
    currentProducts: [],
    currentSpecs: [],
    currentBrandIndex: -1,
    currentProductIndex: -1,
    filteredProductOptions: [],
    allShops: [],
    shopIndex: -1,
    selectedShopName: '',
    showModelPicker: false,
    pickerIndex: -1,
    totalQuantity: 0,
    loadingShops: false,
    touchStartY: {},
    isSwipe: {},
    scrollIntoView: '',
    modelSearchKeyword: '',
    shopTypes: [
      { name: '归还', value: 'return' },
      { name: '售后', value: 'afterSale' },
      { name: '采购', value: 'purchase' },
      { name: '回购', value: 'recycle' }
    ],
    shopTypeIndex: 0,
    submitting: false
  },

  onLoad() {
    this.checkAuth();
    this.initCloud();
    this.loadPhoneModels();
    this.loadShops('return');
    this.setData({
      'inboundForm.inboundDate': this.formatDate(new Date())
    });
  },

  async loadPhoneModels() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageProductModels',
        data: { action: 'getProductTree' }
      });
      console.log('云函数返回:', res);
      if (res.result.success) {
        console.log('手机型号数据:', res.result.data);

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
    
    this.setData({
      groupedModels,
      letters
    });
  },

  scrollToLetter(e) {
    const letter = e.currentTarget.dataset.letter;
    this.setData({
      scrollIntoView: ''
    });
    setTimeout(() => {
      this.setData({
        scrollIntoView: `letter-${letter}`
      });
    }, 50);
  },

  async loadShops(type) {
    try {
      this.setData({ loadingShops: true });
      console.log('开始加载渠道，type:', type);
      const res = await wx.cloud.callFunction({
        name: 'getShops',
        data: { action: 'getShopsByType', type: type || 'return' }
      });
      console.log('云函数返回结果:', res);
      if (res.result && res.result.success) {
        const shopsData = res.result.data || [];
        console.log('渠道数据:', shopsData);
        console.log('渠道数据长度:', shopsData.length);
        this.setData({
          allShops: shopsData,
          shopIndex: -1,
          selectedShopName: '',
          'inboundForm.shopId': '',
          'inboundForm.shopName': '',
          loadingShops: false
        }, () => {
          console.log('setData 完成后的 allShops:', this.data.allShops);
          console.log('allShops 长度:', this.data.allShops.length);
        });
      } else {
        console.error('云函数返回失败:', res);
        wx.showToast({ title: '加载渠道失败', icon: 'none' });
        this.setData({ loadingShops: false });
      }
    } catch (e) {
      console.error('加载渠道失败:', e);
      wx.showToast({ title: '加载渠道失败', icon: 'none' });
      this.setData({ loadingShops: false });
    }
  },

  onShopChange(e) {
    const index = e.detail.value;
    const shop = this.data.allShops[index];
    console.log('选择渠道:', index, shop);
    this.setData({
      shopIndex: index,
      selectedShopName: shop ? shop.name : '',
      'inboundForm.shopId': shop ? shop._id : '',
      'inboundForm.shopName': shop ? shop.name : ''
    });
  },

  onShopTypeChange(e) {
    const index = e.detail.value;
    const type = this.data.shopTypes[index].value;
    this.setData({
      shopTypeIndex: index,
      'inboundForm.type': type
    });
    this.loadShops(type);
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

  bindDateChange(e) {
    this.setData({
      'inboundForm.inboundDate': e.detail.value
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`inboundForm.${field}`]: value
    });
  },

  startScan() {
    this.setData({ scanning: true });

    wx.scanCode({
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        this.setData({
          'inboundForm.trackingNumber': res.result,
          scanning: false
        });
        wx.showToast({
          title: '扫码成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('扫码失败:', err);
        this.setData({ scanning: false });
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          });
        }
      }
    });
  },

  addPhoneModel() {
    const phoneModels = this.data.inboundForm.phoneModels;
    phoneModels.push({ model: '', quantity: 1 });
    this.setData({
      'inboundForm.phoneModels': phoneModels
    });
    this.calculateTotalQuantity();
  },

  onModelFocus(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      showModelPicker: true,
      pickerIndex: index
    });
  },

  onModelBlur() {
    setTimeout(() => {
      this.setData({
        showModelPicker: false,
        pickerIndex: -1
      });
    }, 200);
  },

  showModelPicker(e) {
    const index = e.currentTarget.dataset.index;
    const selected = this.data.inboundForm.phoneModels[index] || {};
    const pickerState = this.getPickerStateFromModel(selected);
    this.setData({
      showModelPicker: true,
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
    const phoneModels = [...this.data.inboundForm.phoneModels];
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
      'inboundForm.phoneModels': phoneModels,
      showModelPicker: false,
      pickerIndex: -1
    });
  },

  onModelSearch(e) {
    const keyword = e.detail.value;
    this.setData({
      modelSearchKeyword: keyword
    });
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

    console.log('selectModel 被调用', { phoneModelIndex, modelIndex, model, phoneModelsLength: this.data.inboundForm.phoneModels.length });
    console.log('当前 pickerIndex:', this.data.pickerIndex);
    console.log('完整的 phoneModels:', JSON.stringify(this.data.inboundForm.phoneModels));

    // 清理滑动状态
    const isSwipeData = { ...this.data.isSwipe };
    isSwipeData[key] = false;
    this.setData({ isSwipe: isSwipeData });

    // 使用 pickerIndex 而不是 phoneModelIndex
    const index = this.data.pickerIndex;
    const phoneModels = [...this.data.inboundForm.phoneModels];

    console.log('准备更新索引:', index, 'phoneModels 长度:', phoneModels.length);

    // 检查索引是否有效，如果无效则使用 phoneModelIndex
    const validIndex = (index >= 0 && phoneModels[index]) ? index : phoneModelIndex;

    console.log('实际使用的索引:', validIndex);

    if (validIndex >= 0 && phoneModels[validIndex]) {
      phoneModels[validIndex] = {
        ...phoneModels[validIndex],
        model: model
      };
      console.log('更新后 phoneModels:', phoneModels);
    } else {
      console.error('索引无效:', validIndex, 'phoneModels:', phoneModels);
      wx.showToast({ title: '请先添加手机型号', icon: 'none' });
      return;
    }

    this.setData({
      'inboundForm.phoneModels': phoneModels,
      showModelPicker: false,
      pickerIndex: -1
    });
  },

  deletePhoneModel(e) {
    const index = e.currentTarget.dataset.index;
    const phoneModels = this.data.inboundForm.phoneModels;
    phoneModels.splice(index, 1);
    this.setData({ 'inboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  onPhoneQuantityInput(e) {
    const index = e.currentTarget.dataset.index;
    const rawValue = e.detail.value;
    const phoneModels = this.data.inboundForm.phoneModels;
    phoneModels[index].quantity = rawValue === '' ? '' : (parseInt(rawValue) || '');
    this.setData({ 'inboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  onPhoneQuantityBlur(e) {
    const index = e.currentTarget.dataset.index;
    const phoneModels = this.data.inboundForm.phoneModels;
    const quantity = parseInt(phoneModels[index].quantity);
    phoneModels[index].quantity = quantity > 0 ? quantity : 1;
    this.setData({ 'inboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  changeQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    const phoneModels = this.data.inboundForm.phoneModels;
    let quantity = parseInt(phoneModels[index].quantity) || 0;

    if (type === 'increase') {
      quantity = quantity + 1;
    } else if (type === 'decrease') {
      quantity = Math.max(0, quantity - 1);
    }

    phoneModels[index].quantity = quantity;
    this.setData({ 'inboundForm.phoneModels': phoneModels });
    this.calculateTotalQuantity();
  },

  calculateTotalQuantity() {
    const phoneModels = this.data.inboundForm.phoneModels;
    const total = phoneModels.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    this.setData({ totalQuantity: total });
  },

  choosePackagePhotos() {
    const currentCount = this.data.inboundForm.packagePhotos.length;
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
        const packagePhotos = this.data.inboundForm.packagePhotos;
        packagePhotos.push(...res.tempFilePaths);
        this.setData({ 'inboundForm.packagePhotos': packagePhotos });
      }
    });
  },

  deletePackagePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const packagePhotos = this.data.inboundForm.packagePhotos;
    packagePhotos.splice(index, 1);
    this.setData({ 'inboundForm.packagePhotos': packagePhotos });
  },

  previewPackagePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const packagePhotos = this.data.inboundForm.packagePhotos;
    wx.previewImage({
      current: packagePhotos[index],
      urls: packagePhotos
    });
  },

  choosePhonePhotos() {
    const currentCount = this.data.inboundForm.phonePhotos.length;
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
        const phonePhotos = this.data.inboundForm.phonePhotos;
        phonePhotos.push(...res.tempFilePaths);
        this.setData({ 'inboundForm.phonePhotos': phonePhotos });
      }
    });
  },

  deletePhonePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const phonePhotos = this.data.inboundForm.phonePhotos;
    phonePhotos.splice(index, 1);
    this.setData({ 'inboundForm.phonePhotos': phonePhotos });
  },

  previewPhonePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const phonePhotos = this.data.inboundForm.phonePhotos;
    wx.previewImage({
      current: phonePhotos[index],
      urls: phonePhotos
    });
  },

  onIssueChange(e) {
    this.setData({
      'inboundForm.hasIssue': e.detail.value
    });
  },

  async submitInbound() {
    const form = this.data.inboundForm;

    if (!form.trackingNumber) {
      wx.showToast({ title: '请扫描或输入快递单号', icon: 'none' });
      return;
    }
    if (!form.customerName) {
      wx.showToast({ title: '请输入客户姓名', icon: 'none' });
      return;
    }
    if (!form.shopId) {
      wx.showToast({ title: '请选择归还店铺', icon: 'none' });
      return;
    }
    if (!form.phoneModels || form.phoneModels.length === 0) {
      wx.showToast({ title: '请添加至少一个手机型号', icon: 'none' });
      return;
    }

    for (let i = 0; i < form.phoneModels.length; i++) {
      if (!form.phoneModels[i].model) {
        wx.showToast({ title: `请输入第${i + 1}个手机型号`, icon: 'none' });
        return;
      }
      if (!form.phoneModels[i].quantity || form.phoneModels[i].quantity <= 0) {
        wx.showToast({ title: `请输入第${i + 1}个手机的有效数量`, icon: 'none' });
        return;
      }
    }

    if (!form.packagePhotos || form.packagePhotos.length === 0) {
      wx.showToast({ title: '请上传包裹照片', icon: 'none' });
      return;
    }

    if (!form.phonePhotos || form.phonePhotos.length === 0) {
      wx.showToast({ title: '请上传手机照片', icon: 'none' });
      return;
    }

    if (this.data.submitting) {
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '上传图片中...' });

    try {
      // 上传包裹照片到云存储
      let packagePhotoUrls = [];
      if (form.packagePhotos && form.packagePhotos.length > 0) {
        for (let i = 0; i < form.packagePhotos.length; i++) {
          const filePath = form.packagePhotos[i];
          const cloudPath = `inbound/package/${form.trackingNumber}_${Date.now()}_${i}.jpg`;
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath
          });
          packagePhotoUrls.push(uploadResult.fileID);
        }
      }

      // 上传手机照片到云存储
      let phonePhotoUrls = [];
      if (form.phonePhotos && form.phonePhotos.length > 0) {
        for (let i = 0; i < form.phonePhotos.length; i++) {
          const filePath = form.phonePhotos[i];
          const cloudPath = `inbound/phone/${form.trackingNumber}_${Date.now()}_${i}.jpg`;
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath
          });
          phonePhotoUrls.push(uploadResult.fileID);
        }
      }

      wx.showLoading({ title: '保存记录中...' });

      // 调用云函数保存入库记录
      console.log('准备保存的数据:', {
        shopId: form.shopId,
        shopName: form.shopName,
        type: form.type
      });
      const res = await wx.cloud.callFunction({
        name: 'saveInbound',
        data: {
          data: {
            inboundDate: form.inboundDate || this.formatDate(new Date()),
            trackingNumber: form.trackingNumber,
            customerName: form.customerName,
            shopId: form.shopId,
            shopName: form.shopName,
            type: form.type,
            phoneModels: form.phoneModels,
            packagePhotos: packagePhotoUrls,
            phonePhotos: phonePhotoUrls,
            hasIssue: form.hasIssue || false,
            remark: form.remark || ''
          }
        }
      });
      console.log('云函数返回结果:', res);

      if (res.result.success) {
        // 保存操作记录
        try {
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo) {
            await wx.cloud.callFunction({
              name: 'saveOperationLog',
              data: {
                operationType: 'create',
                logType: 'inbound',
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
          // 操作记录保存失败不影响主流程
        }

        this.setData({
          inboundForm: {
            inboundDate: this.formatDate(new Date()),
            trackingNumber: '',
            customerName: '',
            shopId: '',
            shopName: '',
            type: this.data.shopTypes[this.data.shopTypeIndex].value,
            phoneModels: [],
            packagePhotos: [],
            phonePhotos: [],
            hasIssue: false,
            remark: ''
          },
          shopIndex: -1,
          selectedShopName: '',
          totalQuantity: 0
        });

        wx.hideLoading();
        wx.showToast({ title: '入库成功', icon: 'success' });
      } else {
        wx.hideLoading();
        wx.showToast({ title: res.result.errMsg || '提交失败', icon: 'none' });
      }
    } catch (e) {
      console.error('提交入库失败:', e);
      wx.hideLoading();
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
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
