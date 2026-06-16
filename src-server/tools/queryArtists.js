const mockArtists = [
  { name: '周杰伦', region: '中国台湾', style: '华语流行 / R&B', representative: '晴天', followers: '4200万' },
  { name: '蔡健雅', region: '新加坡', style: '流行 / R&B', representative: '达尔文', followers: '1200万' },
  { name: '陈奕迅', region: '中国香港', style: '粤语流行', representative: '富士山下', followers: '3100万' },
  { name: 'Aimer', region: '日本', style: 'J-Pop / 抒情摇滚', representative: '残响散歌', followers: '900万' },
];

export const queryArtistsTool = {
  name: 'queryArtists',
  description: '查询歌手、艺人、代表作、音乐风格和粉丝数据。',
  priority: 15,
  keywords: ['歌手', '艺人', 'artist', '代表作', '风格'],
  run() {
    const topArtist = mockArtists[0];

    return {
      mode: 'tool:queryArtists',
      answer: `当前样例库中有 ${mockArtists.length} 位歌手。推荐先关注${topArtist.name}，代表作是《${topArtist.representative}》，风格为${topArtist.style}。`,
      cards: [
        { label: '歌手数量', value: `${mockArtists.length} 位` },
        { label: '推荐歌手', value: topArtist.name },
        { label: '代表作', value: topArtist.representative },
      ],
      table: mockArtists,
    };
  },
};
