const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { periodType = 'day', startDate, endDate } = event;

  try {
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let queryStartDate, queryEndDate;

    if (startDate && endDate) {
      queryStartDate = new Date(startDate);
      queryEndDate = new Date(endDate);
    } else {
      queryEndDate = new Date();
      queryStartDate = new Date();
      queryStartDate.setDate(queryStartDate.getDate() - 30);
    }

    const dateMap = {};

    const daysDiff = Math.ceil((queryEndDate - queryStartDate) / (1000 * 60 * 60 * 24));
    for (let i = 0; i <= daysDiff; i++) {
      const d = new Date(queryStartDate);
      d.setDate(d.getDate() + i);
      const dateStr = formatDate(d);
      dateMap[dateStr] = {
        period: dateStr,
        count: 0,           // 入库记录数
        phoneCount: 0       // 手机台数
      };
    }

    const inboundRes = await db.collection('inbound_records')
      .where({
        inboundDate: db.command.gte(formatDate(queryStartDate)).and(db.command.lte(formatDate(queryEndDate)))
      })
      .limit(1000)
      .get();

      console.log("size = ", inboundRes.data.length)

    inboundRes.data.forEach(record => {
      if (dateMap[record.inboundDate]) {
        dateMap[record.inboundDate].count += 1;
        // 累加手机台数
        if (record.phoneModels && Array.isArray(record.phoneModels)) {
          record.phoneModels.forEach(phone => {
            dateMap[record.inboundDate].phoneCount += (phone.quantity || 0);
          });
        }
      }
    });

    const chartData = Object.values(dateMap)
      .sort((a, b) => new Date(a.period) - new Date(b.period));

    // 手机台数图表数据
    const phoneChartData = chartData.map(item => ({
      period: item.period,
      count: item.phoneCount
    }));

    const totalInboundCount = inboundRes.data.length;
    const totalPhoneCount = chartData.reduce((sum, item) => sum + item.phoneCount, 0);

    return {
      success: true,
      data: {
        chartData,           // 入库记录数统计
        phoneChartData,      // 手机台数统计
        totalInboundCount,
        totalPhoneCount
      }
    };

  } catch (err) {
    console.error('查询统计数据失败:', err);
    return {
      success: false,
      errMsg: err.message
    };
  }
};
