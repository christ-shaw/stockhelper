// 手机型号数据
const phoneModels = [
  {
    brand: 'Apple',
    models: [
      'iPhone 16',
      'iPhone 16 Plus',
      'iPhone 16 Pro',
      'iPhone 16 Pro Max',
      'iPhone 15',
      'iPhone 15 Plus',
      'iPhone 15 Pro',
      'iPhone 15 Pro Max',
      'iPhone 14',
      'iPhone 14 Plus',
      'iPhone 14 Pro',
      'iPhone 14 Pro Max',
      'iPhone 13',
      'iPhone 13 Pro',
      'iPhone 13 Pro Max',
      'iPhone 12',
      'iPhone 12 Pro',
      'iPhone 12 Pro Max',
      'iPhone 11',
      'iPhone 11 Pro',
      'iPhone 11 Pro Max',
      'iPhone SE',
      'iPhone SE 2',
      'iPhone SE 3',
      'iPhone XS',
      'iPhone XS Max',
      'iPhone XR',
      'iPhone X'
    ]
  },
  {
    brand: 'Samsung',
    models: [
      'Galaxy S24 Ultra',
      'Galaxy S24+',
      'Galaxy S24',
      'Galaxy S23 Ultra',
      'Galaxy S23+',
      'Galaxy S23',
      'Galaxy S22 Ultra',
      'Galaxy S22+',
      'Galaxy S22',
      'Galaxy S21 Ultra',
      'Galaxy S21+',
      'Galaxy S21',
      'Galaxy S20 Ultra',
      'Galaxy S20+',
      'Galaxy S20'
    ]
  },
  {
    brand: 'Huawei',
    models: [
      'Mate 60 Pro+',
      'Mate 60 Pro',
      'Mate 60',
      'Mate 50 Pro',
      'Mate 50',
      'Mate 40 Pro',
      'Mate 40',
      'Pura 70 Ultra',
      'Pura 70 Pro+',
      'Pura 70 Pro',
      'Pura 70',
      'P60 Pro',
      'P60',
      'P50 Pro',
      'P50'
    ]
  },
  {
    brand: 'Xiaomi',
    models: [
      'Xiaomi 14 Ultra',
      'Xiaomi 14 Pro',
      'Xiaomi 14',
      'Xiaomi 13 Ultra',
      'Xiaomi 13 Pro',
      'Xiaomi 13',
      'Xiaomi 12S Ultra',
      'Xiaomi 12S Pro',
      'Xiaomi 12S',
      'Xiaomi 12',
      'Redmi K70 Pro',
      'Redmi K70',
      'Redmi K60 Ultra',
      'Redmi K60 Pro',
      'Redmi K60'
    ]
  },
  {
    brand: 'Oppo',
    models: [
      'Find X7 Ultra',
      'Find X7 Pro',
      'Find X7',
      'Find X6 Pro',
      'Find X6',
      'Find X5 Pro',
      'Find X5',
      'Reno 12 Pro+',
      'Reno 12 Pro',
      'Reno 12',
      'Reno 11 Pro',
      'Reno 11'
    ]
  },
  {
    brand: 'Vivo',
    models: [
      'X100 Pro+',
      'X100 Pro',
      'X100',
      'X90 Pro+',
      'X90 Pro',
      'X90',
      'X80 Pro',
      'X80',
      'S19 Pro+',
      'S19 Pro',
      'S19'
    ]
  },
  {
    brand: 'OnePlus',
    models: [
      'OnePlus 12',
      'OnePlus 11',
      'OnePlus 10 Pro',
      'OnePlus 10',
      'OnePlus 9 Pro',
      'OnePlus 9',
      'OnePlus 8 Pro',
      'OnePlus 8'
    ]
  },
  {
    brand: 'Honor',
    models: [
      'Magic 6 Pro+',
      'Magic 6 Pro',
      'Magic 6',
      'Magic 5 Pro',
      'Magic 5',
      'Magic 4 Pro',
      'Magic 4'
    ]
  }
];

// 获取所有品牌
function getBrands() {
  return phoneModels.map(item => item.brand);
}

// 根据品牌获取型号列表
function getModelsByBrand(brand) {
  const brandData = phoneModels.find(item => item.brand === brand);
  return brandData ? brandData.models : [];
}

// 获取所有型号
function getAllModels() {
  const allModels = [];
  phoneModels.forEach(brand => {
    allModels.push(...brand.models);
  });
  return allModels;
}

module.exports = {
  phoneModels,
  getBrands,
  getModelsByBrand,
  getAllModels
};
