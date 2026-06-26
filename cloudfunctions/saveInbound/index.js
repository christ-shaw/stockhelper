const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const { requireMiniappPermission, deniedResult } = require('./miniappAuth');

exports.main = async (event, context) => {
  try {
    const auth = await requireMiniappPermission(cloud, db, ['inbound:create']);
    if (!auth.allowed) return deniedResult(auth);

    const { inboundDate, trackingNumber, customerName, shopId, shopName, type, phoneModels, packagePhotos, phonePhotos, hasIssue, remark } = event.data;

    console.log('接收到的数据:', { inboundDate, trackingNumber, customerName, shopId, shopName, type, hasIssue, remark });

    // 保存入库记录到 inbound_records 集合,使用客户端传入的日期字符串,不使用serverDate()
    const result = await db.collection('inbound_records').add({
      data: {
        inboundDate,
        trackingNumber,
        customerName,
        shopId,
        shopName,
        type,
        phoneModels,
        packagePhotos,
        phonePhotos,
        hasIssue: hasIssue || false,
        remark: remark || '',
        createTime: db.serverDate()
      }
    });

    console.log('保存成功，记录ID:', result._id);

    return {
      success: true,
      _id: result._id,
      errMsg: '保存入库记录成功'
    };
  } catch (e) {
    console.error('保存入库记录失败:', e);
    return {
      success: false,
      errMsg: e.message || '保存入库记录失败'
    };
  }
};
