const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const MAX_LIMIT = 100; // 微信云数据库单次查询最大限制
const { requireMiniappPermission, deniedResult } = require('./miniappAuth');

exports.main = async (event, context) => {
  try {
    const auth = await requireMiniappPermission(cloud, db, ['logs:read']);
    if (!auth.allowed) return deniedResult(auth);

    const {
      limit = 20,
      cursor,
      logType,
      operationType,
      operator,
      startDate,
      endDate
    } = event;

    // 限制每页最大数量
    const pageSize = Math.min(limit, MAX_LIMIT);

    // 构建查询条件
    let query = db.collection('operation_logs');
    const conditions = {};

    // 日志类型筛选
    if (logType) {
      conditions.logType = logType;
    }

    // 操作类型筛选
    if (operationType) {
      conditions.operationType = operationType;
    }

    // 操作人筛选
    if (operator) {
      conditions.operator = db.RegExp({
        regexp: operator,
        options: 'i' // 不区分大小写
      });
    }

    // 时间范围筛选
    if (startDate || endDate) {
      if (startDate && endDate) {
        conditions.createTime = _.and(
          _.gte(new Date(startDate)),
          _.lte(new Date(endDate + ' 23:59:59'))
        );
      } else if (startDate) {
        conditions.createTime = _.gte(new Date(startDate));
      } else if (endDate) {
        conditions.createTime = _.lte(new Date(endDate + ' 23:59:59'));
      }
    }

    // 应用所有过滤条件
    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions);
    }

    // 按创建时间倒序查询
    query = query.orderBy('createTime', 'desc');

    // 确定跳过的记录数
    const skipValue = cursor ? parseInt(cursor) : 0;

    // 查询记录列表
    const listResult = await query
      .limit(pageSize)
      .skip(skipValue)
      .get();

    // 查询总数以准确判断是否还有更多数据
    const countResult = await query.count();
    const total = countResult.total;

    // 判断是否还有更多数据
    let nextCursor = null;
    if (skipValue + listResult.data.length < total) {
      nextCursor = skipValue + pageSize;
    }

    return {
      success: true,
      data: listResult.data,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
      total: total,
      errMsg: '查询成功'
    };
  } catch (e) {
    console.error('查询操作记录失败:', e);
    return {
      success: false,
      data: [],
      cursor: null,
      hasMore: false,
      total: 0,
      errMsg: e.message || '查询操作记录失败'
    };
  }
};
