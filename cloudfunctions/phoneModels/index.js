const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const COLLECTION = 'product_models';
const { requireMiniappPermission, deniedResult } = require('./miniappAuth');

function cleanName(value) {
  return String(value || '').trim();
}

function sortBySortAndName(items, nameKey = 'name') {
  return [...(items || [])].sort((a, b) => {
    const sortDiff = (Number(a.sort) || 0) - (Number(b.sort) || 0);
    if (sortDiff !== 0) return sortDiff;
    return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), 'zh-CN');
  });
}

function buildLegacyModels(products) {
  return sortBySortAndName(products)
    .filter(product => product.enabled !== false)
    .map(product => cleanName(product.name))
    .filter(Boolean);
}

function toClientBrand(doc) {
  const sourceProducts = Array.isArray(doc.products) && doc.products.length > 0
    ? doc.products
    : (Array.isArray(doc.models) ? doc.models : []).map((model, index) => ({
      name: model,
      enabled: true,
      sort: (index + 1) * 10,
      systemItem: false,
      specs: [{ name: '默认', enabled: true, sort: 10, systemItem: false }],
    }));

  const products = sortBySortAndName(sourceProducts).map(product => ({
    ...product,
    specs: sortBySortAndName(product.specs || []),
  }));

  return {
    ...doc,
    products,
    models: buildLegacyModels(products),
  };
}

async function fetchAllBrands() {
  const result = [];
  const pageSize = 100;
  let skip = 0;

  while (true) {
    const page = await db.collection(COLLECTION)
      .skip(skip)
      .limit(pageSize)
      .get();
    const data = page.data || [];
    result.push(...data);
    if (data.length < pageSize) break;
    skip += pageSize;
  }

  return sortBySortAndName(result.map(toClientBrand), 'brand');
}

async function getBrandDoc(brand) {
  const brandName = cleanName(brand);
  if (!brandName) return null;

  const result = await db.collection(COLLECTION)
    .where({ brand: brandName })
    .limit(1)
    .get();
  const doc = result.data && result.data[0];
  return doc ? toClientBrand(doc) : null;
}

function now() {
  return new Date().toISOString();
}

async function saveBrandDoc(doc) {
  const { _id, ...rest } = doc;
  const products = rest.products || [];
  await db.collection(COLLECTION).doc(_id).update({
    data: {
      ...rest,
      models: buildLegacyModels(products),
      updatedAt: now(),
    }
  });
}

// 获取所有手机型号，兼容旧页面需要的字符串数组
async function getAllModels() {
  try {
    const brands = await fetchAllBrands();
    const allModels = Array.from(new Set(brands.flatMap(brand => brand.models || [])))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return { success: true, data: allModels, errMsg: '查询成功' };
  } catch (e) {
    console.error('查询手机型号失败:', e);
    return { success: false, errMsg: e.message || '查询失败' };
  }
}

async function getProductTree() {
  try {
    const brands = await fetchAllBrands();
    return { success: true, data: brands, errMsg: '查询成功' };
  } catch (e) {
    console.error('查询产品型号树失败:', e);
    return { success: false, errMsg: e.message || '查询失败' };
  }
}

// 根据品牌获取型号
async function getModelsByBrand(brand) {
  try {
    const doc = await getBrandDoc(brand);
    if (!doc) {
      return { success: false, data: [], errMsg: '未找到该品牌' };
    }
    return { success: true, data: doc.models || [], errMsg: '查询成功' };
  } catch (e) {
    console.error('查询品牌型号失败:', e);
    return { success: false, errMsg: e.message || '查询失败' };
  }
}

// 获取所有品牌
async function getBrands() {
  try {
    const brands = await fetchAllBrands();
    return {
      success: true,
      data: brands.filter(brand => brand.enabled !== false).map(item => item.brand),
      errMsg: '查询成功'
    };
  } catch (e) {
    console.error('查询品牌失败:', e);
    return { success: false, errMsg: e.message || '查询失败' };
  }
}

// 添加新品牌
async function addBrand(brand) {
  try {
    const brandName = cleanName(brand);
    if (!brandName) {
      return { success: false, errMsg: '品牌不能为空' };
    }

    const existing = await getBrandDoc(brandName);
    if (existing) {
      return { success: false, errMsg: '品牌已存在' };
    }

    const total = (await fetchAllBrands()).length;
    const timestamp = now();
    await db.collection(COLLECTION).add({
      data: {
        brand: brandName,
        enabled: true,
        sort: (total + 1) * 10,
        systemBrand: false,
        products: [],
        models: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    });

    return { success: true, errMsg: '添加品牌成功' };
  } catch (e) {
    console.error('添加品牌失败:', e);
    return { success: false, errMsg: e.message || '添加失败' };
  }
}

// 为品牌添加型号，写入 product_models.products，并维护旧字段 models
async function addModels(brand, models) {
  try {
    const brandData = await getBrandDoc(brand);
    if (!brandData) {
      return { success: false, errMsg: '品牌不存在' };
    }

    const products = [...(brandData.products || [])];
    const existingNames = new Set(products.map(product => cleanName(product.name)));
    const normalizedModels = Array.from(new Set((models || []).map(cleanName).filter(Boolean)));
    let addedCount = 0;

    normalizedModels.forEach(model => {
      if (existingNames.has(model)) return;
      products.push({
        name: model,
        enabled: true,
        sort: (products.length + 1) * 10,
        systemItem: false,
        specs: [{ name: '默认', enabled: true, sort: 10, systemItem: false }],
      });
      existingNames.add(model);
      addedCount += 1;
    });

    if (addedCount === 0) {
      return { success: true, errMsg: '所有型号已存在，无需添加', addedCount: 0 };
    }

    await saveBrandDoc({
      ...brandData,
      products
    });

    return {
      success: true,
      errMsg: `成功添加 ${addedCount} 个型号`,
      addedCount
    };
  } catch (e) {
    console.error('添加型号失败:', e);
    return { success: false, errMsg: e.message || '添加失败' };
  }
}

exports.main = async (event) => {
  try {
    const payload = (event && event.data) || event || {};
    const { action } = payload;
    const writeActions = ['addBrand', 'addModels'];
    const requiredPermissions = writeActions.includes(action) ? ['models:write'] : [];
    const auth = await requireMiniappPermission(cloud, db, requiredPermissions);
    if (!auth.allowed) return deniedResult(auth);

    switch (action) {
      case 'getProductTree':
        return await getProductTree();
      case 'getAllModels':
        return await getAllModels();
      case 'getModelsByBrand':
        return await getModelsByBrand(payload.brand);
      case 'getBrands':
        return await getBrands();
      case 'addBrand':
        return await addBrand(payload.brand);
      case 'addModels':
        return await addModels(payload.brand, payload.models);
      default:
        return { success: false, errMsg: '未知的操作' };
    }
  } catch (e) {
    console.error('手机型号云函数失败:', e);
    return { success: false, errMsg: e.message || '手机型号云函数失败' };
  }
};
