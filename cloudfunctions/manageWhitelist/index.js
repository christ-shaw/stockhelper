// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const { action, openid, remark } = event

  try {
    if (action === 'add') {
      // 添加用户到白名单
      const res = await db.collection('user_whitelist').add({
        data: {
          openid: openid,
          remark: remark || '',
          createTime: new Date(),
          createBy: wxContext.OPENID
        }
      })
      return {
        success: true,
        _id: res._id,
        message: '添加成功'
      }
    } else if (action === 'remove') {
      // 从白名单移除用户
      const res = await db.collection('user_whitelist').where({
        openid: openid
      }).remove()

      return {
        success: true,
        removed: res.removed,
        message: '移除成功'
      }
    } else if (action === 'list') {
      // 获取白名单列表
      const res = await db.collection('user_whitelist')
        .orderBy('createTime', 'desc')
        .get()

      return {
        success: true,
        data: res.data
      }
    } else if (action === 'check') {
      // 检查用户是否在白名单中
      const res = await db.collection('user_whitelist').where({
        openid: openid
      }).get()

      return {
        success: true,
        isWhitelisted: res.data.length > 0
      }
    } else {
      return {
        success: false,
        message: '无效的操作'
      }
    }
  } catch (err) {
    console.error('管理白名单失败:', err)
    return {
      success: false,
      message: err.message
    }
  }
}
