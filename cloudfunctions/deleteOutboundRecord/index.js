const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { _id } = event.data;

    // 删除出库记录
    await db.collection('outbound_records').doc(_id).remove();

    return {
      success: true,
      errMsg: '删除出库记录成功'
    };
  } catch (e) {
    console.error('删除出库记录失败:', e);
    return {
      success: false,
      errMsg: e.message || '删除出库记录失败'
    };
  }
};
