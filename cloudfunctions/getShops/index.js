const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const { requireMiniappPermission, deniedResult } = require('./miniappAuth');

// 获取所有店铺
async function getAllShops() {
  try {
    const result = await db.collection('shops').get();
    return { success: true, data: result.data, errMsg: '查询成功' };
  } catch (e) {
    console.error('查询店铺失败:', e);
    return { success: false, errMsg: e.message || '查询失败' };
  }
}

// 根据类型获取店铺
async function getShopsByType(type) {
  try {
    const result = await db.collection('shops').where({
      type: type
    }).get();
    return { success: true, data: result.data, errMsg: '查询成功' };
  } catch (e) {
    console.error('查询店铺失败:', e);
    return { success: false, errMsg: e.message || '查询失败' };
  }
}

exports.main = async (event, context) => {
  try {
    const auth = await requireMiniappPermission(cloud, db);
    if (!auth.allowed) return deniedResult(auth);

    const { action, type } = event;

    switch (action) {
      case 'getAllShops':
        return await getAllShops();
      case 'getShopsByType':
        return await getShopsByType(type);
      default:
        return { success: false, errMsg: '未知的操作' };
    }
  } catch (e) {
    console.error('获取店铺失败:', e);
    return { success: false, errMsg: e.message || '获取店铺失败' };
  }
};
