const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { operationType, logType, logId, operationContent, operator, operatorOpenid } = event;

    // 参数验证
    if (!operationType || !logType || !logId || !operationContent || !operator) {
      return {
        success: false,
        errMsg: '缺少必要参数'
      };
    }

    // 验证操作类型
    const validOperationTypes = ['create', 'update', 'delete'];
    if (!validOperationTypes.includes(operationType)) {
      return {
        success: false,
        errMsg: '操作类型无效'
      };
    }

    // 验证日志类型
    const validLogTypes = ['inbound', 'outbound'];
    if (!validLogTypes.includes(logType)) {
      return {
        success: false,
        errMsg: '日志类型无效'
      };
    }

    // 获取当前时间的 wxContext
    const wxContext = cloud.getWXContext();
    
    // 保存操作记录
    const result = await db.collection('operation_logs').add({
      data: {
        operationType,          // 操作类型：create/delete/update
        logType,                // 日志类型：inbound/outbound
        logId,                  // 关联的入库/出库记录ID
        operationContent,       // 操作内容（客户姓名）
        operator,               // 操作人昵称
        operatorOpenid: operatorOpenid || wxContext.OPENID, // 操作人openid
        operationTime: event.operationTime || new Date().toISOString(), // 操作时间
        createTime: db.serverDate() // 数据库创建时间
      }
    });

    console.log('操作记录保存成功，记录ID:', result._id);

    return {
      success: true,
      _id: result._id,
      errMsg: '保存操作记录成功'
    };
  } catch (e) {
    console.error('保存操作记录失败:', e);
    return {
      success: false,
      errMsg: e.message || '保存操作记录失败'
    };
  }
};
