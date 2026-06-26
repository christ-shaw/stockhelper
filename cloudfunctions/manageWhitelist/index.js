// 旧白名单管理入口已废弃。
// 用户授权统一在 hc-admin 后台的 permission_users/user_roles/roles 中维护。
exports.main = async () => ({
  success: false,
  code: 'DEPRECATED',
  errMsg: '白名单管理已迁移到后台用户角色管理，请在 hc-admin 中添加用户并分配角色'
})
