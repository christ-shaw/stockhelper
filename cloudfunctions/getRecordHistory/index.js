const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    console.log(event)
    const { recordId } = event.data || {}

    // 参数校验
    if (!recordId) {
      return {
        success: false,
        errMsg: '记录ID不能为空'
      }
    }

    console.log('查询修改历史，recordId:', recordId)

    // 查询修改历史
    const result = await db.collection('record_history')
      .where({
        recordId: recordId
      })
      .orderBy('modifiedAt', 'desc')
      .get()

    return {
      success: true,
      data: result.data,
      total: result.data.length,
      errMsg: '查询成功'
    }
  } catch (err) {
    console.error('查询修改历史失败:', err)
    return {
      success: false,
      errMsg: err.message || '查询失败'
    }
  }
}
