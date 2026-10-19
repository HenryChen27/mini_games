// ============================================================
// 合成大水母 — Game Configuration
// ============================================================

const CONFIG = {
  // Canvas / game world dimensions (matches background.png)
  GAME_WIDTH: 2559,
  GAME_HEIGHT: 1441,
  FONT_FAMILY: '"JellyfishPOP", "华康POP1体W5", "DFPOP1-W5", sans-serif',
  COUNTDOWN_FONT: '"JellyfishCountdown", "汉仪第五人格体", sans-serif',

  // Container (物理容器边界，水母活动区域)
  CONTAINER: {
    left: 811,
    right: 1773,
    top: 270,
    bottom: 1414,
  },

  // Clip (夹子左右移动范围)
  CLIP: {
    minX: 870,
    maxX: 1720,
    keyboardSpeed: 600, // world pixels per second
  },

  // Physics
  PHYSICS: {
    backend: 'planck',
    nativeGravity: 20,
    fixedDelta: 1000 / 120,
    maxSubSteps: 6,
    sleepThreshold: 120,
    circleSegments: 64,
    ellipseSegments: 48,
    gravity: { x: 0, y: 5.0 },
    wallThickness: 40,
    restitution: 0.08,
    friction: 0.2,
    frictionStatic: 0.8,
    frictionAir: 0.02,
    density: 0.0012,
  },

  // Animation
  ANIM: {
    // Normalised anatomy: bell [cx, cy, rx, ry], tentacles [left, root, right, tip].
    // Each swim cycle contracts the bell first; trailing strands respond later.
    breathing: [
      { period: 3000, mode: 'rosette', bell: [.50,.48,.25,.25], contraction: 0.1365, sway: 0 },
      { period: 2900, bell: [.50,.32,.23,.23], contraction: 0.0585, strands: [.28,.36,.72,.81], sway: 0.0338 },
      { period: 3000, bell: [.50,.40,.33,.28], contraction: 0.1885, strands: [.30,.59,.74,.83], sway: 0.0429 },
      { period: 3100, bell: [.51,.47,.32,.29], contraction: 0.1365, strands: [.33,.66,.74,.85], sway: 0.0312 },
      { period: 3000, mode: 'rosette', bell: [.50,.51,.34,.34], contraction: 0.18, sway: 0 },
      { period: 2950, bell: [.50,.37,.37,.25], contraction: 0.1495, strands: [.27,.49,.78,.83], sway: 0.0494 },
      { period: 3050, bell: [.50,.41,.41,.32], contraction: 0.169, strands: [.16,.66,.84,.89], sway: 0.0429 },
      { period: 3100, bell: [.50,.34,.40,.21], contraction: 0.1235, strands: [.24,.47,.79,.85], sway: 0.0338 },
      { period: 3000, bell: [.50,.35,.40,.29], contraction: 0.1495, strands: [.27,.57,.77,.86], sway: 0.0403 },
      { period: 3150, bell: [.51,.30,.41,.24], contraction: 0.182, strands: [.39,.46,.66,.85], sway: 0.0715 },
      { period: 3050, bell: [.48,.32,.34,.22], contraction: 0.1235, strands: [.30,.43,.83,.81], sway: 0.0611 },
    ],
    countdownStepDuration: 900,
    countdownGoDuration: 650,
    bubbleTransitionDuration: 1450,
    bubbleCount: 170,
    mergeDuration: 300,   // ms for each shrink/grow phase
    dropStartY: 185,      // Y offset from top where dropped jellyfish appears
    overflowTime: 3000,   // ms container must be overflowed before game over
  },

  // Drop level range (random pick from 1..DROP_MAX_LEVEL)
  DROP_MAX_LEVEL: 5,
  DEBUG: { randomSpawnEnabled: false }, // Enable explicitly when debugging.

  // 11 levels of jellyfish
  JELLYFISH: [
    { level: 1,  width: 55,  height: 55,  type: 'circle',  score: 0,  audio: null },
    { level: 2,  width: 65,  height: 98,  type: 'ellipse', score: 1,  audio: 'form1' },
    { level: 3,  width: 114, height: 114, type: 'circle',  score: 3,  audio: 'form2' },
    { level: 4,  width: 138, height: 138, type: 'circle',  score: 6,  audio: 'form3' },
    { level: 5,  width: 162, height: 162, type: 'circle',  score: 10, audio: 'form4' },
    { level: 6,  width: 196, height: 196, type: 'circle',  score: 15, audio: 'form5' },
    { level: 7,  width: 261, height: 206, type: 'ellipse', score: 21, audio: 'form6' },
    { level: 8,  width: 299, height: 299, type: 'circle',  score: 28, audio: 'form7' },
    { level: 9,  width: 361, height: 361, type: 'circle',  score: 36, audio: 'form8' },
    { level: 10, width: 460, height: 460, type: 'circle',  score: 45, audio: 'form9' },
    { level: 11, width: 451, height: 451, type: 'circle',  score: 55, audio: 'form10' },
  ],

  // Image asset paths
  IMAGES: {
    background: 'assets/background.png',
    backgroundStart: 'assets/background_start.png',
    bubble: 'assets/bubble.png',
    clip: 'assets/clip.png',
    warning: 'assets/background_warning.png',
    line: 'assets/line.png',
  },

  // Audio asset paths
  AUDIO: {
    backgroundVolume: 0.2275, // previous 0.35 reduced by 35%
    countdown: 'assets/audio/timing.MP3',
    goWhistle: 'assets/audio/whisper.MP3',
    click: 'assets/audio/click.MP3',
    background: 'assets/audio/background.MP3',
    start: 'assets/audio/start.MP3',
    ending: 'assets/audio/ending.MP3',
  },
};
