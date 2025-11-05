// Shmup Zero - from scratch side-scrolling shooter
// No external references; all logic is self-contained

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// 画面スケール（DPR）。描画と判定で必ずこの値を使う
let renderScale = 1;
const rotateOverlay = document.getElementById('rotateOverlay');

function isLandscape() {
  // iOS Safari では matchMedia が安定
  return window.matchMedia && window.matchMedia('(orientation: landscape)').matches
    || window.innerWidth > window.innerHeight;
}

function updateOrientationNotice() {
  const show = !isLandscape();
  if (rotateOverlay) rotateOverlay.style.display = show ? 'flex' : 'none';
}

// Layout / DPR
function resizeCanvas() {
  // 使用するDPRを決定（高すぎるとコストが重いので上限2）
  renderScale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.floor(width * renderScale);
  canvas.height = Math.floor(height * renderScale);
  // CSSピクセル単位で描けるようにキャンバスの座標系をスケール
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  updateOrientationNotice();
  // 画面サイズが変わったら背景の星分布も張り直す
  scatterStars();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 50); });

// UI elements
const overlayEl = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const resumeStageBtn = document.getElementById('resumeStageBtn');
const pauseBtn = document.getElementById('pauseBtn');
const scoreEl = document.getElementById('scoreValue');
const highScoreEl = document.getElementById('highScoreValue');
const healthFillEl = document.getElementById('healthFill');
const finalStatsEl = document.getElementById('finalStats');
const fireBtn = document.getElementById('fireBtn');
const pauseSettingsEl = document.getElementById('pauseSettings');
const settingsFormEl = document.getElementById('settingsForm');
const controlRelativeInput = document.getElementById('controlRelative');
const controlFollowInput = document.getElementById('controlFollow');
const itemAttackInput = document.getElementById('itemAttack');
const itemCompanionInput = document.getElementById('itemCompanion');
const itemBarrierInput = document.getElementById('itemBarrier');
const itemSpeedInput = document.getElementById('itemSpeed');
const settingsApplyBtn = document.getElementById('settingsApplyBtn');
const settingsResumeBtn = document.getElementById('settingsResumeBtn');
// ステージ用モーダル
const stageModalEl = document.getElementById('stageModal');
const stageModalTitleEl = document.getElementById('stageModalTitle');
const stageModalBtn = document.getElementById('stageModalBtn');
// ボス用HUD
const bossHudEl = document.getElementById('bossHud');
const bossLabelEl = document.getElementById('bossLabel');
const bossBarFillEl = document.getElementById('bossBarFill');

// Game state
const State = {
  Title: 'title',
  Playing: 'playing',
  Paused: 'paused',
  GameOver: 'gameover',
};

let gameState = State.Title;
let rngSeed = Date.now() % 2147483647;
function rand() {
  // simple LCG for deterministic effects per session
  rngSeed = (rngSeed * 48271) % 2147483647;
  return rngSeed / 2147483647;
}

// World
const world = {
  scrollX: 0,
  speed: 160, // pixels per second base
  time: 0,
  difficulty: 1,
};

// Player
const player = {
  x: 100,
  y: 0,
  radius: 16,
  speed: 420,
  speedBoostMultiplier: 1,
  speedBoostTimer: 0,
  hp: 100,
  maxHp: 100,
  fireCooldown: 0,
  // 連射が多すぎたため、発射間隔をさらに長めにする
  fireRate: 0.30, // seconds between shots
  alive: true,
  invul: 0,
  // シールド（被弾/接触無効化チャージ）
  shieldCharges: 0,
  maxShieldCharges: 5,
  // 武器強化レベル（パワーアイテムで増える）: 0=1本, 1=2本...
  shotPowerLevel: 0,
  // 子機アイテムの3個目以降で増える追加ショットレベル
  extraShotLevelsFromCompanion: 0,
};

// 自動射撃フラグ（true で常に自動射撃）
const AUTO_FIRE = false;

// Entities
const bullets = []; // {x,y,vx,vy,radius,from}
const enemies = []; // {x,y,radius,hp,vx,vy,type,fireCooldown}
const enemyBullets = []; // {x,y,vx,vy,radius}
const particles = []; // {x,y,vx,vy,life,color,size}
const healItems = []; // {x,y,vx,vy,radius}
const shieldItems = []; // {x,y,vx,vy,radius}
const companionItems = []; // {x,y,vx,vy,radius}
const companions = []; // {offsetY, fireCooldown}
const powerItems = []; // {x,y,vx,vy,radius}
const speedItems = []; // {x,y,vx,vy,radius}

// Boss state
let boss = null; // {x,y,radius,hp,maxHp,vx,vy,type,stage,fireCooldown,state,enterTargetX}
let bossActive = false;
const bossSpawnedForStage = { 1: false, 2: false, 3: false, 4: false, 5: false };
const BOSS_DAMAGE_PER_HIT = 20; // プレイヤー弾1ヒット=20（プレイヤー被弾と同等）
const BOSS_CONTACT_DAMAGE_TO_PLAYER = 30; // 接触時のプレイヤー被ダメ（既存と同等）

// Companions (子機)
const MAX_COMPANIONS = 2;
const COMPANION_OFFSET_Y = 18; // 上下に並ぶ距離
const COMPANION_FIRE_RATE = 0.65; // メインより遅い

let input = {
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  stickActive: false,
  stickPointerId: null,
  stickStartX: 0,
  stickStartY: 0,
  stickDisplayX: 0,
  stickDisplayY: 0,
  stickFingerX: 0,
  stickFingerY: 0,
  stickVectorX: 0,
  stickVectorY: 0,
  followActive: false,
  followPointerId: null,
  followTargetX: 0,
  followTargetY: 0,
};

const VIRTUAL_STICK_MAX_DISTANCE = 80;
const VIRTUAL_STICK_DEADZONE = 8;
const VIRTUAL_STICK_VISUAL_RADIUS = 60;

const ControlModes = {
  Relative: 'relative',
  FollowTouch: 'follow',
};
const SETTINGS_STORAGE_KEY = 'shmupZeroSettings';

function createDefaultSettings() {
  return {
    controlMode: ControlModes.Relative,
    items: {
      attack: false,
      companion: false,
      barrier: false,
      speed: false,
    },
  };
}

function loadUserSettings() {
  const defaults = createDefaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (parsed.controlMode === ControlModes.FollowTouch) {
        defaults.controlMode = ControlModes.FollowTouch;
      }
      if (parsed.items && typeof parsed.items === 'object') {
        for (const key of Object.keys(defaults.items)) {
          if (typeof parsed.items[key] === 'boolean') {
            defaults.items[key] = parsed.items[key];
          }
        }
      }
    }
  } catch (err) {
    // 読み込み失敗時はデフォルトを使用
  }
  return defaults;
}

function saveUserSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(userSettings));
  } catch (err) {
    // 保存できない場合は黙って失敗
  }
}

let userSettings = loadUserSettings();
let controlMode = userSettings.controlMode || ControlModes.Relative;

function setControlMode(mode) {
  controlMode = mode === ControlModes.FollowTouch ? ControlModes.FollowTouch : ControlModes.Relative;
  if (controlMode === ControlModes.Relative) {
    resetFollowMode();
  } else {
    resetVirtualStick();
  }
}

function setAttackState(enabled) {
  player.shotPowerLevel = enabled ? (MAX_SHOT_LINES - 1) : 0;
  if (!enabled) {
    player.extraShotLevelsFromCompanion = 0;
  }
}

function setCompanionState(enabled) {
  companions.length = 0;
  player.extraShotLevelsFromCompanion = 0;
  if (enabled) {
    const offsets = [-COMPANION_OFFSET_Y, COMPANION_OFFSET_Y];
    for (let i = 0; i < Math.min(MAX_COMPANIONS, offsets.length); i++) {
      companions.push({ offsetY: offsets[i], fireCooldown: 0 });
    }
  }
}

function setBarrierState(enabled) {
  player.shieldCharges = enabled ? player.maxShieldCharges : 0;
}

function setSpeedState(enabled) {
  if (enabled) {
    player.speedBoostMultiplier = 1.6;
    player.speedBoostTimer = Infinity;
  } else {
    player.speedBoostMultiplier = 1;
    player.speedBoostTimer = 0;
  }
}

function applyItemSettingsFromUser() {
  const items = userSettings.items || {};
  setCompanionState(!!items.companion);
  setAttackState(!!items.attack);
  setBarrierState(!!items.barrier);
  setSpeedState(!!items.speed);
}

setControlMode(controlMode);

// Utilities
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function circleOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy <= (ar+br)*(ar+br);
}

// 現在の総ショット本数（1〜2）
const MAX_SHOT_LINES = 2;
function getTotalShotLines() {
  return clamp(1 + (player.shotPowerLevel || 0) + (player.extraShotLevelsFromCompanion || 0), 1, MAX_SHOT_LINES);
}

// 平行弾を発射（上下に等間隔オフセット）
function fireParallelShots(ox, oy, vx, from, radius = 4, separation = 10) {
  const lines = getTotalShotLines();
  const mid = (lines - 1) / 2;
  for (let i = 0; i < lines; i++) {
    const offset = (i - mid) * separation;
    bullets.push({ x: ox, y: oy + offset, prevX: ox, prevY: oy + offset, vx, vy: 0, radius, from });
  }
}

// Background stars
const stars = new Array(120).fill(0).map(() => ({ x: 0, y: 0, z: 0 }));

function scatterStars() {
  const w = (canvas.width || window.innerWidth) / renderScale;
  const h = (canvas.height || window.innerHeight) / renderScale;
  for (let i = 0; i < stars.length; i++) {
    stars[i].x = rand() * w;
    stars[i].y = rand() * h;
    stars[i].z = 0.3 + rand() * 0.7;
  }
}
// 初期配置
scatterStars();

function drawStars(dt) {
  ctx.save();
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  for (const s of stars) {
    s.x -= (world.speed * 0.3 * s.z) * dt;
    if (s.x < -2) {
      s.x = w + rand()*100;
      s.y = rand()*h;
      s.z = 0.3 + rand()*0.7;
    }
    const alpha = 0.5 * s.z;
    ctx.fillStyle = `rgba(150,200,255,${alpha})`;
    ctx.fillRect(s.x, s.y, 2*s.z, 2*s.z);
  }
  ctx.restore();
}

// 初期化タイミング調整：星の配列初期化後にキャンバスサイズを確定
//（resizeCanvas 内で scatterStars を呼ぶため、ここで呼び出すのが安全）
resizeCanvas();

// Score / Stage
let score = 0;
let highScore = Number(localStorage.getItem('shmupZeroHighScore') || 0);
highScoreEl.textContent = highScore.toString();
// スコアに応じたステージ閾値（1-indexed: [S1開始, S2開始, S3開始, S4開始, S5開始]）
// 5000点刻みで進行: S1=0, S2=5000, S3=10000, S4=15000, S5=20000
const STAGE_SCORE_THRESHOLDS = [0, 5000, 10000, 15000, 20000];
let currentStage = 1;
let pendingStage = 1;
let stageTransitionPending = false;
let continueStage = 1;
let continueScore = 0;

function getStageForScore(sc) {
  if (sc >= STAGE_SCORE_THRESHOLDS[4]) return 5;
  if (sc >= STAGE_SCORE_THRESHOLDS[3]) return 4;
  if (sc >= STAGE_SCORE_THRESHOLDS[2]) return 3;
  if (sc >= STAGE_SCORE_THRESHOLDS[1]) return 2;
  return 1;
}

function pickEnemyTypeForStage(stage) {
  if (stage === 1) return 'grunt';
  if (stage === 2) return (rand() < 0.65) ? 'grunt' : 'shooter';
  if (stage === 3) {
    const t = rand();
    return t < 0.50 ? 'grunt' : (t < 0.80 ? 'shooter' : 'waver');
  }
  if (stage === 4) {
    const t = rand();
    // grunt, shooter, waver, charger, tank
    if (t < 0.35) return 'grunt';
    if (t < 0.60) return 'shooter';
    if (t < 0.78) return 'waver';
    if (t < 0.90) return 'charger';
    return 'tank';
  }
  // stage 5: 全種類 + 地雷/狙撃
  const t = rand();
  if (t < 0.28) return 'grunt';
  if (t < 0.50) return 'shooter';
  if (t < 0.66) return 'waver';
  if (t < 0.78) return 'charger';
  if (t < 0.90) return 'tank';
  return (rand() < 0.5) ? 'mine' : 'sniper';
}

// ステージごとの同時出現上限（種類が増えても総数が暴れないよう制限）
function getMaxEnemiesForStage(stage) {
  if (stage === 1) return 8;
  if (stage === 2) return 6;
  if (stage === 3) return 6;
  if (stage === 4) return 7;
  return 7; // stage 5
}

// ステージごとの出現間隔と同時出現確率の調整
function getSpawnTuningForStage(stage) {
  if (stage === 1) return { intervalMul: 1.5, extraChance: 0.25 };
  if (stage === 2) return { intervalMul: 2.1, extraChance: 0.12 };
  if (stage === 3) return { intervalMul: 2.4, extraChance: 0.08 };
  if (stage === 4) return { intervalMul: 2.6, extraChance: 0.09 };
  return { intervalMul: 2.8, extraChance: 0.10 }; // stage 5
}

// ステージごとの敵射撃クールダウン係数（値が小さいほど高頻度）
// S4でわずかに短縮、S5でさらに少し短縮
function getStageFireCooldownMul(stage) {
  if (stage >= 5) return 0.90; // 10% 速く
  if (stage >= 4) return 0.95; // 5% 速く
  return 1.0;
}

// Spawning
let enemySpawnTimer = 0;
function spawnEnemy() {
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  const y = 40 + rand() * (h - 80);
  // 敵タイプ: grunt(標準), shooter(射撃特化), waver(上下にランダム移動)
  const type = pickEnemyTypeForStage(currentStage);
  let radius = 14;
  let hp = 3;
  let vx = - (world.speed * (1.0 + world.difficulty*0.05)) * (0.9 + rand()*0.4) * 0.8;
  let vy = (rand()-0.5) * 40 * 0.8;
  if (type === 'grunt') { radius = 12; hp = 1; }
  if (type === 'waver') { vy = (rand()-0.5) * 80 * 0.8; }
  if (type === 'charger') { radius = 12; hp = 2; vx *= 1.2; vy = (rand()-0.5) * 30; }
  if (type === 'tank') { radius = 18; hp = 8; vx *= 0.6; vy = (rand()-0.5) * 25; }
  if (type === 'mine') { radius = 10; hp = 1; vx *= 0.5; vy = (rand()-0.5) * 20; }
  if (type === 'sniper') { radius = 12; hp = 3; vx *= 0.9; vy = (rand()-0.5) * 20; }
  const enemy = {
    x: w + 40,
    y,
    radius,
    hp,
    vx,
    vy,
    type,
    // 攻撃頻度を20%低下（クールダウンを1.2倍）しつつ、ステージ係数を適用
    fireCooldown: ( (0.6 + rand()*0.8) * 1.2 ) * getStageFireCooldownMul(currentStage),
  };
  // waver の上下ランダム変化タイマー
  if (type === 'waver') enemy.vyTimer = 0.5 + rand()*0.8;
  if (type === 'charger') { enemy.baseVx = vx; enemy.dashTimer = 0; enemy.dashCooldown = 0.8 + rand()*0.8; }

  // すべての敵に攻撃パターンを付与（何もしない敵を排除）
  assignAttackPattern(enemy);
  enemies.push(enemy);
}

// 敵の攻撃パターンを割り当て
// - single_once: 一回だけ単発
// - multi_times: 複数回に分けて単発
// - volley_once: 一回だけ複数発（狭い拡散）
// - radial_once: 一回だけ全方位
function assignAttackPattern(e) {
  // ステージ1では「1方向にのみ撃つ」シンプルな敵に限定
  if (currentStage === 1) {
    e.pattern = 'fixed_dir'; // 左方向へ固定射撃
    e.fireCooldown = ( (0.7 + rand()*0.7) * 1.4 ) * getStageFireCooldownMul(currentStage);
    return;
  }

  if (e.type === 'shooter') {
    // シューターは複数回撃つタイプを優先
    e.pattern = 'multi_times';
    e.shotsRemaining = 3 + Math.floor(rand()*3); // 3-5回
    e.fireCooldown = ( (0.5 + rand()*0.5) * 1.4 ) * getStageFireCooldownMul(currentStage);
    return;
  }
  if (e.type === 'tank') {
    e.pattern = 'volley_once';
    e._attacked = false;
    e.bulletsPerVolley = 5; // 重戦車は多弾
    e.fireCooldown = ( (0.8 + rand()*0.6) * 1.4 ) * getStageFireCooldownMul(currentStage);
    return;
  }
  if (e.type === 'sniper') {
    e.pattern = 'snipe_multi';
    e.shotsRemaining = 3 + Math.floor(rand()*2); // 3-4回
    e.fireCooldown = ( (0.9 + rand()*0.6) * 1.4 ) * getStageFireCooldownMul(currentStage);
    return;
  }
  if (e.type === 'mine') {
    e.pattern = 'none'; // 射撃しない（破壊/接触で危険）
    e.fireCooldown = 9999;
    return;
  }
  if (e.type === 'charger') {
    e.pattern = 'single_once'; // 突進が主、射撃は控えめ
    e._attacked = false;
    e.fireCooldown = ( (0.6 + rand()*0.6) * 1.4 ) * getStageFireCooldownMul(currentStage);
    return;
  }
  const r = rand();
  if (r < 0.30) {
    e.pattern = 'single_once';
    e._attacked = false;
    e.fireCooldown = ( (0.6 + rand()*0.6) * 1.4 ) * getStageFireCooldownMul(currentStage);
  } else if (r < 0.60) {
    e.pattern = 'multi_times';
    e.shotsRemaining = 2 + Math.floor(rand()*3); // 2-4回
    e.fireCooldown = ( (0.6 + rand()*0.6) * 1.4 ) * getStageFireCooldownMul(currentStage);
  } else if (r < 0.85) {
    e.pattern = 'volley_once';
    e._attacked = false;
    e.bulletsPerVolley = 3 + Math.floor(rand()*2); // 3-4発
    e.fireCooldown = ( (0.6 + rand()*0.8) * 1.4 ) * getStageFireCooldownMul(currentStage);
  } else {
    e.pattern = 'radial_once';
    e._attacked = false;
    e.radialCount = 8; // 8方向
    e.fireCooldown = ( (0.7 + rand()*0.7) * 1.4 ) * getStageFireCooldownMul(currentStage);
  }
}

function shootTowards(x, y, tx, ty, speed, radius = 4) {
  const dx = tx - x; const dy = ty - y; const len = Math.hypot(dx, dy) || 1;
  const sp = speed;
  enemyBullets.push({ x, y, prevX: x, prevY: y, vx: dx/len*sp, vy: dy/len*sp, radius });
}

function tryEnemyAttack(e) {
  const baseSpeed = 180 + rand()*80;
  if (e.pattern === 'single_once') {
    if (e._attacked) return; // 既に一回撃った
    shootTowards(e.x - 10, e.y, player.x, player.y, baseSpeed);
    e._attacked = true;
    e.fireCooldown = 9999; // もう撃たない
  } else if (e.pattern === 'multi_times') {
    if (!e.shotsRemaining || e.shotsRemaining <= 0) { e.fireCooldown = 9999; return; }
    shootTowards(e.x - 10, e.y, player.x, player.y, baseSpeed);
    e.shotsRemaining--;
    e.fireCooldown = ( (0.5 + rand()*0.5) * 1.5 ) * getStageFireCooldownMul(currentStage); // 次弾までの間隔をさらに延長
    if (e.shotsRemaining <= 0) e.fireCooldown = 9999;
  } else if (e.pattern === 'volley_once') {
    if (e._attacked) return;
    const n = Math.max(3, e.bulletsPerVolley || 3);
    const baseAngle = Math.atan2(player.y - e.y, player.x - e.x);
    const totalSpread = 20 * Math.PI / 180; // 20度の拡散
    for (let k = 0; k < n; k++) {
      const t = (n === 1) ? 0 : (k - (n-1)/2) / (n-1);
      const ang = baseAngle + t * totalSpread;
      const vx = Math.cos(ang) * baseSpeed;
      const vy = Math.sin(ang) * baseSpeed;
      enemyBullets.push({ x: e.x - 10, y: e.y, prevX: e.x - 10, prevY: e.y, vx, vy, radius: 4 });
    }
    e._attacked = true;
    e.fireCooldown = 9999;
  } else if (e.pattern === 'radial_once') {
    if (e._attacked) return;
    const n = e.radialCount || 8;
    for (let k = 0; k < n; k++) {
      const ang = (Math.PI * 2) * (k / n);
      const vx = Math.cos(ang) * (150 + rand()*70);
      const vy = Math.sin(ang) * (150 + rand()*70);
      enemyBullets.push({ x: e.x, y: e.y, prevX: e.x, prevY: e.y, vx, vy, radius: 4 });
    }
    e._attacked = true;
    e.fireCooldown = 9999;
  } else if (e.pattern === 'fixed_dir') {
    // ステージ1専用: 左方向（プレイヤー非追尾）にのみ射撃を繰り返す
    enemyBullets.push({ x: e.x - 10, y: e.y, prevX: e.x - 10, prevY: e.y, vx: -baseSpeed, vy: 0, radius: 4 });
    e.fireCooldown = ( (0.6 + rand()*0.8) * 1.5 ) * getStageFireCooldownMul(currentStage);
  } else if (e.pattern === 'snipe_multi') {
    if (!e.shotsRemaining || e.shotsRemaining <= 0) { e.fireCooldown = 9999; return; }
    // 高速・高精度狙撃
    const snipeSpeed = 260 + rand()*120;
    shootTowards(e.x - 12, e.y, player.x, player.y, snipeSpeed, 3.5);
    e.shotsRemaining--;
    e.fireCooldown = ( (0.8 + rand()*0.6) * 1.6 ) * getStageFireCooldownMul(currentStage);
    if (e.shotsRemaining <= 0) e.fireCooldown = 9999;
  } else if (e.pattern === 'none') {
    // 何もしない
  }
}

function addExplosion(x, y, color = '#57c7ff', count = 16) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const sp = 80 + rand()*160;
    particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 0.5 + rand()*0.5, color, size: 2 + rand()*3 });
  }
}

// Controls - keyboard
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = true;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'Space') input.shoot = true;
  if (e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = false;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'Space') input.shoot = false;
});

// Controls - pointer / touch drag (relative, no teleport)
function resetVirtualStick() {
  input.stickActive = false;
  input.stickPointerId = null;
  input.stickVectorX = 0;
  input.stickVectorY = 0;
}

function resetFollowMode() {
  input.followActive = false;
  input.followPointerId = null;
}

function movePlayerTowardsFollowTarget(dt, immediate = false) {
  if (!input.followActive) return;
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  const targetX = clamp(input.followTargetX, 16, w - 16);
  const targetY = clamp(input.followTargetY, 16, h - 16);
  if (immediate) {
    player.x = targetX;
    player.y = targetY;
    return;
  }
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) {
    player.x = targetX;
    player.y = targetY;
    return;
  }
  const followSpeed = player.speed * (player.speedBoostMultiplier || 1) * 1.2;
  const maxStep = followSpeed * dt;
  if (maxStep <= 0) return;
  if (maxStep >= dist) {
    player.x = targetX;
    player.y = targetY;
  } else {
    const inv = 1 / dist;
    player.x += dx * inv * maxStep;
    player.y += dy * inv * maxStep;
  }
}

function handleFollowPointerDown(e) {
  if (input.followActive && input.followPointerId !== e.pointerId) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  input.followActive = true;
  input.followPointerId = e.pointerId;
  input.followTargetX = px;
  input.followTargetY = py;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  movePlayerTowardsFollowTarget(0, true);
}

function handleFollowPointerMove(e) {
  if (!input.followActive || e.pointerId !== input.followPointerId) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  input.followTargetX = e.clientX - rect.left;
  input.followTargetY = e.clientY - rect.top;
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (controlMode === ControlModes.FollowTouch) {
    handleFollowPointerDown(e);
    return;
  }
  if (input.stickActive && input.stickPointerId !== e.pointerId) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  input.stickActive = true;
  input.stickPointerId = e.pointerId;
  input.stickStartX = px;
  input.stickStartY = py;
  input.stickDisplayX = px;
  input.stickDisplayY = py;
  input.stickFingerX = px;
  input.stickFingerY = py;
  input.stickVectorX = 0;
  input.stickVectorY = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
});

window.addEventListener('pointermove', (e) => {
  if (controlMode === ControlModes.FollowTouch) {
    handleFollowPointerMove(e);
    return;
  }
  if (!input.stickActive || e.pointerId !== input.stickPointerId) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  input.stickFingerX = px;
  input.stickFingerY = py;
  const dx = px - input.stickStartX;
  const dy = py - input.stickStartY;
  const distance = Math.hypot(dx, dy);
  const clampedDistance = Math.min(distance, VIRTUAL_STICK_MAX_DISTANCE);
  if (distance > 0) {
    const inv = 1 / distance;
    input.stickDisplayX = input.stickStartX + dx * inv * clampedDistance;
    input.stickDisplayY = input.stickStartY + dy * inv * clampedDistance;
  } else {
    input.stickDisplayX = input.stickStartX;
    input.stickDisplayY = input.stickStartY;
  }
  if (distance <= VIRTUAL_STICK_DEADZONE) {
    input.stickVectorX = 0;
    input.stickVectorY = 0;
  } else {
    const inv = 1 / distance;
    input.stickVectorX = dx * inv;
    input.stickVectorY = dy * inv;
  }
});

function handlePointerRelease(e) {
  if (controlMode === ControlModes.FollowTouch) {
    if (e.pointerId !== input.followPointerId) return;
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    resetFollowMode();
    return;
  }
  if (e.pointerId !== input.stickPointerId) return;
  e.preventDefault();
  try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
  resetVirtualStick();
}

window.addEventListener('pointerup', handlePointerRelease);
window.addEventListener('pointercancel', handlePointerRelease);
canvas.addEventListener('lostpointercapture', (e) => {
  if (controlMode === ControlModes.FollowTouch) {
    if (e.pointerId !== input.followPointerId) return;
    resetFollowMode();
  } else {
    if (e.pointerId !== input.stickPointerId) return;
    resetVirtualStick();
  }
});

function populateSettingsFormFromGame() {
  if (!settingsFormEl) return;
  const isRelative = controlMode === ControlModes.Relative;
  if (controlRelativeInput) controlRelativeInput.checked = isRelative;
  if (controlFollowInput) controlFollowInput.checked = !isRelative;
  if (itemAttackInput) itemAttackInput.checked = (player.shotPowerLevel || 0) > 0;
  if (itemCompanionInput) itemCompanionInput.checked = companions.length > 0;
  if (itemBarrierInput) itemBarrierInput.checked = (player.shieldCharges || 0) > 0;
  if (itemSpeedInput) itemSpeedInput.checked = (player.speedBoostMultiplier || 1) > 1;
}

function updateSettingsFromForm() {
  if (!settingsFormEl) return;
  const nextControl = (controlFollowInput && controlFollowInput.checked) ? ControlModes.FollowTouch : ControlModes.Relative;
  userSettings.controlMode = nextControl;
  if (!userSettings.items) userSettings.items = createDefaultSettings().items;
  if (itemAttackInput) userSettings.items.attack = !!itemAttackInput.checked;
  if (itemCompanionInput) userSettings.items.companion = !!itemCompanionInput.checked;
  if (itemBarrierInput) userSettings.items.barrier = !!itemBarrierInput.checked;
  if (itemSpeedInput) userSettings.items.speed = !!itemSpeedInput.checked;
  saveUserSettings();
  setControlMode(userSettings.controlMode);
  applyItemSettingsFromUser();
}

function showPauseSettings() {
  if (!pauseSettingsEl) return;
  populateSettingsFormFromGame();
  pauseSettingsEl.classList.remove('hidden');
  if (controlMode === ControlModes.Relative) {
    controlRelativeInput?.focus();
  } else {
    controlFollowInput?.focus();
  }
}

function hidePauseSettings() {
  if (!pauseSettingsEl) return;
  pauseSettingsEl.classList.add('hidden');
}

function resumeGameFromPause() {
  if (stageModalEl && !stageModalEl.classList.contains('hidden')) return;
  hidePauseSettings();
  if (gameState === State.Paused) {
    gameState = State.Playing;
    if (pauseBtn) pauseBtn.textContent = '⏸';
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

startBtn.addEventListener('click', () => startGame());
restartBtn.addEventListener('click', () => startGame());
if (resumeStageBtn) {
  resumeStageBtn.addEventListener('click', () => {
    startGame({ stage: continueStage, score: continueScore });
  });
}
pauseBtn.addEventListener('click', () => togglePause());
if (fireBtn) {
  const startShooting = (e) => {
    e.preventDefault();
    input.shoot = true;
    player.fireCooldown = 0;
  };
  const stopShooting = (e) => { e.preventDefault(); input.shoot = false; };
  fireBtn.addEventListener('touchstart', startShooting, { passive: false });
  fireBtn.addEventListener('touchend', stopShooting, { passive: false });
  fireBtn.addEventListener('touchcancel', stopShooting, { passive: false });
  fireBtn.addEventListener('mousedown', startShooting);
  window.addEventListener('mouseup', stopShooting);
}

if (settingsFormEl) {
  settingsFormEl.addEventListener('submit', (e) => e.preventDefault());
}
if (settingsApplyBtn) {
  settingsApplyBtn.addEventListener('click', () => {
    updateSettingsFromForm();
    resumeGameFromPause();
  });
}
if (settingsResumeBtn) {
  settingsResumeBtn.addEventListener('click', () => {
    resumeGameFromPause();
  });
}

function togglePause() {
  if (gameState === State.Playing) {
    if (stageModalEl && !stageModalEl.classList.contains('hidden')) return;
    gameState = State.Paused;
    if (pauseBtn) pauseBtn.textContent = '▶';
    showPauseSettings();
  } else if (gameState === State.Paused) {
    if (pauseSettingsEl && !pauseSettingsEl.classList.contains('hidden')) {
      updateSettingsFromForm();
    }
    resumeGameFromPause();
  }
}

function resetGame({ stage = 1, scoreOverride = null } = {}) {
  const stageIndex = Math.max(0, stage - 1);
  const defaultScore = STAGE_SCORE_THRESHOLDS[stageIndex] || 0;
  score = (typeof scoreOverride === 'number') ? scoreOverride : defaultScore;
  world.scrollX = 0;
  world.time = Math.max(0, stage - 1) * 20;
  world.difficulty = 1 + Math.floor(world.time / 20);
  player.x = 100;
  player.y = canvas.height / renderScale / 2;
  player.hp = player.maxHp;
  player.fireCooldown = 0;
  player.alive = true;
  player.invul = 1.2;
  player.shieldCharges = 0;
  player.shotPowerLevel = 0;
  player.extraShotLevelsFromCompanion = 0;
  player.speedBoostMultiplier = 1;
  player.speedBoostTimer = 0;
  bullets.length = 0;
  enemies.length = 0;
  enemyBullets.length = 0;
  particles.length = 0;
  healItems.length = 0;
  shieldItems.length = 0;
  companionItems.length = 0;
  powerItems.length = 0;
  speedItems.length = 0;
  companions.length = 0;
  enemySpawnTimer = 0;
  // ステージ状態を初期化
  currentStage = stage;
  pendingStage = stage;
  stageTransitionPending = false;
  if (stageModalEl) stageModalEl.classList.add('hidden');
  // ボス状態を初期化
  boss = null;
  bossActive = false;
    bossSpawnedForStage[1] = bossSpawnedForStage[2] = bossSpawnedForStage[3] = bossSpawnedForStage[4] = bossSpawnedForStage[5] = false;
    if (bossHudEl) bossHudEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    restartBtn.classList.add('hidden');
    if (resumeStageBtn) resumeStageBtn.classList.add('hidden');
    if (finalStatsEl) finalStatsEl.classList.add('hidden');
    hidePauseSettings();
    setControlMode(userSettings.controlMode);
    applyItemSettingsFromUser();
    input.shoot = AUTO_FIRE;
  healthFillEl.style.width = '100%';
  scoreEl.textContent = score.toString();
}

function startGame(options = {}) {
  if (!isLandscape()) { updateOrientationNotice(); return; }
  const { stage = 1, score: scoreOverride = null } = options;
  resetGame({ stage, scoreOverride });
  gameState = State.Playing;
  if (pauseBtn) pauseBtn.textContent = '⏸';
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// Drawing helpers
function drawShip(x, y, color, r = 16) {
  ctx.save();
  ctx.translate(x, y);
  // 本体: ネオングラデ + 外周グロー
  const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
  bodyGrad.addColorStop(0, '#0b1f33');
  bodyGrad.addColorStop(0.5, color);
  bodyGrad.addColorStop(1, '#0b1f33');
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  // 先端を鋭く、テールを絞るデルタ翼
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.6, -r * 0.72);
  ctx.lineTo(-r * 0.25, -r * 0.18);
  ctx.lineTo(-r * 0.7, 0);
  ctx.lineTo(-r * 0.25, r * 0.18);
  ctx.lineTo(-r * 0.6, r * 0.72);
  ctx.closePath();
  ctx.fill();
  // キャノピー
  ctx.shadowBlur = 8;
  const canopyGrad = ctx.createLinearGradient(-r * 0.15, -r * 0.25, r * 0.3, r * 0.25);
  canopyGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
  canopyGrad.addColorStop(1, 'rgba(120,200,255,0.15)');
  ctx.fillStyle = canopyGrad;
  ctx.beginPath();
  ctx.ellipse(r * 0.1, 0, r * 0.35, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // アウトライン
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.6, -r * 0.72);
  ctx.lineTo(-r * 0.25, -r * 0.18);
  ctx.lineTo(-r * 0.7, 0);
  ctx.lineTo(-r * 0.25, r * 0.18);
  ctx.lineTo(-r * 0.6, r * 0.72);
  ctx.closePath();
  ctx.stroke();
  // エンジン噴射のコア
  const flameLen = r * (0.9 + Math.sin(world.time * 40) * 0.07);
  const flameGrad = ctx.createLinearGradient(-r * 0.8, 0, -r * 0.8 - flameLen, 0);
  flameGrad.addColorStop(0, 'rgba(120,220,255,0.95)');
  flameGrad.addColorStop(1, 'rgba(0,150,255,0)');
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, 0);
  ctx.lineTo(-r * 0.8 - flameLen, -r * 0.18);
  ctx.lineTo(-r * 0.8 - flameLen, r * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(x, y, type, r) {
  ctx.save();
  ctx.translate(x, y);
  const drawNeonCircle = (radius, inner, outer, glow, line) => {
    const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    ctx.shadowColor = glow;
    ctx.shadowBlur = radius * 0.9;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    if (line) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  if (type === 'grunt') {
    drawNeonCircle(r, '#ff9aa8', '#831f2b', 'rgba(255,107,107,0.9)', 'rgba(255,255,255,0.25)');
    // コアライン
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-r * 0.5, -2, r, 4);
  } else if (type === 'shooter') {
    ctx.shadowColor = 'rgba(255,184,107,0.9)';
    ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#4a2b00');
    g.addColorStop(0.5, '#ffb86b');
    g.addColorStop(1, '#4a2b00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.9);
    ctx.lineTo(r * 0.6, 0);
    ctx.lineTo(-r, r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (type === 'waver') {
    drawNeonCircle(r, '#ffc3ea', '#5a2246', 'rgba(255,163,209,0.9)', null);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.3);
  } else if (type === 'charger') {
    ctx.shadowColor = 'rgba(255,213,74,0.9)'; ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#472f00'); g.addColorStop(0.5, '#ffd54a'); g.addColorStop(1, '#472f00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -r * 0.65);
    ctx.lineTo(r * 0.95, 0);
    ctx.lineTo(-r * 0.9, r * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'tank') {
    ctx.shadowColor = 'rgba(142,202,230,0.9)'; ctx.shadowBlur = 20;
    const body = ctx.createLinearGradient(-r, 0, r, 0);
    body.addColorStop(0, '#052b3a'); body.addColorStop(1, '#8ecae6');
    ctx.fillStyle = body;
    ctx.fillRect(-r, -r * 0.7, r * 2, r * 1.4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#023047';
    ctx.fillRect(-r * 0.6, -r * 0.25, r * 1.2, r * 0.5);
    // 装甲の縁取り
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-r, -r * 0.7, r * 2, r * 1.4);
  } else if (type === 'mine') {
    drawNeonCircle(r, '#c2c2c2', '#353535', 'rgba(220,220,220,0.8)', null);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2) * (i / 6);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
  } else if (type === 'sniper') {
    ctx.shadowColor = 'rgba(255,143,171,0.95)';
    ctx.shadowBlur = 20;
    const g = ctx.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, '#4a1020'); g.addColorStop(0.5, '#ff8fab'); g.addColorStop(1, '#4a1020');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r * 0.9, -r * 0.55);
    ctx.lineTo(r * 0.9, r * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ===== Boss helpers =====
function getBossMaxHpForStage(stage) {
  // 体力をさらに強化（従来比5倍）
  let base;
  if (stage === 1) base = 1600;
  else if (stage === 2) base = 2400;
  else if (stage === 3) base = 3200;
  else if (stage === 4) base = 4000;
  else base = 5200; // stage 5
  return base * 5;
}

function getBossTypeForStage(stage) {
  if (stage === 1) return 'grunt';
  if (stage === 2) return 'shooter';
  if (stage === 3) return 'waver';
  if (stage === 4) return 'tank';
  return 'sniper'; // stage 5
}

function getBossRadiusForStage(stage) {
  // ステージ毎にやや大型化
  return 42 + (stage - 1) * 6;
}

function getBossFireIntervalBase(stage) {
  // ステージが上がるほど発射間隔を短縮
  const base = 1.2 - (stage - 1) * 0.12;
  return Math.max(0.55, base);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) {
  const a = c1.match(/#(..)(..)(..)/).slice(1).map((x) => parseInt(x, 16));
  const b = c2.match(/#(..)(..)(..)/).slice(1).map((x) => parseInt(x, 16));
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bch = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bch})`;
}
function getBossBarColor(stage, ratio) {
  // ratio: 1.0 -> 0.0 で色遷移
  const yellow = '#ffd166';
  const green = '#06d6a0';
  const orange = '#ff8c42';
  const clampRatio = Math.max(0, Math.min(1, ratio));
  if (stage === 1) {
    // 黄→緑
    return lerpColor(yellow, green, 1 - clampRatio);
  }
  if (stage >= 2) {
    // オレンジ→黄色→緑（2区間補間）
    if (clampRatio > 0.5) {
      const t = (clampRatio - 0.5) / 0.5; // 1.0..0.5
      return lerpColor(yellow, orange, t); // 高HP側: オレンジに近く
    } else {
      const t = clampRatio / 0.5; // 0.5..0.0
      return lerpColor(green, yellow, t); // 低HP側: 緑寄りへ
    }
  }
  return lerpColor(yellow, green, 1 - clampRatio);
}

function updateBossHud() {
  if (!bossHudEl || !bossBarFillEl) return;
  if (!bossActive || !boss) {
    bossHudEl.classList.add('hidden');
    return;
  }
  const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  bossHudEl.classList.remove('hidden');
  bossBarFillEl.style.width = `${ratio * 100}%`;
  bossBarFillEl.style.background = getBossBarColor(boss.stage, ratio);
  if (bossLabelEl) bossLabelEl.textContent = `BOSS S${boss.stage}`;
}

function spawnBossForStage(stage) {
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  const type = getBossTypeForStage(stage);
  const radius = getBossRadiusForStage(stage);
  const maxHp = getBossMaxHpForStage(stage);
  const enterTargetX = w * 0.72;
  const leftLimit = radius + 50;
  const rightLimit = Math.max(leftLimit + 60, w - (radius + 30));
  const patrolMinCandidate = enterTargetX - Math.max(140, w * 0.35);
  const patrolMinX = clamp(patrolMinCandidate, leftLimit, rightLimit - 40);
  const patrolMaxCandidate = enterTargetX + Math.max(60, w * 0.2);
  const patrolMaxX = clamp(patrolMaxCandidate, patrolMinX + 40, rightLimit);
  boss = {
    x: w + 80,
    y: h * 0.5,
    radius,
    hp: maxHp,
    maxHp,
    vx: -Math.max(120, world.speed * 0.9),
    vy: 0,
    type,
    stage,
    fireCooldown: 1.5,
    state: 'enter',
    enterTargetX,
    verticalDir: (rand() < 0.5 ? -1 : 1),
    horizontalDir: -1,
    patrolMinX,
    patrolMaxX,
  };
  bossActive = true;
  bossSpawnedForStage[stage] = true;
  enemies.length = 0; // 通常敵を掃除
  enemyBullets.length = 0; // 弾も一旦掃除
  updateBossHud();
}

function bossAttack() {
  if (!boss) return;
  const baseSpeed = 200 + boss.stage * 40;
  const addBullet = (x, y, vx, vy, r = 5) => {
    enemyBullets.push({ x, y, prevX: x, prevY: y, vx, vy, radius: r });
  };
  const aimed = (n, spreadDeg) => {
    const baseAng = Math.atan2(player.y - boss.y, player.x - boss.x);
    const spread = (spreadDeg * Math.PI) / 180;
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0 : (k - (n - 1) / 2) / (n - 1);
      const ang = baseAng + t * spread;
      addBullet(boss.x - boss.radius * 0.8, boss.y, Math.cos(ang) * baseSpeed, Math.sin(ang) * baseSpeed, 4.5);
    }
  };
  const radial = (n, speed = baseSpeed * 0.9) => {
    for (let k = 0; k < n; k++) {
      const ang = (Math.PI * 2) * (k / n);
      addBullet(boss.x, boss.y, Math.cos(ang) * speed, Math.sin(ang) * speed, 4.5);
    }
  };

  // ステージ別にパターンを選択
  const r = rand();
  if (boss.stage === 1) {
    if (r < 0.6) aimed(3, 18); else radial(10, baseSpeed * 0.75);
  } else if (boss.stage === 2) {
    if (r < 0.45) aimed(5, 28); else if (r < 0.8) aimed(6, 14); else radial(12, baseSpeed * 0.85);
  } else if (boss.stage === 3) {
    if (r < 0.35) aimed(7, 32); else if (r < 0.7) radial(14); else { aimed(4, 10); radial(10, baseSpeed * 0.8); }
  } else if (boss.stage === 4) {
    if (r < 0.4) { aimed(7, 36); aimed(5, 20); }
    else if (r < 0.75) radial(18);
    else { aimed(6, 18); radial(12, baseSpeed * 0.9); }
  } else { // stage 5
    if (r < 0.35) { aimed(9, 38); aimed(7, 22); }
    else if (r < 0.7) radial(22, baseSpeed * 0.95);
    else { radial(12, baseSpeed * 0.8); aimed(8, 26); }
  }

  boss.fireCooldown = (0.7 + rand() * 0.5) * getBossFireIntervalBase(boss.stage);
}

function updateBoss(dt) {
  if (!bossActive || !boss) return;
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  if (boss.state === 'enter') {
    boss.x += boss.vx * dt;
    if (boss.x <= boss.enterTargetX) {
      boss.state = 'fight';
      boss.vx = 0;
      boss.horizontalDir = -1;
    }
  } else {
    // 戦闘中はゆっくり上下動
    const vyTarget = 60 * boss.verticalDir;
    boss.vy += (vyTarget - boss.vy) * 0.8 * dt;
    boss.y += boss.vy * dt;
    if ((boss.y < 40 && boss.verticalDir < 0) || (boss.y > h - 40 && boss.verticalDir > 0)) boss.verticalDir *= -1;
    let patrolMin = boss.patrolMinX ?? (boss.radius + 40);
    let patrolMax = boss.patrolMaxX ?? (w - (boss.radius + 40));
    if (patrolMax - patrolMin < 30) {
      const mid = (patrolMin + patrolMax) / 2;
      patrolMin = mid - 15;
      patrolMax = mid + 15;
    }
    const desiredSpeed = Math.max(90, world.speed * 0.35);
    const dir = boss.horizontalDir ?? -1;
    boss.vx += ((dir * desiredSpeed) - boss.vx) * 3 * dt;
    boss.x += boss.vx * dt;
    if (boss.x <= patrolMin && (boss.horizontalDir ?? -1) < 0) boss.horizontalDir = 1;
    else if (boss.x >= patrolMax && (boss.horizontalDir ?? 1) > 0) boss.horizontalDir = -1;
  }
  // 画面外には出ない
  boss.x = clamp(boss.x, 40, w - 20);
  boss.y = clamp(boss.y, 40, h - 40);

  // 攻撃
  boss.fireCooldown -= dt;
  if (boss.fireCooldown <= 0 && boss.state !== 'enter') bossAttack();

  updateBossHud();
}

function drawBullet(x,y,r,color) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.restore();
}

// 弾のリッチ描画（グロー + トレイル）
function drawBulletAdvanced(b, color) {
  ctx.save();
  // トレイル（前フレーム位置から現在位置へ）
  if (b.prevX !== undefined && b.prevY !== undefined) {
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1.5, b.radius * 1.2);
    ctx.beginPath();
    ctx.moveTo(b.prevX, b.prevY);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prevOp;
  }

  // 本体グロー
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
  // コア（白）
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(b.x, b.y, Math.max(1, b.radius * 0.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHealItem(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#42d392';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillRect(-r * 0.6, -2, r * 1.2, 4);
  ctx.fillRect(-2, -r * 0.6, 4, r * 1.2);
  ctx.restore();
}

function drawShieldItem(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#7cc7ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(124,199,255,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, r - 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCompanionItem(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#d1b3ff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.5, -1.5, r, 3); // 横バー
  ctx.fillRect(-1.5, -r * 0.5, 3, r); // 縦バー
  ctx.restore();
}

function drawPowerItem(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 中央に二本線アイコン
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.45, -r * 0.55, r * 0.22, r * 1.1);
  ctx.fillRect(r * 0.23, -r * 0.55, r * 0.22, r * 1.1);
  ctx.restore();
}

function drawSpeedItem(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(1, '#ffbe0b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff9500';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, 0);
  ctx.lineTo(r * 0.2, 0);
  ctx.lineTo(r * 0.05, -r * 0.35);
  ctx.moveTo(r * 0.2, 0);
  ctx.lineTo(r * 0.05, r * 0.35);
  ctx.stroke();
  ctx.restore();
}

function drawCompanion(x, y) {
  ctx.save();
  ctx.translate(x, y);
  // 弱い回転で躍動感
  ctx.rotate(Math.sin(world.time * 3 + y * 0.01) * 0.1);
  // 本体
  const r = 10;
  const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
  bodyGrad.addColorStop(0, '#2a144a');
  bodyGrad.addColorStop(1, '#b08cff');
  ctx.shadowColor = 'rgba(176,140,255,0.95)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.6, -r * 0.7);
  ctx.lineTo(-r * 0.6, r * 0.7);
  ctx.closePath();
  ctx.fill();
  // 外周リング
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-r * 0.15, 0, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawVirtualStickOverlay() {
  if (controlMode === ControlModes.FollowTouch || !input.stickActive) return;
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(input.stickStartX, input.stickStartY, VIRTUAL_STICK_VISUAL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(87,199,255,0.18)';
  ctx.beginPath();
  ctx.arc(input.stickStartX, input.stickStartY, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(87,199,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(input.stickStartX, input.stickStartY);
  ctx.lineTo(input.stickDisplayX, input.stickDisplayY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(87,199,255,0.35)';
  ctx.beginPath();
  ctx.arc(input.stickDisplayX, input.stickDisplayY, 18, 0, Math.PI * 2);
  ctx.fill();

  const fingerDx = input.stickFingerX - input.stickDisplayX;
  const fingerDy = input.stickFingerY - input.stickDisplayY;
  if (Math.hypot(fingerDx, fingerDy) > 2.5) {
    ctx.fillStyle = 'rgba(87,199,255,0.18)';
    ctx.beginPath();
    ctx.arc(input.stickFingerX, input.stickFingerY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(87,199,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(input.stickFingerX, input.stickFingerY, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(dt) {
  ctx.save();
  // 加算合成でネオングロー
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt; if (p.life <= 0) { particles.splice(i,1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
  ctx.restore();
}

// エンジン噴射粒子を放出
function emitThrusterFlame(x, y, baseColor) {
  const count = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2) * (0.48 + rand() * 0.04); // ほぼ左向き
    const sp = 120 + rand() * 120;
    particles.push({
      x: x + rand() * 2,
      y: y + (rand() - 0.5) * 6,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.25 + rand() * 0.25,
      color: 'rgba(120,220,255,0.6)',
      size: 1 + rand() * 2,
    });
  }
}

// Update & game loop
let lastTime = performance.now();
function loop(now) {
  if (gameState !== State.Playing) return;
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  world.time += dt; world.scrollX += world.speed * dt; world.difficulty = 1 + Math.floor(world.time / 20);

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    drawStars(dt);

    // Player input movement
    if (player.speedBoostTimer > 0) {
      player.speedBoostTimer -= dt;
      if (player.speedBoostTimer <= 0) {
        player.speedBoostTimer = 0;
        player.speedBoostMultiplier = 1;
      }
    }
    const moveSpeed = player.speed * (player.speedBoostMultiplier || 1);
    let mvx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let mvy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (controlMode === ControlModes.Relative && input.stickActive) {
      mvx += input.stickVectorX;
      mvy += input.stickVectorY;
    }
    const moveLen = Math.hypot(mvx, mvy);
    if (moveLen > 0.001) {
      const normX = mvx / moveLen;
      const normY = mvy / moveLen;
      const cappedLen = Math.min(moveLen, 1);
      player.x += normX * cappedLen * moveSpeed * dt;
      player.y += normY * cappedLen * moveSpeed * dt;
    }
    if (controlMode === ControlModes.FollowTouch && input.followActive) {
      movePlayerTowardsFollowTarget(dt, false);
    }
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  player.x = clamp(player.x, 16, w - 16);
  player.y = clamp(player.y, 16, h - 16);

  // Shooting（自動発射対応）
  player.fireCooldown -= dt;
  if ((AUTO_FIRE || input.shoot) && player.fireCooldown <= 0) {
    player.fireCooldown = player.fireRate;
    // 多重ショット（プレイヤー）
    fireParallelShots(player.x + 14, player.y, 520, 'player', 4);
  }

  // Companion follow + shooting
  for (const c of companions) {
    // 位置は常にプレイヤーのすぐ横（少し下）
    const cx = player.x - 4; // わずかに後ろ
    const cy = player.y + c.offsetY;
    c.x = cx; c.y = cy;
    c.fireCooldown = (c.fireCooldown || 0) - dt;
    if ((AUTO_FIRE || input.shoot) && c.fireCooldown <= 0) {
      c.fireCooldown = COMPANION_FIRE_RATE;
      // 多重ショット（子機も同本数）
      fireParallelShots(cx + 10, cy, 480, 'companion', 3.5, 9);
    }
  }

  // Enemies spawn（ステージ2/3で全体頻度を抑制しつつ同時数を制限）
  if (!bossActive) {
    enemySpawnTimer -= dt;
    if (enemySpawnTimer <= 0) {
      const tuning = getSpawnTuningForStage(currentStage);
      const base = 0.7 - Math.min(0.4, world.time * 0.02);
      const nextInterval = base * (0.9 + rand()*0.3) * tuning.intervalMul;
      const maxEnemies = getMaxEnemiesForStage(currentStage);
      if (enemies.length >= maxEnemies) {
        enemySpawnTimer = nextInterval;
      } else {
        spawnEnemy();
        if (enemies.length < maxEnemies && rand() < tuning.extraChance) {
          spawnEnemy();
        }
        enemySpawnTimer = nextInterval;
      }
    }
  }

  // Update enemies（移動 + 攻撃）
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x += e.vx * dt; e.y += e.vy * dt;
    // waver は上下速度を時々変更
    if (e.type === 'waver') {
      e.vyTimer -= dt;
      if (e.vyTimer <= 0) { e.vy = (rand()-0.5) * 140 * 0.8; e.vyTimer = 0.5 + rand()*0.8; }
      // 端で反転
      if ((e.y < 30 && e.vy < 0) || (e.y > h - 30 && e.vy > 0)) e.vy = -e.vy;
    }
    // charger は周期的にダッシュ
    if (e.type === 'charger') {
      e.dashTimer = (e.dashTimer || 0) - dt;
      e.dashCooldown = (e.dashCooldown || 0) - dt;
      if (e.dashCooldown <= 0 && e.dashTimer <= 0) {
        e.dashTimer = 0.35;
        e.dashCooldown = 1.2 + rand()*0.8;
        e.vx = -Math.abs(world.speed * (2.1 + rand()*0.6));
        e.vy = (rand()-0.5) * 40;
      }
      if (e.dashTimer <= 0 && e.baseVx !== undefined) {
        e.vx = e.baseVx;
      }
    }
    // 全ての敵が攻撃
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) tryEnemyAttack(e);
    if (e.x < -40 || e.y < -60 || e.y > h + 60) { enemies.splice(i, 1); continue; }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.prevX = b.x; b.prevY = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x > w + 20 || b.y < -20 || b.y > h + 20) { bullets.splice(i,1); continue; }
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i]; b.prevX = b.x; b.prevY = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -20 || b.x > w + 20 || b.y < -20 || b.y > h + 20) { enemyBullets.splice(i,1); continue; }
  }

  // 回復アイテムの更新・取得判定
  for (let i = healItems.length - 1; i >= 0; i--) {
    const it = healItems[i];
    it.x += it.vx * dt; it.y += it.vy * dt;
    it.vy += 30 * dt; // 緩やかな重力
    if (it.x < -20 || it.y < -20 || it.y > h + 20) { healItems.splice(i,1); continue; }
    if (player.alive && circleOverlap(player.x, player.y, player.radius, it.x, it.y, it.radius)) {
      const healAmount = Math.floor(player.maxHp * 0.2);
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      addExplosion(it.x, it.y, '#42d392', 14);
      healItems.splice(i,1);
      continue;
    }
  }

  // シールドアイテムの更新・取得判定
  for (let i = shieldItems.length - 1; i >= 0; i--) {
    const it = shieldItems[i];
    it.x += it.vx * dt; it.y += it.vy * dt;
    it.vy += 30 * dt; // 緩やかな重力
    if (it.x < -20 || it.y < -20 || it.y > h + 20) { shieldItems.splice(i,1); continue; }
    if (player.alive && circleOverlap(player.x, player.y, player.radius, it.x, it.y, it.radius)) {
      const addCharges = 3; // 一定回数の無効化（3回）
      player.shieldCharges = Math.min(player.maxShieldCharges, player.shieldCharges + addCharges);
      addExplosion(it.x, it.y, '#7cc7ff', 14);
      shieldItems.splice(i,1);
      continue;
    }
  }

  // 子機アイテムの更新・取得判定（出現頻度は他アイテムと同等）
  for (let i = companionItems.length - 1; i >= 0; i--) {
    const it = companionItems[i];
    it.x += it.vx * dt; it.y += it.vy * dt;
    it.vy += 30 * dt;
    if (it.x < -20 || it.y < -20 || it.y > h + 20) { companionItems.splice(i,1); continue; }
    if (player.alive && circleOverlap(player.x, player.y, player.radius, it.x, it.y, it.radius)) {
      if (companions.length < MAX_COMPANIONS) {
        const idx = companions.length; // 0 or 1
        const offsetY = idx === 0 ? -COMPANION_OFFSET_Y : COMPANION_OFFSET_Y;
        companions.push({ offsetY, fireCooldown: 0 });
      } else {
        // 3個目以降は攻撃本数を増加
        player.extraShotLevelsFromCompanion = clamp((player.extraShotLevelsFromCompanion || 0) + 1, 0, MAX_SHOT_LINES - 1);
      }
      addExplosion(it.x, it.y, '#d1b3ff', 12);
      companionItems.splice(i,1);
      continue;
    }
  }

  // パワーアイテムの更新・取得判定
  for (let i = powerItems.length - 1; i >= 0; i--) {
    const it = powerItems[i];
    it.x += it.vx * dt; it.y += it.vy * dt;
    it.vy += 30 * dt;
    if (it.x < -20 || it.y < -20 || it.y > h + 20) { powerItems.splice(i,1); continue; }
    if (player.alive && circleOverlap(player.x, player.y, player.radius, it.x, it.y, it.radius)) {
      // 攻撃本数を強化（最大2本）
      player.shotPowerLevel = clamp((player.shotPowerLevel || 0) + 1, 0, MAX_SHOT_LINES - 1);
      addExplosion(it.x, it.y, '#ffd166', 14);
      powerItems.splice(i,1);
      continue;
    }
  }

  // スピードアップアイテムの更新・取得判定
  for (let i = speedItems.length - 1; i >= 0; i--) {
    const it = speedItems[i];
    it.x += it.vx * dt; it.y += it.vy * dt;
    it.vy += 30 * dt;
    if (it.x < -20 || it.y < -20 || it.y > h + 20) { speedItems.splice(i,1); continue; }
    if (player.alive && circleOverlap(player.x, player.y, player.radius, it.x, it.y, it.radius)) {
      player.speedBoostMultiplier = 1.6;
      player.speedBoostTimer = 6;
      addExplosion(it.x, it.y, '#ffe066', 18);
      speedItems.splice(i,1);
      continue;
    }
  }

  // Collisions - bullets vs enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j]; if (b.from !== 'player' && b.from !== 'companion') continue;
      if (circleOverlap(e.x, e.y, e.radius, b.x, b.y, b.radius)) {
        bullets.splice(j,1);
        e.hp -= 1;
        addExplosion(b.x, b.y, '#9bffb0', 6);
    if (e.hp <= 0) {
          addExplosion(e.x, e.y, '#ffdf6b', 20);
          // 低確率でアイテムをドロップ（総量は抑えつつ種別を増やす）
          const dropRoll = rand();
          // 出現頻度は他アイテムと同等（累積確率を均等に近づける）
          if (dropRoll < 0.05) {
            healItems.push({ x: e.x, y: e.y, vx: -80, vy: (rand()-0.5)*40, radius: 8 });
          } else if (dropRoll < 0.08) {
            shieldItems.push({ x: e.x, y: e.y, vx: -80, vy: (rand()-0.5)*40, radius: 10 });
          } else if (dropRoll < 0.11) { // 子機アイテムの確率は他と同じ3%幅
            companionItems.push({ x: e.x, y: e.y, vx: -80, vy: (rand()-0.5)*40, radius: 9 });
          } else if (dropRoll < 0.14) {
            powerItems.push({ x: e.x, y: e.y, vx: -80, vy: (rand()-0.5)*40, radius: 9 });
          } else if (dropRoll < 0.17) {
            speedItems.push({ x: e.x, y: e.y, vx: -80, vy: (rand()-0.5)*40, radius: 9 });
          }
          enemies.splice(i,1);
          score += 50 + Math.floor(world.difficulty * 10);
          break;
        }
      }
    }
  }

  // Collisions - bullets vs boss
  if (bossActive && boss) {
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j]; if (b.from !== 'player' && b.from !== 'companion') continue;
      if (circleOverlap(boss.x, boss.y, boss.radius, b.x, b.y, b.radius)) {
        bullets.splice(j,1);
        boss.hp -= BOSS_DAMAGE_PER_HIT;
        addExplosion(b.x, b.y, '#9bffb0', 8);
        updateBossHud();
        if (boss.hp <= 0) {
          // Boss defeated
          addExplosion(boss.x, boss.y, '#ffd166', 40);
          addExplosion(boss.x, boss.y, '#ff9b9b', 30);
          bossActive = false;
          boss = null;
          updateBossHud();
          // ステージクリア演出（段階的に進行）
          pendingStage = Math.min(5, currentStage + 1);
          stageTransitionPending = true;
          showStageClearModal(currentStage);
          break;
        }
      }
    }
  }

  // Collisions - enemy bullets vs player, enemies vs player
  if (player.invul > 0) player.invul -= dt;
  if (player.alive) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (circleOverlap(player.x, player.y, player.radius, b.x, b.y, b.radius)) {
        enemyBullets.splice(i,1);
        if (player.invul <= 0) {
          if (player.shieldCharges > 0) {
            player.shieldCharges -= 1;
            player.invul = 0.2; // 多重ヒット防止の短い無敵
            addExplosion(player.x, player.y, '#7cc7ff', 12);
          } else {
            player.hp -= 20; player.invul = 0.5; addExplosion(player.x, player.y, '#57c7ff', 10);
          }
        }
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (circleOverlap(player.x, player.y, player.radius, e.x, e.y, e.radius)) {
        enemies.splice(i,1);
        if (player.invul <= 0) {
          if (player.shieldCharges > 0) {
            player.shieldCharges -= 1;
            player.invul = 0.25;
            addExplosion(player.x, player.y, '#7cc7ff', 14);
          } else {
            player.hp -= 30; player.invul = 0.6; addExplosion(player.x, player.y, '#ff6b6b', 12);
          }
        }
      }
    }
    // Boss vs player collision
    if (bossActive && boss && circleOverlap(player.x, player.y, player.radius, boss.x, boss.y, boss.radius)) {
      if (player.invul <= 0) {
        if (player.shieldCharges > 0) {
          player.shieldCharges -= 1;
          player.invul = 0.25;
          addExplosion(player.x, player.y, '#7cc7ff', 14);
        } else {
          player.hp -= BOSS_CONTACT_DAMAGE_TO_PLAYER; player.invul = 0.6; addExplosion(player.x, player.y, '#ff6b6b', 14);
        }
      }
    }
  }

  // Health UI and score
  healthFillEl.style.width = `${clamp(player.hp / player.maxHp, 0, 1) * 100}%`;
  scoreEl.textContent = score.toString();

  // Boss update (after all moves, so描画手前で)
  updateBoss(dt);

  // ステージ進行チェック（スコア到達で自動）
  checkStageProgression();

  // Game over
  if (player.hp <= 0 && player.alive) {
    player.alive = false;
    addExplosion(player.x, player.y, '#ff6b6b', 32);
    setTimeout(() => endGame(), 200);
  }

  // Draw player
  if (player.alive) {
    const blink = player.invul > 0 ? (Math.floor(world.time * 20) % 2 === 0) : true;
    // 噴射粒子（先に描いて奥行きを表現）
    emitThrusterFlame(player.x - player.radius * 0.8, player.y, '#57c7ff');
    if (blink) drawShip(player.x, player.y, '#57c7ff', player.radius);
    // シールド可視化
    if (player.shieldCharges > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(124,199,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const pulse = 2 * Math.sin(world.time * 6) + 4;
      ctx.arc(player.x, player.y, player.radius + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw boss
  if (bossActive && boss) {
    drawEnemy(boss.x, boss.y, boss.type, boss.radius);
  }

  // Draw enemies
  for (const e of enemies) drawEnemy(e.x, e.y, e.type, e.radius);

  // Draw bullets
  // 子機
  for (const c of companions) {
    if (player.alive) {
      emitThrusterFlame((c.x ?? (player.x - 4)) - 8, c.y ?? (player.y + c.offsetY), '#b08cff');
      drawCompanion(c.x ?? (player.x - 4), c.y ?? (player.y + c.offsetY));
    }
  }
  // 回復アイテム
  for (const it of healItems) drawHealItem(it.x, it.y, it.radius);
  // シールドアイテム
  for (const it of shieldItems) drawShieldItem(it.x, it.y, it.radius);
  // 子機アイテム
  for (const it of companionItems) drawCompanionItem(it.x, it.y, it.radius);
  // パワーアイテム
  for (const it of powerItems) drawPowerItem(it.x, it.y, it.radius);
  // スピードアップアイテム
  for (const it of speedItems) drawSpeedItem(it.x, it.y, it.radius);

  for (const b of bullets) {
    const color = b.from === 'companion' ? '#b08cff' : '#9bffb0';
    drawBulletAdvanced(b, color);
  }
  for (const b of enemyBullets) drawBulletAdvanced(b, '#ff9b9b');

  // Draw particles
  drawParticles(dt);

  // Draw virtual stick UI (touch)
  drawVirtualStickOverlay();

  requestAnimationFrame(loop);
}

function endGame() {
  gameState = State.GameOver;
  hidePauseSettings();
  overlayEl.classList.remove('hidden');
  restartBtn.classList.remove('hidden');
  continueStage = currentStage;
  const stageIndex = Math.max(0, continueStage - 1);
  continueScore = STAGE_SCORE_THRESHOLDS[stageIndex] || 0;
  if (resumeStageBtn) {
    resumeStageBtn.classList.remove('hidden');
    const labelStage = Math.max(1, continueStage);
    resumeStageBtn.textContent = `ステージ${labelStage}から再開`;
  }
  if (finalStatsEl) {
    finalStatsEl.classList.remove('hidden');
    finalStatsEl.textContent = `SCORE: ${score}`;
  }
  if (score > highScore) { highScore = score; localStorage.setItem('shmupZeroHighScore', String(highScore)); }
  highScoreEl.textContent = highScore.toString();
  // ボスHUDを隠す
  if (bossHudEl) bossHudEl.classList.add('hidden');
}

// ステージクリア演出 & 再開
function showStageClearModal(clearedStage) {
  if (!stageModalEl || !stageModalTitleEl) return;
  stageModalTitleEl.textContent = `ステージ${clearedStage}クリア！`;
  stageModalEl.classList.remove('hidden');
  hidePauseSettings();
  gameState = State.Paused;
  pauseBtn.textContent = '▶';
}

function checkStageProgression() {
  if (stageTransitionPending || gameState !== State.Playing) return;
  const stageEndScore = currentStage * 5000; // ステージ毎のクリア到達スコア
  if (score >= stageEndScore) {
    // まだボスを出していないなら出現
    if (!bossActive && !bossSpawnedForStage[currentStage]) {
      spawnBossForStage(currentStage);
    }
  }
}

if (stageModalBtn) {
  stageModalBtn.addEventListener('click', () => {
    if (!stageModalEl) return;
    stageModalEl.classList.add('hidden');
    currentStage = pendingStage;
    stageTransitionPending = false;
    if (gameState !== State.GameOver) {
      gameState = State.Playing; pauseBtn.textContent = '⏸';
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  });
}

// Initialize title screen
overlayEl.classList.remove('hidden');
