const mockWorkfaces = [
  { name: '101工作面', status: '重点关注', risk: '偏高', manager: '张工' },
  { name: '203工作面', status: '正常', risk: '中等', manager: '李工' },
  { name: '305工作面', status: '正常', risk: '较低', manager: '王工' },
];

export const queryWorkfacesTool = {
  name: 'queryWorkfaces',
  priority: 15,
  keywords: ['工作面', '概况', '状态'],
  run() {
    const highRiskWorkfaces = mockWorkfaces.filter((item) => item.risk === '偏高');
    const main = highRiskWorkfaces[0] || mockWorkfaces[0];

    return {
      mode: 'tool:queryWorkfaces',
      answer: `当前共有 ${mockWorkfaces.length} 个工作面，其中 ${highRiskWorkfaces.length} 个需要重点关注。当前重点区域是 ${main.name}，风险状态为${main.risk}，负责人是${main.manager}。`,
      cards: [
        { label: '工作面数量', value: `${mockWorkfaces.length} 个` },
        { label: '重点关注', value: `${highRiskWorkfaces.length} 个` },
        { label: '重点区域', value: main.name },
      ],
      table: mockWorkfaces,
    };
  },
};
