const mockPushPersons = [
  { name: '张工', role: '安全员', workface: '101工作面', channel: '短信 + 企业微信', enabled: '是' },
  { name: '李工', role: '调度员', workface: '101工作面', channel: '企业微信', enabled: '是' },
  { name: '王工', role: '技术负责人', workface: '203工作面', channel: '短信', enabled: '否' },
];

export const queryPushPersonsTool = {
  name: 'queryPushPersons',
  priority: 10,
  keywords: ['人员', '推送', '通知', '配置', '联系人'],
  run() {
    const enabledCount = mockPushPersons.filter((person) => person.enabled === '是').length;
    const main = mockPushPersons[0];

    return {
      mode: 'tool:queryPushPersons',
      answer: `当前 mock 数据中共有 ${mockPushPersons.length} 位通知人员，其中 ${enabledCount} 位已启用。${main.workface} 的主要通知对象是${main.name}，角色为${main.role}，通知渠道为${main.channel}。`,
      cards: [
        { label: '人员总数', value: `${mockPushPersons.length} 位` },
        { label: '已启用', value: `${enabledCount} 位` },
        { label: '重点人员', value: main.name },
      ],
      table: mockPushPersons,
    };
  },
};
