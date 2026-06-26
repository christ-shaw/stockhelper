const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const { requireMiniappPermission, deniedResult } = require('./miniappAuth');

exports.main = async (event, context) => {
  try {
    const auth = await requireMiniappPermission(cloud, db, ['outbound:create']);
    if (!auth.allowed) return deniedResult(auth);

    const { customerName, outboundDate, trackingNumber, phoneModels, phonePhotos } = event.data;

    // 保存出库记录到 outbound_records 集合,使用客户端传入的日期字符串,不使用serverDate()
    const result = await db.collection('outbound_records').add({
      data: {
        customerName,
        outboundDate,
        trackingNumber,
        phoneModels,
        phonePhotos,
        source: 'manual',
        outboundStatus: 'completed',
        completedTime: db.serverDate(),
        createTime: db.serverDate()
      }
    });

    return {
      success: true,
      _id: result._id,
      errMsg: '保存出库记录成功'
    };
  } catch (e) {
    console.error('保存出库记录失败:', e);
    return {
      success: false,
      errMsg: e.message || '保存出库记录失败'
    };
  }
};
