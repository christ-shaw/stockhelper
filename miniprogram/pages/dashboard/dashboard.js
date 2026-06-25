// pages/dashboard/dashboard.js
Page({
  data: {
    startDate: '',
    endDate: '',
    dateRangeText: '',
    loading: false
  },

  onLoad() {
    this.checkAuth();
    this.initCloud();
    this.initDates();
  },

  onReady() {
    this.initCharts();
  },

  checkAuth() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  initCloud() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({ traceUser: true });
    }
  },

  initDates() {
    const today = new Date();
    const endDate = this.formatDate(today);
    const startDate = this.formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
    this.updateDateRangeText(startDate, endDate);
    this.setData({ startDate, endDate });
  },

  updateDateRangeText(start, end) {
    this.setData({ dateRangeText: `${start} 至 ${end}` });
  },

  loadPrevious() {
    if (this.data.loading) return;
    const s = new Date(this.data.startDate);
    const e = new Date(this.data.endDate);
    s.setDate(s.getDate() - 7); e.setDate(e.getDate() - 7);
    this.setData({ startDate: this.formatDate(s), endDate: this.formatDate(e) });
    this.updateDateRangeText(this.data.startDate, this.data.endDate);
    this.loadDashboardData();
  },

  loadNext() {
    if (this.data.loading) return;
    const s = new Date(this.data.startDate);
    const e = new Date(this.data.endDate);
    s.setDate(s.getDate() + 7); e.setDate(e.getDate() + 7);
    const today = new Date();
    if (s > today) { wx.showToast({ title: '已到最新数据', icon: 'none' }); return; }
    this.setData({
      startDate: this.formatDate(s),
      endDate: e > today ? this.formatDate(today) : this.formatDate(e)
    });
    this.updateDateRangeText(this.data.startDate, this.data.endDate);
    this.loadDashboardData();
  },

  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  },

  initCharts() {
    let count = 0;
    const checkDone = () => {
      count++;
      if (count === 2) this.loadDashboardData();
    };

    // 记录数图表
    const q1 = wx.createSelectorQuery().in(this);
    q1.select('#recordChart').fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        const canvas = res[0].node;
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        const w = res[0].width, h = res[0].height;
        canvas.width = w * dpr; canvas.height = h * dpr;
        const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
        this.recordCtx = ctx; this.recordW = w; this.recordH = h;
        console.log('记录数图表就绪:', w, h);
      }
      checkDone();
    });

    // 台数图表
    const q2 = wx.createSelectorQuery().in(this);
    q2.select('#phoneChart').fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        const canvas = res[0].node;
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        const w = res[0].width, h = res[0].height;
        canvas.width = w * dpr; canvas.height = h * dpr;
        const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
        this.phoneCtx = ctx; this.phoneW = w; this.phoneH = h;
        console.log('台数图表就绪:', w, h);
      }
      checkDone();
    });
  },

  async loadDashboardData() {
    this.setData({ loading: true });
    try {
      const [inboundRes, outboundRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getInboundStats',
          data: { periodType: 'day', startDate: this.data.startDate, endDate: this.data.endDate }
        }),
        wx.cloud.callFunction({
          name: 'getOutboundStats',
          data: { periodType: 'day', startDate: this.data.startDate, endDate: this.data.endDate }
        })
      ]);

      const inResult = (inboundRes.result && inboundRes.result.success) ? inboundRes.result.data : {};
      const outResult = (outboundRes.result && outboundRes.result.success) ? outboundRes.result.data : {};

      // 记录数数据
      const inRecords = inResult.chartData || [];
      const outRecords = outResult.chartData || [];

      // 台数数据
      const inPhones = inResult.phoneChartData || [];
      const outPhones = outResult.phoneChartData || [];

      this.setData({ loading: false });

      // 绘制记录数图表
      this.drawBarChart(this.recordCtx, this.recordW, this.recordH, inRecords, outRecords, '出入库记录数');
      // 绘制台数图表
      this.drawBarChart(this.phoneCtx, this.phoneW, this.phoneH, inPhones, outPhones, '出入库手机台数');

    } catch (e) {
      console.error('加载数据失败:', e);
      this.setData({ loading: false });
    }
  },

  drawBarChart(ctx, W, H, inData, outData, title) {
    if (!ctx || !W || !H) { console.error('画布未就绪:', title); return; }
    if (!inData || !inData.length) return;

    const padL = 40, padR = 14, padT = 44, padB = 42;
    const cW = W - padL - padR;
    const cH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);

    // 标题
    ctx.fillStyle = '#333'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(title, W / 2, 6);

    // 最大值
    const counts = [...inData.map(d => d.count||0), ...outData.map(d => d.count||0)];
    let maxV = Math.max(...counts, 1);
    maxV = Math.ceil(maxV / 5) * 5 || 5;

    // 图例
    const ly = 24, lx = W / 2;
    ctx.fillStyle = '#4facfe'; ctx.fillRect(lx - 52, ly, 10, 10);
    ctx.fillStyle = '#555'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('入库', lx - 38, ly + 6);
    ctx.fillStyle = '#ff4d6a'; ctx.fillRect(lx + 4, ly, 10, 10);
    ctx.fillStyle = '#555'; ctx.fillText('出库', lx + 18, ly + 6);

    // Y轴
    const ySteps = 4;
    ctx.font = '10px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= ySteps; i++) {
      const y = padT + (cH / ySteps) * i;
      const val = maxV - (maxV / ySteps) * i;
      ctx.strokeStyle = i === 0 ? '#ccc' : '#f0f0f0'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = '#888'; ctx.fillText(Math.round(val).toString(), padL - 6, y);
    }

    // X轴
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();

    // 柱状图
    const n = inData.length;
    const groupW = cW / n;
    const barW = Math.min(groupW * 0.30, 22);
    const barGap = 3;

    for (let i = 0; i < n; i++) {
      const gX = padL + groupW * i;
      const offset = (groupW - barW * 2 - barGap) / 2;

      // 入库
      const iv = (inData[i] && inData[i].count) || 0;
      if (iv > 0) {
        const bh = Math.max((iv / maxV) * cH, 2);
        const bx = gX + offset, by = H - padB - bh;
        const g = ctx.createLinearGradient(bx, by, bx, H - padB);
        g.addColorStop(0, '#4facfe'); g.addColorStop(1, '#00e0ff'); ctx.fillStyle = g;
        this.drawRoundRect(ctx, bx, by, barW, bh, 2);
        ctx.fillStyle = '#333'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(iv), bx + barW / 2, by - 2);
      }

      // 出库
      const ov = (outData[i] && outData[i].count) || 0;
      if (ov > 0) {
        const bh = Math.max((ov / maxV) * cH, 2);
        const bx = gX + offset + barW + barGap, by = H - padB - bh;
        const g = ctx.createLinearGradient(bx, by, bx, H - padB);
        g.addColorStop(0, '#ff7eb3'); g.addColorStop(1, '#ff4d6a'); ctx.fillStyle = g;
        this.drawRoundRect(ctx, bx, by, barW, bh, 2);
        ctx.fillStyle = '#333'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(ov), bx + barW / 2, by - 2);
      }

      // X轴标签
      ctx.fillStyle = '#777'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const label = this.formatLabel(inData[i] ? inData[i].period : '');
      ctx.fillText(label, gX + groupW / 2, H - padB + 6);
    }
  },

  drawRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  },

  formatLabel(period) {
    if (!period) return '';
    if (period.length >= 10) return period.slice(5);
    return period;
  }
});
