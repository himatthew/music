/** 每句字数，用于歌词行两句之间的视觉分隔 */
export const LYRIC_CHARS_PER_PHRASE = 4;

/** 第一页 = 清晨阳光洒在田野，第二页 = 微风轻拂叶尖摇；第三 / 四页纵轴分别同第一 / 二页 */
export const SCENES = [
  {
    id: "s2",
    lyrics: ["清", "晨", "阳", "光", "洒", "在", "田", "野"],
    /** 1–4 声 + 5 轻声；与教学图示一致 */
    lyricTones: [1, 2, 2, 1, 3, 4, 2, 3],
    palette: [
      { id: "1", t: "1" },
      { id: "2", t: "2" },
      { id: "3", t: "3" },
      { id: "4", t: "4" },
      { id: "5", t: "5" },
      { id: "6", t: "6" },
      { id: "7", t: "7" },
      { id: "L7", t: "7", low: true },
      { id: "L6", t: "6", low: true },
    ],
    pairLadders: {
      left: [
        { role: "pick", id: "5", t: "5" },
        { role: "hint", id: "4", t: "4" },
        { role: "pick", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
      ],
      right: [
        { role: "pick", id: "5", t: "5" },
        { role: "hint", id: "4", t: "4" },
        { role: "hint", id: "3", t: "3" },
        { role: "pick", id: "2", t: "2" },
        { role: "hint", id: "1", t: "1" },
        { role: "pick", id: "L7", t: "7", low: true },
      ],
    },
  },
  {
    id: "s1",
    lyrics: ["微", "风", "轻", "拂", "叶", "尖", "摇"],
    lyricTones: [1, 1, 1, 2, 4, 1, 2],
    palette: [
      { id: "1", t: "1" },
      { id: "2", t: "2" },
      { id: "3", t: "3" },
      { id: "4", t: "4" },
      { id: "5", t: "5" },
      { id: "6", t: "6" },
      { id: "7", t: "7" },
      { id: "L7", t: "7", low: true },
      { id: "L6", t: "6", low: true },
    ],
    pairLadders: {
      left: [
        { role: "pick", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
        { role: "hint", id: "L7", t: "7", low: true },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
      right: [
        { role: "pick", id: "4", t: "4" },
        { role: "hint", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
        { role: "hint", id: "L7", t: "7", low: true },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
    },
  },
  {
    id: "s3",
    lyrics: ["师", "生", "家", "长", "齐", "心", "协", "力"],
    lyricTones: [1, 1, 1, 3, 2, 1, 2, 4],
    palette: [
      { id: "1", t: "1" },
      { id: "2", t: "2" },
      { id: "3", t: "3" },
      { id: "4", t: "4" },
      { id: "5", t: "5" },
      { id: "6", t: "6" },
      { id: "7", t: "7" },
      { id: "L7", t: "7", low: true },
      { id: "L6", t: "6", low: true },
    ],
    pairLadders: {
      left: [
        { role: "pick", id: "5", t: "5" },
        { role: "hint", id: "4", t: "4" },
        { role: "pick", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
      ],
      right: [
        { role: "pick", id: "5", t: "5" },
        { role: "hint", id: "4", t: "4" },
        { role: "hint", id: "3", t: "3" },
        { role: "pick", id: "2", t: "2" },
        { role: "hint", id: "1", t: "1" },
        { role: "pick", id: "L7", t: "7", low: true },
      ],
    },
  },
  {
    id: "s4",
    lyrics: ["和", "睦", "故", "事", "慢", "慢", "跑"],
    lyricTones: [2, 4, 4, 5, 4, 4, 3],
    palette: [
      { id: "1", t: "1" },
      { id: "2", t: "2" },
      { id: "3", t: "3" },
      { id: "4", t: "4" },
      { id: "5", t: "5" },
      { id: "6", t: "6" },
      { id: "7", t: "7" },
      { id: "L7", t: "7", low: true },
      { id: "L6", t: "6", low: true },
    ],
    pairLadders: {
      left: [
        { role: "pick", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
        { role: "hint", id: "L7", t: "7", low: true },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
      right: [
        { role: "pick", id: "4", t: "4" },
        { role: "hint", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
        { role: "hint", id: "L7", t: "7", low: true },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
    },
  },
];
