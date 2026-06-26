const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const { requireMiniappPermission, deniedResult } = require('./miniappAuth')

exports.main = async (event, context) => {
  const { fileID } = event

  try {
    const auth = await requireMiniappPermission(cloud, db)
    if (!auth.allowed) return deniedResult(auth)

    const result = await cloud.getTempFileURL({
      fileList: [fileID]
    })

    if (result.fileList && result.fileList.length > 0) {
      // 返回真实URL，可用于添加图片处理参数
      return {
        success: true,
        realUrl: result.fileList[0].tempFileURL
      }
    } else {
      return {
        success: false,
        errMsg: '获取URL失败'
      }
    }
  } catch (err) {
    return {
      success: false,
      errMsg: err.message
    }
  }
}
