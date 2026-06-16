const mockSongs = [
  { title: '夜航星', artist: '不才', genre: '国风流行', mood: '辽阔', duration: '04:52', popularity: 92 },
  { title: '晴天', artist: '周杰伦', genre: '华语流行', mood: '怀旧', duration: '04:29', popularity: 98 },
  { title: '达尔文', artist: '蔡健雅', genre: 'R&B', mood: '温柔', duration: '04:25', popularity: 88 },
  { title: '悬溺', artist: '葛东琪', genre: '独立流行', mood: '沉浸', duration: '03:17', popularity: 90 },
];

export const querySongsTool = {
  name: 'querySongs',
  description: '查询歌曲推荐、热门歌曲、歌曲风格、情绪和热度数据。',
  priority: 20,
  keywords: ['歌曲', '歌', '音乐', '单曲', '推荐', '好听'],
  run() {
    const topSong = mockSongs.slice().sort((a, b) => b.popularity - a.popularity)[0];
    const genres = [...new Set(mockSongs.map((song) => song.genre))];

    return {
      mode: 'tool:querySongs',
      answer: `当前曲库中有 ${mockSongs.length} 首样例歌曲，热度最高的是《${topSong.title}》，歌手是${topSong.artist}。曲库覆盖 ${genres.length} 种风格，适合做基础音乐推荐练习。`,
      cards: [
        { label: '歌曲数量', value: `${mockSongs.length} 首` },
        { label: '最高热度', value: topSong.title },
        { label: '风格数量', value: `${genres.length} 种` },
      ],
      table: mockSongs,
    };
  },
};
