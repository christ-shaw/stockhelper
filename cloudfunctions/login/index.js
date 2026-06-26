// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const MINIAPP_ACCESS_PERMISSION = 'miniapp:access'
const USER_COLLECTION = 'permission_users'
const USER_ROLE_COLLECTION = 'user_roles'
const ROLE_COLLECTION = 'roles'

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)))
}

function hasPermission(actions, permission) {
  const list = unique(actions)
  return list.includes('*') || list.includes(permission)
}

async function findOne(collection, condition) {
  const res = await collection.where(condition).limit(1).get()
  return res.data && res.data[0] || null
}

async function getPermissionUser(db, openid) {
  const byUserId = await findOne(db.collection(USER_COLLECTION), { userId: openid })
  if (byUserId) return byUserId
  return findOne(db.collection(USER_COLLECTION), { openid })
}

async function getRole(db, roleId) {
  if (!roleId) return null
  try {
    const res = await db.collection(ROLE_COLLECTION).doc(roleId).get()
    return res.data || null
  } catch (err) {
    const message = String(err && err.message || '')
    if (message.includes('not exist') || message.includes('does not exist')) return null
    throw err
  }
}

function unauthorized(wxContext, code, errMsg) {
  return {
    success: false,
    isAuthorized: false,
    isWhitelisted: false,
    code,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    errMsg
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()

  const { nickname, avatarUrl } = event || {}

  try {
    const openid = wxContext.OPENID
    if (!openid) {
      return unauthorized(wxContext, 'LOGIN_REQUIRED', '无法获取当前微信用户身份')
    }

    const userRecord = await getPermissionUser(db, openid)
    if (!userRecord) {
      return unauthorized(wxContext, 'MINIAPP_ACCESS_DENIED', '当前用户暂无小程序访问权限，请联系管理员')
    }

    const userRole = await findOne(db.collection(USER_ROLE_COLLECTION), { userId: userRecord.userId || openid })
    if (!userRole) {
      return unauthorized(wxContext, 'ROLE_UNASSIGNED', '当前用户未分配角色，请联系管理员')
    }

    const role = await getRole(db, userRole.roleId)
    if (!role) {
      return unauthorized(wxContext, 'ROLE_NOT_FOUND', '用户关联的角色不存在，请联系管理员')
    }

    const actionPermissions = unique(role.actionPermissions)
    if (!hasPermission(actionPermissions, MINIAPP_ACCESS_PERMISSION)) {
      return unauthorized(wxContext, 'MINIAPP_ACCESS_DENIED', '当前用户暂无小程序访问权限，请联系管理员')
    }

    if (nickname || avatarUrl) {
      const updateData = {
        updatedAt: new Date().toISOString()
      }
      if (nickname) {
        updateData.nickName = nickname
        updateData.nickname = nickname
      }
      if (avatarUrl) updateData.avatarUrl = avatarUrl

      await db.collection(USER_COLLECTION).doc(userRecord._id).update({
        data: updateData
      })
    }

    return {
      success: true,
      isAuthorized: true,
      isWhitelisted: true,
      openid,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      nickname: nickname || userRecord.nickName || userRecord.nickname || '',
      avatarUrl: avatarUrl || userRecord.avatarUrl || '',
      role: {
        roleId: role._id,
        roleName: role.name || '',
        roleCode: role.code || ''
      },
      actionPermissions
    }
  } catch (err) {
    console.error('查询用户授权失败:', err)
    return unauthorized(wxContext, 'PERMISSION_LOAD_FAILED', err.message || '查询用户授权失败')
  }
}
