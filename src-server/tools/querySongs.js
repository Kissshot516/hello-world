const mockSongs = [
  {
    title: '夜航星',
    artist: '不才',
    genre: '国风流行',
    mood: '辽阔',
    scene: '专注',
    language: '中文',
    duration: '04:52',
    popularity: 92,
  },
  {
    title: '晴天',
    artist: '周杰伦',
    genre: '华语流行',
    mood: '怀旧',
    scene: '通勤',
    language: '中文',
    duration: '04:29',
    popularity: 98,
  },
  {
    title: '达尔文',
    artist: '蔡健雅',
    genre: 'R&B',
    mood: '温柔',
    scene: '放松',
    language: '中文',
    duration: '04:25',
    popularity: 88,
  },
  {
    title: '悬溺',
    artist: '葛东琪',
    genre: '独立流行',
    mood: '沉浸',
    scene: '深夜',
    language: '中文',
    duration: '03:17',
    popularity: 90,
  },
  {
    title: 'マリーゴールド',
    artist: 'Aimyon',
    genre: 'J-Pop',
    mood: '轻松',
    scene: '通勤',
    language: '日语',
    duration: '05:06',
    popularity: 91,
  },
  {
    title: '残響散歌',
    artist: 'Aimer',
    genre: 'J-Pop / Rock',
    mood: '燃',
    scene: '运动',
    language: '日语',
    duration: '03:04',
    popularity: 94,
  },
];

const SCENE_CHOICES = [
  { value: '通勤', aliases: ['通勤', '上班', '下班', '路上', '地铁', '公交', '开车'] },
  { value: '专注', aliases: ['专注', '学习', '写代码', '工作', '办公', '编程'] },
  { value: '放松', aliases: ['放松', '休息', '睡前', '雨天'] },
  { value: '深夜', aliases: ['深夜', '夜晚', '晚上', '熬夜'] },
  { value: '运动', aliases: ['运动', '跑步', '健身', '燃脂'] },
];

const MOOD_CHOICES = [
  { value: '轻松', aliases: ['轻松', '舒服', '愉快'] },
  { value: '温柔', aliases: ['温柔', '柔和', '治愈'] },
  { value: '怀旧', aliases: ['怀旧', '回忆', '青春'] },
  { value: '燃', aliases: ['燃', '热血', '有劲', '高能'] },
  { value: '沉浸', aliases: ['沉浸', '安静', '氛围'] },
  { value: '辽阔', aliases: ['辽阔', '宏大', '开阔'] },
];

const GENRE_CHOICES = [
  { value: 'J-Pop', aliases: ['j-pop', 'jpop', '日系流行'] },
  { value: 'J-Pop / Rock', aliases: ['j-pop / rock', 'jpop rock', '日摇', '摇滚'] },
  { value: 'R&B', aliases: ['r&b', 'rnb'] },
  { value: '国风流行', aliases: ['国风', '国风流行'] },
  { value: '华语流行', aliases: ['华语', '华语流行', '流行'] },
  { value: '独立流行', aliases: ['独立', '独立流行'] },
];

const LANGUAGE_CHOICES = [
  { value: '中文', aliases: ['中文', '华语', '国语'] },
  { value: '日语', aliases: ['日语', '日文', '日本'] },
  { value: '英语', aliases: ['英语', '英文'] },
];

const CHINESE_NUMBER_MAP = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

export const querySongsTool = {
  name: 'querySongs',
  description: '查询歌曲推荐、热门歌曲、歌曲风格、语言、场景、情绪和热度数据。',
  priority: 20,
  keywords: ['歌曲', '歌', '音乐', '单曲', '推荐', '好听', '通勤', '日语', '中文', '轻松'],
  schema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '用户想搜索的歌曲名、歌手名、关键词或原始偏好，例如 Aimyon、周杰伦、通勤。',
      },
      scene: {
        type: 'string',
        description: '听歌场景，例如通勤、专注、放松、深夜、运动。',
      },
      mood: {
        type: 'string',
        description: '想要的歌曲情绪，例如轻松、温柔、怀旧、燃、沉浸。',
      },
      genre: {
        type: 'string',
        description: '音乐风格，例如 J-Pop、R&B、华语流行、独立流行。',
      },
      language: {
        type: 'string',
        description: '歌曲语言，例如中文、日语、英语。',
      },
      limit: {
        type: 'number',
        description: '最多返回几首歌，默认 5，最大 10。',
      },
    },
  },
  validateArgs: validateSongArgs,
  mergeMemoryArgs: mergeSongMemoryArgs,
  run(rawArgs = {}) {
    const { args } = validateSongArgs(rawArgs);
    const { message, keyword, scene, mood, genre, language, limit } = args;
    const query = normalize([message, keyword].filter(Boolean).join(' '));
    const filters = {
      scene: normalize(scene),
      mood: normalize(mood),
      genre: normalize(genre),
      language: normalize(language),
    };

    const exactMatches = rankSongs(
      mockSongs.filter((song) => matchesExactFilters(song, filters)),
      query,
      filters
    ).slice(0, limit);

    const relaxedMatches = rankSongs(
      mockSongs.filter((song) => !exactMatches.includes(song) && matchesRelaxedFilters(song, query, filters)),
      query,
      filters
    ).slice(0, Math.max(limit - exactMatches.length, 0));

    const fallbackMatches = mockSongs
      .filter((song) => !exactMatches.includes(song) && !relaxedMatches.includes(song))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, Math.max(limit - exactMatches.length - relaxedMatches.length, 0));

    const resultSongs = [
      ...tagMatches(exactMatches, '完全匹配'),
      ...tagMatches(relaxedMatches, '相近推荐'),
      ...tagMatches(fallbackMatches, '热门补充'),
    ];
    const topSong = resultSongs[0];
    const meta = createResultMeta({
      requestedLimit: limit,
      exactCount: exactMatches.length,
      relaxedCount: relaxedMatches.length,
      fallbackCount: fallbackMatches.length,
      totalCount: resultSongs.length,
    });

    return {
      mode: 'tool:querySongs',
      answer: buildAnswer({ resultSongs, topSong, args, meta }),
      cards: [
        { label: '返回歌曲', value: `${resultSongs.length} 首` },
        { label: '完全匹配', value: `${meta.exactCount} 首` },
        { label: '结果质量', value: meta.qualityLabel },
        { label: '结构化参数', value: formatParams(args) },
      ],
      table: resultSongs,
      meta,
    };
  },
};

function validateSongArgs(rawArgs = {}) {
  const warnings = [];
  const message = toText(rawArgs.message);
  const keyword = toText(rawArgs.keyword);
  const sourceText = normalize(
    [message, keyword, rawArgs.scene, rawArgs.mood, rawArgs.genre, rawArgs.language].filter(Boolean).join(' ')
  );

  const args = {
    message,
    keyword,
    scene: resolveChoice(rawArgs.scene, sourceText, SCENE_CHOICES, 'scene', warnings),
    mood: resolveChoice(rawArgs.mood, sourceText, MOOD_CHOICES, 'mood', warnings),
    genre: resolveChoice(rawArgs.genre, sourceText, GENRE_CHOICES, 'genre', warnings),
    language: resolveChoice(rawArgs.language, sourceText, LANGUAGE_CHOICES, 'language', warnings),
    limit: resolveLimit(rawArgs.limit, sourceText, warnings),
  };

  return { args, warnings };
}

function mergeSongMemoryArgs(previousArgs = {}, rawArgs = {}) {
  const partialArgs = extractPartialSongArgs(rawArgs);
  const mergedArgs = {
    ...previousArgs,
    ...partialArgs,
    message: toText(rawArgs.message) || toText(previousArgs.message),
    keyword: partialArgs.keyword ?? previousArgs.keyword ?? '',
  };

  if (partialArgs.limit === undefined) {
    if (shouldIncreaseLimit(rawArgs.message)) {
      mergedArgs.limit = Math.min(Number(previousArgs.limit || 5) + 2, 10);
    }

    if (shouldDecreaseLimit(rawArgs.message)) {
      mergedArgs.limit = Math.max(Number(previousArgs.limit || 5) - 2, 1);
    }
  }

  return validateSongArgs(mergedArgs).args;
}

function extractPartialSongArgs(rawArgs = {}) {
  const sourceText = normalize(
    [rawArgs.message, rawArgs.keyword, rawArgs.scene, rawArgs.mood, rawArgs.genre, rawArgs.language]
      .filter(Boolean)
      .join(' ')
  );
  const partialArgs = {};
  const keyword = toText(rawArgs.keyword);
  const scene = resolvePartialChoice(rawArgs.scene, sourceText, SCENE_CHOICES);
  const mood = resolvePartialChoice(rawArgs.mood, sourceText, MOOD_CHOICES);
  const genre = resolvePartialChoice(rawArgs.genre, sourceText, GENRE_CHOICES);
  const language = resolvePartialChoice(rawArgs.language, sourceText, LANGUAGE_CHOICES);
  const limit = parseLimit(rawArgs.limit) ?? parseLimit(sourceText);

  if (keyword) partialArgs.keyword = keyword;
  if (scene) partialArgs.scene = scene;
  if (mood) partialArgs.mood = mood;
  if (genre) partialArgs.genre = genre;
  if (language) partialArgs.language = language;
  if (limit !== null) partialArgs.limit = limit;

  return partialArgs;
}

function resolvePartialChoice(rawValue, sourceText, choices) {
  return matchChoice(toText(rawValue), choices) || matchChoice(sourceText, choices);
}

function rankSongs(songs, query, filters) {
  return songs
    .map((song) => ({
      song,
      score: getSongScore(song, query, filters),
    }))
    .filter((item) => item.score > 0 || !hasActiveFilters(filters))
    .sort((a, b) => b.score - a.score || b.song.popularity - a.song.popularity)
    .map((item) => item.song);
}

function getSongScore(song, query, filters) {
  let score = 0;

  if (textMentions(query, song.title)) score += 4;
  if (textMentions(query, song.artist)) score += 4;
  if (textMentions(query, song.genre)) score += 2;
  if (textMentions(query, song.mood)) score += 2;
  if (textMentions(query, song.scene)) score += 2;
  if (textMentions(query, song.language)) score += 2;
  if (filters.scene && normalize(song.scene) === filters.scene) score += 4;
  if (filters.mood && normalize(song.mood) === filters.mood) score += 3;
  if (filters.genre && normalize(song.genre).includes(filters.genre)) score += 3;
  if (filters.language && normalize(song.language) === filters.language) score += 3;

  return score;
}

function matchesExactFilters(song, filters) {
  if (filters.scene && normalize(song.scene) !== filters.scene) return false;
  if (filters.mood && normalize(song.mood) !== filters.mood) return false;
  if (filters.genre && !normalize(song.genre).includes(filters.genre)) return false;
  if (filters.language && normalize(song.language) !== filters.language) return false;

  return true;
}

function matchesRelaxedFilters(song, query, filters) {
  if (filters.language && normalize(song.language) !== filters.language) return false;

  const score = getSongScore(song, query, filters);
  if (score <= 0) return false;

  return Object.entries(filters).some(([key, value]) => {
    if (!value) return false;
    if (key === 'genre') return normalize(song.genre).includes(value);
    return normalize(song[key]) === value;
  });
}

function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

function tagMatches(songs, matchType) {
  return songs.map((song) => ({
    ...song,
    matchType,
  }));
}

function createResultMeta({ requestedLimit, exactCount, relaxedCount, fallbackCount, totalCount }) {
  const fallbackUsed = fallbackCount > 0;
  const quality = getQuality({ requestedLimit, exactCount, relaxedCount, fallbackCount, totalCount });
  const qualityLabel = {
    exact: '完全满足',
    partial: '部分满足',
    fallback: '热门补充',
    empty: '无结果',
  }[quality];

  return {
    requestedLimit,
    exactCount,
    relaxedCount,
    fallbackCount,
    fallbackUsed,
    totalCount,
    quality,
    qualityLabel,
    message: buildQualityMessage({ requestedLimit, exactCount, relaxedCount, fallbackCount, totalCount }),
  };
}

function getQuality({ requestedLimit, exactCount, relaxedCount, fallbackCount, totalCount }) {
  if (totalCount === 0) return 'empty';
  if (exactCount >= requestedLimit) return 'exact';
  if (exactCount > 0 || relaxedCount > 0) return 'partial';
  if (fallbackCount > 0) return 'fallback';
  return 'empty';
}

function buildQualityMessage({ requestedLimit, exactCount, relaxedCount, fallbackCount, totalCount }) {
  if (totalCount === 0) {
    return `没有找到可推荐歌曲，建议放宽场景、语言或情绪条件。`;
  }

  if (exactCount >= requestedLimit) {
    return `完全匹配 ${exactCount} 首，已满足用户请求数量 ${requestedLimit}。`;
  }

  return `完全匹配 ${exactCount} 首，不足 ${requestedLimit} 首；补充相近推荐 ${relaxedCount} 首、热门补充 ${fallbackCount} 首。`;
}

function buildAnswer({ resultSongs, topSong, args, meta }) {
  if (!topSong) {
    return `根据结构化参数筛选后，当前样例曲库没有可推荐歌曲。参数：${formatParams(args)}。${meta.message}`;
  }

  return `根据结构化参数筛选后，当前返回 ${resultSongs.length} 首样例歌曲。优先推荐《${topSong.title}》，歌手是 ${topSong.artist}，风格是 ${topSong.genre}，适合${topSong.scene}场景。${meta.message} 参数：${formatParams(args)}。`;
}

function resolveChoice(rawValue, sourceText, choices, label, warnings) {
  const value = toText(rawValue);

  if (value) {
    const matchedValue = matchChoice(value, choices);
    if (matchedValue) return matchedValue;

    warnings.push(`${label} 参数暂不支持，已忽略：${value}`);
  }

  return matchChoice(sourceText, choices);
}

function matchChoice(text, choices) {
  const normalizedText = normalize(text);
  if (!normalizedText) return '';

  let matchedValue = '';
  let matchedIndex = -1;

  for (const choice of choices) {
    for (const alias of [choice.value, ...choice.aliases]) {
      const index = normalizedText.lastIndexOf(normalize(alias));
      if (index > matchedIndex) {
        matchedIndex = index;
        matchedValue = choice.value;
      }
    }
  }

  return matchedValue;
}

function resolveLimit(rawLimit, sourceText, warnings) {
  const parsedLimit = parseLimit(rawLimit) ?? parseLimit(sourceText);

  if (parsedLimit === null) {
    return 5;
  }

  if (parsedLimit < 1) {
    warnings.push(`limit 不能小于 1，已改为 1`);
    return 1;
  }

  if (parsedLimit > 10) {
    warnings.push(`limit 不能大于 10，已改为 10`);
    return 10;
  }

  return parsedLimit;
}

function parseLimit(value) {
  const text = toText(value);
  if (!text) return null;

  const digitMatch = text.match(/\d+\s*首?/);
  if (digitMatch) {
    return Number(digitMatch[0].match(/\d+/)[0]);
  }

  const chineseNumberMatch = text.match(/([一二两三四五六七八九十])\s*首/);
  if (!chineseNumberMatch) return null;

  return CHINESE_NUMBER_MAP[chineseNumberMatch[1]] || null;
}

function shouldIncreaseLimit(text) {
  return ['多来', '再来', '多几', '更多', '加几'].some((keyword) => toText(text).includes(keyword));
}

function shouldDecreaseLimit(text) {
  return ['少点', '少一点', '少几', '少来'].some((keyword) => toText(text).includes(keyword));
}

function formatParams(params) {
  const text = Object.entries(params)
    .filter(([key, value]) => key !== 'message' && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('，');

  return text || '未提取到明确参数';
}

function textMentions(text, value) {
  const normalizedText = normalize(text);
  const normalizedValue = normalize(value);
  return Boolean(normalizedText && normalizedValue && normalizedText.includes(normalizedValue));
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function toText(value) {
  return String(value || '').trim();
}
