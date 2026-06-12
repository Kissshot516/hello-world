const mockAlerts = [
  { id: 'A-1001', workface: '101工作面', level: '高', type: '钻屑量异常', count: 4, date: '2026-06-05' },
  { id: 'A-1002', workface: '101工作面', level: '中', type: '应力波动', count: 3, date: '2026-06-06' },
  { id: 'A-1003', workface: '203工作面', level: '高', type: '微震事件密集', count: 2, date: '2026-06-07' },
  { id: 'A-1004', workface: '305工作面', level: '低', type: '数据延迟', count: 3, date: '2026-06-08' },
];

export const queryAlertsTool = {
  name: 'queryAlerts',
  priority: 10,
  keywords: ['告警', '报警', '预警', '异常', '风险'],
  run() {
    const total = mockAlerts.reduce((sum, item) => sum + item.count, 0);
    const high = mockAlerts.filter((item) => item.level === '高').reduce((sum, item) => sum + item.count, 0);
    const main = mockAlerts[0];

    return {
      mode: 'tool:queryAlerts',
      answer: `近 7 天共发现 ${total} 条告警，其中高风险 ${high} 条。主要集中在 ${main.workface}，核心问题是${main.type}。建议先复核该工作面的钻屑量、应力趋势和现场处置记录。`,
      cards: [
        { label: '告警总数', value: `${total} 条` },
        { label: '高风险', value: `${high} 条` },
        { label: '重点区域', value: main.workface },
      ],
      table: mockAlerts,
    };
  },
};
