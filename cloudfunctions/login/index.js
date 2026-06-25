// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()

  // 接收前端传来的昵称和头像（用于更新）
  const { nickname, avatarUrl } = event || {}

  try {
    // 查询用户是否在白名单中
    const res = await db.collection('user_whitelist').where({
      openid: wxContext.OPENID
    }).get()

    const isWhitelisted = res.data.length > 0

    if (isWhitelisted && res.data.length > 0) {
      const userRecord = res.data[0]

      // 如果前端传来了新的昵称或头像，更新到数据库
      if (nickname || avatarUrl) {
        const updateData = {}
        if (nickname) updateData.nickname = nickname
        if (avatarUrl) updateData.avatarUrl = avatarUrl
        updateData.updateTime = new Date().toISOString()

        await db.collection('user_whitelist').doc(userRecord._id).update({
          data: updateData
        })
      }

      // 返回数据库中的用户信息
      return {
        event,
        openid: wxContext.OPENID,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID,
        isWhitelisted: true,
        nickname: userRecord.nickname || nickname || '',
        avatarUrl: userRecord.avatarUrl || avatarUrl || ''
      }
    }

    // 不在白名单
    return {
      event,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      isWhitelisted: false
    }
  } catch (err) {
    console.error('查询白名单失败:', err)
    return {
      event,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      isWhitelisted: false,
      error: err.message
    }
  }
}
