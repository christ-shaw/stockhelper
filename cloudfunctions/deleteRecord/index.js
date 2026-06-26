const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const { requireMiniappPermission, deniedResult } = require('./miniappAuth');

exports.main = async (event, context) => {
  try {
    const auth = await requireMiniappPermission(cloud, db, ['inbound:delete']);
    if (!auth.allowed) return deniedResult(auth);

    const { _id } = event.data;

    // 删除记录
    await db.collection('stock_records').doc(_id).remove();

    return {
      success: true,
      errMsg: '删除记录成功'
    };
  } catch (e) {
    console.error('删除记录失败:', e);
    return {
      success: false,
      errMsg: e.message || '删除记录失败'
    };
  }
};
