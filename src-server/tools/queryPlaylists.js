const mockPlaylists = [
  { name: '深夜写代码', scene: '专注', tracks: 32, style: '电子 / 氛围', description: '适合安静工作和学习' },
  { name: '通勤醒脑', scene: '通勤', tracks: 24, style: '流行 / 摇滚', description: '节奏更明亮，适合早晨出门' },
  { name: '雨天慢歌', scene: '放松', tracks: 28, style: '民谣 / R&B', description: '适合下雨天和睡前' },
  { name: '运动燃脂', scene: '运动', tracks: 36, style: '电子 / Hip-Hop', description: '节奏强，适合跑步训练' },
];

export const queryPlaylistsTool = {
  name: 'queryPlaylists',
  description: '查询歌单、播放列表、场景音乐、氛围歌单和曲目数量。',
  priority: 15,
  keywords: ['歌单', '播放列表', '场景', '氛围', '专注', '运动', '通勤', '放松'],
  run() {
    const focusPlaylist = mockPlaylists.find((playlist) => playlist.scene === '专注') || mockPlaylists[0];
    const totalTracks = mockPlaylists.reduce((sum, playlist) => sum + playlist.tracks, 0);

    return {
      mode: 'tool:queryPlaylists',
      answer: `当前有 ${mockPlaylists.length} 个样例歌单，共 ${totalTracks} 首曲目。若你想学习或写代码，可以先试试《${focusPlaylist.name}》，它偏${focusPlaylist.style}。`,
      cards: [
        { label: '歌单数量', value: `${mockPlaylists.length} 个` },
        { label: '曲目总数', value: `${totalTracks} 首` },
        { label: '推荐歌单', value: focusPlaylist.name },
      ],
      table: mockPlaylists,
    };
  },
};
