const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const MAX_LIMIT = 100; // 微信云数据库单次查询最大限制

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasTrackingNumber(record) {
  return trimString(record.trackingNumber) !== '';
}

function isPendingStatus(record) {
  return record.outboundStatus === 'pending';
}

function isOrderOutboundRecord(record) {
  return record.source === 'order' || (!record.source && trimString(record.linkedOrderId) !== '');
}

function isPendingOutboundRecord(record) {
  return isOrderOutboundRecord(record) && isPendingStatus(record) && !hasTrackingNumber(record);
}

function normalizePageSize(limit) {
  const pageSize = parseInt(limit, 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return 20;
  }
  return Math.min(pageSize, MAX_LIMIT);
}

function normalizeSkip(cursor) {
  const skipValue = parseInt(cursor, 10);
  if (!Number.isFinite(skipValue) || skipValue < 0) {
    return 0;
  }
  return skipValue;
}

exports.main = async (event, context) => {
  try {
    const { type, limit = 20, cursor, customerName, trackingNumber, startDate, endDate, shopName, channelType, model, _id, hasIssue, pendingOnly } = event.data || {};

    // 根据类型选择集合
    const collectionName = type === 'inbound' ? 'inbound_records' : 'outbound_records';
    let query = db.collection(collectionName);

    // 构建查询条件对象（使用 AND 逻辑）
    const conditions = {};

    // 根据客户姓名筛选 (模糊查询)
    if (customerName && customerName.trim() !== '') {
      conditions.customerName = db.RegExp({
        regexp: customerName,
        options: 'i'
      });
    }

    // 根据物流单号筛选 (模糊查询)
    if (trackingNumber && trackingNumber.trim() !== '') {
      conditions.trackingNumber = db.RegExp({
        regexp: trackingNumber,
        options: 'i'
      });
    }

    // 根据店铺名称筛选 (仅入库记录支持)
    if (type === 'inbound' && shopName && shopName.trim() !== '') {
      conditions.shopName = db.RegExp({
        regexp: shopName,
        options: 'i'
      });
    }

    // 根据渠道类型筛选 (仅入库记录支持)
    if (type === 'inbound' && channelType && channelType.trim() !== '') {
      conditions.type = channelType;
    }

    if(_id && _id !== '')
    {
      conditions._id = _id
    }

    // 根据手机型号筛选 (模糊查询)
    if (model && model.trim() !== '') {
      conditions['phoneModels.model'] = db.RegExp({
        regexp: model,
        options: 'i'
      });
    }

    // 根据 hasIssue 筛选 (仅入库记录支持)
    if (type === 'inbound' && hasIssue !== undefined && hasIssue !== null) {
      conditions.hasIssue = hasIssue === true;
    }

    if (type === 'outbound' && pendingOnly === true) {
      conditions.outboundStatus = 'pending';
    }

    // 根据日期范围筛选
    const dateField = type === 'inbound' ? 'inboundDate' : 'outboundDate';
    if (startDate && endDate) {
      conditions[dateField] = _.gte(startDate).and(_.lte(endDate));
    } else if (startDate) {
      conditions[dateField] = _.gte(startDate);
    } else if (endDate) {
      conditions[dateField] = _.lte(endDate);
    }

    



    // 应用所有过滤条件（AND 逻辑）
    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions);
    }

    // 按创建时间倒序查询
    query = query.orderBy('createTime', 'desc');

    let result;
    let nextCursor = null;

    const pageSize = normalizePageSize(limit);
    const skipValue = normalizeSkip(cursor);

    if (type === 'outbound' && pendingOnly === true) {
      const filteredRecords = [];
      let offset = 0;
      let batch = [];

      // 待处理出库单必须先在云函数严格过滤，再分页，避免前端过滤导致 cursor/hasMore 失真。
      do {
        const batchResult = await query
          .skip(offset)
          .limit(MAX_LIMIT)
          .get();
        batch = batchResult.data || [];
        filteredRecords.push(...batch.filter(isPendingOutboundRecord));
        offset += MAX_LIMIT;
      } while (batch.length === MAX_LIMIT);

      result = {
        data: filteredRecords.slice(skipValue, skipValue + pageSize)
      };

      const total = filteredRecords.length;
      if (skipValue + result.data.length < total) {
        nextCursor = skipValue + pageSize;
      }

      return {
        success: true,
        data: result.data,
        cursor: nextCursor,
        hasMore: nextCursor !== null,
        total,
        errMsg: '查询记录成功'
      };
    }

    result = await query
      .limit(pageSize)
      .skip(skipValue)
      .get();

    // 查询总数以准确判断是否还有更多数据
    const countResult = await query.count();
    const total = countResult.total;

    // 判断是否还有更多数据
    if (skipValue + result.data.length < total) {
      nextCursor = skipValue + pageSize;
    }

    return {
      success: true,
      data: result.data,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
      total,
      errMsg: '查询记录成功'
    };
  } catch (e) {
    console.error('查询记录失败:', e);
    return {
      success: false,
      errMsg: e.message || '查询记录失败'
    };
  }
};
