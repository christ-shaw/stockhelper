const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const { recordId, type, updateData, operator } = event.data || {};

    // 获取微信上下文
    const wxContext = cloud.getWXContext();

    // 参数校验
    console.log('data=  ',event.data )
    console.log('recordid = ',recordId)
    if (!recordId) {
      return {
        success: false,
        errMsg: '记录ID不能为空'
      };
    }

    if (!type || (type !== 'inbound' && type !== 'outbound')) {
      return {
        success: false,
        errMsg: '记录类型必须为 inbound 或 outbound'
      };
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return {
        success: false,
        errMsg: '更新数据不能为空'
      };
    }

    // 根据类型选择集合
    const collectionName = type === 'inbound' ? 'inbound_records' : 'outbound_records';

    // 检查记录是否存在
    const existingRecord = await db.collection(collectionName).doc(recordId).get();

    if (!existingRecord.data) {
      return {
        success: false,
        errMsg: '记录不存在'
      };
    }

    // 构建更新数据
    const dataToUpdate = {
      ...updateData,
      updateTime: new Date().toISOString()
    };

    // 比对变更字段，生成修改记录
    const changes = [];
    for (const [field, newValue] of Object.entries(updateData)) {
      const oldValue = existingRecord.data[field];
      // 使用 JSON 序列化比较，处理对象和数组
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue: oldValue !== undefined ? oldValue : null,
          newValue
        });
      }
    }

    // 更新记录
    const result = await db.collection(collectionName).doc(recordId).update({
      data: dataToUpdate
    });

    // 写入修改历史
    if (changes.length > 0) {
      try {
        await db.collection('record_history').add({
          data: {
            recordId,
            recordType: type,
            modifiedBy: operator || '未知用户',
            modifiedByOpenid: wxContext.OPENID,
            modifiedAt: db.serverDate(),
            changes
          }
        });
        console.log('修改历史记录成功，变更字段数:', changes.length);
      } catch (historyErr) {
        // 修改历史记录失败不影响主流程
        console.error('记录修改历史失败:', historyErr);
      }
    }

    return {
      success: true,
      errMsg: '更新成功',
      data: {
        _id: result._id,
        recordId: recordId,
        ...dataToUpdate
      }
    };
  } catch (e) {
    console.error('更新记录失败:', e);
    return {
      success: false,
      errMsg: e.message || '更新记录失败'
    };
  }
};
