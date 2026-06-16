const mockConcerts = [
  { artist: '陈奕迅', city: '上海', venue: '梅赛德斯-奔驰文化中心', date: '2026-07-18', status: '预售中' },
  { artist: 'Aimer', city: '北京', venue: '国家体育馆', date: '2026-08-03', status: '即将开票' },
  { artist: '蔡健雅', city: '广州', venue: '宝能广州国际体育演艺中心', date: '2026-08-22', status: '售票中' },
];

export const queryConcertsTool = {
  name: 'queryConcerts',
  description: '查询演唱会、音乐节、巡演城市、场馆、日期和售票状态。',
  priority: 10,
  keywords: ['演唱会', '音乐节', '巡演', '门票', '开票', '场馆'],
  run() {
    const nextConcert = mockConcerts[0];

    return {
      mode: 'tool:queryConcerts',
      answer: `当前样例中有 ${mockConcerts.length} 场演出信息。最近一场是${nextConcert.artist}在${nextConcert.city}的演唱会，日期为 ${nextConcert.date}，状态是${nextConcert.status}。`,
      cards: [
        { label: '演出数量', value: `${mockConcerts.length} 场` },
        { label: '最近演出', value: nextConcert.artist },
        { label: '城市', value: nextConcert.city },
      ],
      table: mockConcerts,
    };
  },
};
