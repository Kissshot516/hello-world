const mockDrilling = [
  { workface: '101工作面', holes: 18, abnormal: 5, avgDepth: 22.4, risk: '偏高' },
  { workface: '203工作面', holes: 12, abnormal: 2, avgDepth: 19.8, risk: '中等' },
  { workface: '305工作面', holes: 9, abnormal: 1, avgDepth: 16.1, risk: '较低' },
];

export const queryDrillingTool = {
  name: 'queryDrilling',
  priority: 20,
  keywords: ['钻孔', '钻屑', '孔', '进尺'],
  run() {
    const target = mockDrilling[0];
    const totalHoles = mockDrilling.reduce((sum, item) => sum + item.holes, 0);
    const abnormal = mockDrilling.reduce((sum, item) => sum + item.abnormal, 0);

    return {
      mode: 'tool:queryDrilling',
      answer: `当前 mock 数据中共有 ${totalHoles} 个钻孔记录，异常孔 ${abnormal} 个。${target.workface} 异常占比最高，风险状态为${target.risk}，建议优先查看单孔趋势和每米钻屑量曲线。`,
      cards: [
        { label: '钻孔总数', value: `${totalHoles} 个` },
        { label: '异常孔', value: `${abnormal} 个` },
        { label: '重点工作面', value: target.workface },
      ],
      table: mockDrilling,
    };
  },
};
