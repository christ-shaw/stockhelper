Page({
  data: {
    brandInput: '',
    modelInput: '',
    modelsArray: [],
    testResults: []
  },

  // 添加品牌
  testAddBrand() {
    if (!this.data.brandInput.trim()) {
      wx.showToast({
        title: '请输入品牌名称',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '添加中...' });

    wx.cloud.callFunction({
      name: 'phoneModels',
      data: {
        action: 'addBrand',
        brand: this.data.brandInput.trim()
      }
    }).then(res => {
      wx.hideLoading();
      const result = res.result;
      this.addTestResult('添加品牌', result.success, result.errMsg);
      
      if (result.success) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
        this.data.brandInput = '';
        this.setData({ brandInput: '' });
      } else {
        wx.showToast({
          title: result.errMsg,
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('添加品牌失败:', err);
      this.addTestResult('添加品牌', false, err.errMsg || err.message);
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      });
    });
  },

  // 添加型号
  testAddModels() {
    if (!this.data.brandInput.trim()) {
      wx.showToast({
        title: '请输入品牌名称',
        icon: 'none'
      });
      return;
    }

    if (!this.data.modelInput.trim() && this.data.modelsArray.length === 0) {
      wx.showToast({
        title: '请输入型号',
        icon: 'none'
      });
      return;
    }

    // 合并单个输入和数组
    const models = [...this.data.modelsArray];
    if (this.data.modelInput.trim()) {
      models.push(this.data.modelInput.trim());
    }

    if (models.length === 0) {
      wx.showToast({
        title: '请输入型号',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '添加中...' });

    wx.cloud.callFunction({
      name: 'phoneModels',
      data: {
        action: 'addModels',
        brand: this.data.brandInput.trim(),
        models: models
      }
    }).then(res => {
      wx.hideLoading();
      const result = res.result;
      this.addTestResult('添加型号', result.success, result.errMsg);
      
      if (result.success) {
        wx.showToast({
          title: result.errMsg,
          icon: 'success'
        });
        this.data.modelInput = '';
        this.data.modelsArray = [];
        this.setData({ 
          modelInput: '',
          modelsArray: []
        });
      } else {
        wx.showToast({
          title: result.errMsg,
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('添加型号失败:', err);
      this.addTestResult('添加型号', false, err.errMsg || err.message);
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      });
    });
  },

  // 测试查询所有品牌
  testGetBrands() {
    wx.showLoading({ title: '查询中...' });

    wx.cloud.callFunction({
      name: 'phoneModels',
      data: {
        action: 'getBrands'
      }
    }).then(res => {
      wx.hideLoading();
      const result = res.result;
      this.addTestResult('查询所有品牌', result.success, `共 ${result.data.length} 个品牌`);
      
      if (result.success) {
        console.log('所有品牌:', result.data);
        wx.showModal({
          title: '所有品牌',
          content: result.data.join(', '),
          showCancel: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('查询品牌失败:', err);
      this.addTestResult('查询所有品牌', false, err.errMsg || err.message);
    });
  },

  // 测试根据品牌查询型号
  testGetModelsByBrand() {
    if (!this.data.brandInput.trim()) {
      wx.showToast({
        title: '请输入品牌名称',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '查询中...' });

    wx.cloud.callFunction({
      name: 'phoneModels',
      data: {
        action: 'getModelsByBrand',
        brand: this.data.brandInput.trim()
      }
    }).then(res => {
      wx.hideLoading();
      const result = res.result;
      this.addTestResult('查询品牌型号', result.success, `共 ${result.data.length} 个型号`);
      
      if (result.success) {
        console.log(`${this.data.brandInput} 型号:`, result.data);
        wx.showModal({
          title: `${this.data.brandInput} 型号`,
          content: result.data.join(', '),
          showCancel: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('查询型号失败:', err);
      this.addTestResult('查询品牌型号', false, err.errMsg || err.message);
    });
  },

  // 添加型号到数组
  addModelToArray() {
    if (!this.data.modelInput.trim()) {
      wx.showToast({
        title: '请输入型号',
        icon: 'none'
      });
      return;
    }
    
    const models = [...this.data.modelsArray];
    models.push(this.data.modelInput.trim());
    this.setData({
      modelsArray: models,
      modelInput: ''
    });
  },

  // 从数组移除型号
  removeModelFromArray(e) {
    const index = e.currentTarget.dataset.index;
    const models = [...this.data.modelsArray];
    models.splice(index, 1);
    this.setData({ modelsArray: models });
  },

  // 添加测试结果
  addTestResult(action, success, message) {
    const results = [...this.data.testResults];
    const timestamp = new Date().toLocaleTimeString();
    results.unshift({
      action,
      success,
      message,
      timestamp
    });
    this.setData({ testResults: results.slice(0, 10) });
  },

  // 清空测试结果
  clearResults() {
    this.setData({ testResults: [] });
  },

  // 输入框事件
  onBrandInput(e) {
    this.setData({ brandInput: e.detail.value });
  },

  onModelInput(e) {
    this.setData({ modelInput: e.detail.value });
  }
});
