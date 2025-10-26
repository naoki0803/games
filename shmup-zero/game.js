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
const pauseBtn = document.getElementById('pauseBtn');
const scoreEl = document.getElementById('scoreValue');
const highScoreEl = document.getElementById('highScoreValue');
const healthFillEl = document.getElementById('healthFill');
const finalStatsEl = document.getElementById('finalStats');
const fireBtn = document.getElementById('fireBtn');
// ステージ用モーダル
const stageModalEl = document.getElementById('stageModal');
const stageModalTitleEl = document.getElementById('stageModalTitle');
const stageModalBtn = document.getElementById('stageModalBtn');

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
  hp: 100,
  maxHp: 100,
  fireCooldown: 0,
  // 連射が多すぎたため、発射間隔をやや長めにする
  fireRate: 0.20, // seconds between shots
  alive: true,
  invul: 0,
};

// 自動射撃フラグ（true で常に自動射撃）
const AUTO_FIRE = true;

// Entities
const bullets = []; // {x,y,vx,vy,radius,from}
const enemies = []; // {x,y,radius,hp,vx,vy,type,fireCooldown}
const enemyBullets = []; // {x,y,vx,vy,radius}
const particles = []; // {x,y,vx,vy,life,color,size}

let input = {
  up: false, down: false, left: false, right: false, shoot: false,
  pointerId: null, dragging: false, dragOffsetX: 0, dragOffsetY: 0,
};

// Utilities
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function circleOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy <= (ar+br)*(ar+br);
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
// スコアに応じたステージ閾値（1-indexed: [S1開始, S2開始, S3開始]）
// ステージを5000ポイント毎に進行: S1=0, S2=5000, S3=10000
const STAGE_SCORE_THRESHOLDS = [0, 5000, 10000];
let currentStage = 1;
let pendingStage = 1;
let stageTransitionPending = false;

function getStageForScore(sc) {
  if (sc >= STAGE_SCORE_THRESHOLDS[2]) return 3;
  if (sc >= STAGE_SCORE_THRESHOLDS[1]) return 2;
  return 1;
}

function pickEnemyTypeForStage(stage) {
  if (stage === 1) return 'grunt';
  if (stage === 2) return (rand() < 0.65) ? 'grunt' : 'shooter';
  // stage 3: 全種類
  const t = rand();
  return t < 0.5 ? 'grunt' : (t < 0.8 ? 'shooter' : 'waver');
}

// Spawning
let enemySpawnTimer = 0;
function spawnEnemy() {
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  const y = 40 + rand() * (h - 80);
  // 敵タイプ: grunt(標準), shooter(射撃特化), waver(上下にランダム移動)
  const type = pickEnemyTypeForStage(currentStage);
  // 一回り小さく
  const radius = type === 'grunt' ? 12 : 14;
  const enemy = {
    x: w + 40,
    y,
    radius,
    hp: type === 'grunt' ? 1 : 3,
    // 敵の移動速度を20%低下
    vx: - (world.speed * (1.0 + world.difficulty*0.05)) * (0.9 + rand()*0.4) * 0.8,
    vy: (type === 'waver') ? (rand()-0.5) * 80 * 0.8 : (rand()-0.5) * 40 * 0.8,
    type,
    // 攻撃頻度を20%低下（クールダウンを1.2倍）
    fireCooldown: (0.6 + rand()*0.8) * 1.2,
  };
  // waver の上下ランダム変化タイマー
  if (type === 'waver') enemy.vyTimer = 0.5 + rand()*0.8;

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
    e.fireCooldown = (0.7 + rand()*0.7) * 1.2;
    return;
  }

  if (e.type === 'shooter') {
    // シューターは複数回撃つタイプを優先
    e.pattern = 'multi_times';
    e.shotsRemaining = 3 + Math.floor(rand()*3); // 3-5回
    e.fireCooldown = (0.5 + rand()*0.5) * 1.2;
    return;
  }
  const r = rand();
  if (r < 0.30) {
    e.pattern = 'single_once';
    e._attacked = false;
    e.fireCooldown = (0.6 + rand()*0.6) * 1.2;
  } else if (r < 0.60) {
    e.pattern = 'multi_times';
    e.shotsRemaining = 2 + Math.floor(rand()*3); // 2-4回
    e.fireCooldown = (0.6 + rand()*0.6) * 1.2;
  } else if (r < 0.85) {
    e.pattern = 'volley_once';
    e._attacked = false;
    e.bulletsPerVolley = 3 + Math.floor(rand()*2); // 3-4発
    e.fireCooldown = (0.6 + rand()*0.8) * 1.2;
  } else {
    e.pattern = 'radial_once';
    e._attacked = false;
    e.radialCount = 8; // 8方向
    e.fireCooldown = (0.7 + rand()*0.7) * 1.2;
  }
}

function shootTowards(x, y, tx, ty, speed, radius = 4) {
  const dx = tx - x; const dy = ty - y; const len = Math.hypot(dx, dy) || 1;
  const sp = speed;
  enemyBullets.push({ x, y, vx: dx/len*sp, vy: dy/len*sp, radius });
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
    e.fireCooldown = (0.5 + rand()*0.5) * 1.2; // 次弾までの間隔（頻度20%低下）
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
      enemyBullets.push({ x: e.x - 10, y: e.y, vx, vy, radius: 4 });
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
      enemyBullets.push({ x: e.x, y: e.y, vx, vy, radius: 4 });
    }
    e._attacked = true;
    e.fireCooldown = 9999;
  } else if (e.pattern === 'fixed_dir') {
    // ステージ1専用: 左方向（プレイヤー非追尾）にのみ射撃を繰り返す
    enemyBullets.push({ x: e.x - 10, y: e.y, vx: -baseSpeed, vy: 0, radius: 4 });
    e.fireCooldown = (0.6 + rand()*0.8) * 1.2;
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
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left);
  const py = (e.clientY - rect.top);
  input.pointerId = e.pointerId;
  input.dragging = true;
  // 記録: ポインタ位置とプレイヤー位置の差分
  input.dragOffsetX = player.x - px;
  input.dragOffsetY = player.y - py;
});
window.addEventListener('pointermove', (e) => {
  if (!input.dragging || e.pointerId !== input.pointerId) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left);
  const py = (e.clientY - rect.top);
  const targetX = px + (input.dragOffsetX || 0);
  const targetY = py + (input.dragOffsetY || 0);
  player.x = clamp(targetX, 20, rect.width - 20);
  player.y = clamp(targetY, 20, rect.height - 20);
});
window.addEventListener('pointerup', (e) => {
  if (e.pointerId !== input.pointerId) return;
  e.preventDefault();
  input.dragging = false; input.pointerId = null;
});

startBtn.addEventListener('click', () => startGame());
restartBtn.addEventListener('click', () => startGame());
pauseBtn.addEventListener('click', () => togglePause());
if (fireBtn) {
  const startShooting = (e) => { e.preventDefault(); input.shoot = true; };
  const stopShooting = (e) => { e.preventDefault(); input.shoot = false; };
  fireBtn.addEventListener('touchstart', startShooting, { passive: false });
  fireBtn.addEventListener('touchend', stopShooting, { passive: false });
  fireBtn.addEventListener('mousedown', startShooting);
  window.addEventListener('mouseup', stopShooting);
}

function togglePause() {
  if (gameState === State.Playing) {
    gameState = State.Paused; pauseBtn.textContent = '▶';
  } else if (gameState === State.Paused) {
    gameState = State.Playing; pauseBtn.textContent = '⏸';
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function resetGame() {
  score = 0;
  world.scrollX = 0; world.time = 0; world.difficulty = 1;
  player.x = 100; player.y = canvas.height / renderScale / 2; player.hp = player.maxHp; player.fireCooldown = 0; player.alive = true; player.invul = 1.2;
  bullets.length = 0; enemies.length = 0; enemyBullets.length = 0; particles.length = 0;
  enemySpawnTimer = 0;
  // ステージ状態を初期化
  currentStage = 1; pendingStage = 1; stageTransitionPending = false;
  if (stageModalEl) stageModalEl.classList.add('hidden');
  overlayEl.classList.add('hidden');
  restartBtn.classList.add('hidden');
  finalStatsEl.classList.add('hidden');
}

function startGame() {
  if (!isLandscape()) { updateOrientationNotice(); return; }
  resetGame();
  gameState = State.Playing;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// Drawing helpers
function drawShip(x, y, color, r = 16) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r*0.6, -r*0.6);
  ctx.lineTo(r, 0);
  ctx.lineTo(-r*0.6, r*0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(-r*0.2, -2, r*0.6, 4);
  ctx.restore();
}

function drawEnemy(x, y, type, r) {
  ctx.save(); ctx.translate(x, y);
  if (type === 'grunt') {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.fillRect(-r*0.5,-2,r,4);
  } else if (type === 'shooter') {
    ctx.fillStyle = '#ffb86b';
    ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r*0.4, 0); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill();
  } else { // waver
    ctx.fillStyle = '#ffa3d1';
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.fillRect(-r*0.6,-r*0.15,r*1.2,r*0.3);
  }
  ctx.restore();
}

function drawBullet(x,y,r,color) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.restore();
}

function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt; if (p.life <= 0) { particles.splice(i,1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
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
  const mvx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const mvy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (!input.dragging) {
    player.x += mvx * player.speed * dt;
    player.y += mvy * player.speed * dt;
  }
  const w = canvas.width / renderScale;
  const h = canvas.height / renderScale;
  player.x = clamp(player.x, 16, w - 16);
  player.y = clamp(player.y, 16, h - 16);

  // Shooting（自動発射対応）
  player.fireCooldown -= dt;
  if ((AUTO_FIRE || input.shoot) && player.fireCooldown <= 0) {
    player.fireCooldown = player.fireRate;
    // 一度に出る弾数を減らし、常に1発に統一
    bullets.push({ x: player.x + 14, y: player.y, vx: 520, vy: 0, radius: 4, from: 'player' });
  }

  // Enemies spawn（出現数増加）
  enemySpawnTimer -= dt;
  if (enemySpawnTimer <= 0) {
    spawnEnemy();
    // 追加で同時出現のチャンス
    if (rand() < 0.25) spawnEnemy();
    // ベース間隔を短縮（時間経過で最短 ~0.3s 程度）
    const base = 0.7 - Math.min(0.4, world.time * 0.02);
    // 出現頻度を20%低下させるため、待ち時間を1.25倍
    enemySpawnTimer = base * (0.9 + rand()*0.3) * 1.25;
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
    // 全ての敵が攻撃
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) tryEnemyAttack(e);
    if (e.x < -40 || e.y < -60 || e.y > h + 60) { enemies.splice(i, 1); continue; }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x > w + 20 || b.y < -20 || b.y > h + 20) { bullets.splice(i,1); continue; }
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -20 || b.x > w + 20 || b.y < -20 || b.y > h + 20) { enemyBullets.splice(i,1); continue; }
  }

  // Collisions - bullets vs enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j]; if (b.from !== 'player') continue;
      if (circleOverlap(e.x, e.y, e.radius, b.x, b.y, b.radius)) {
        bullets.splice(j,1);
        e.hp -= 1;
        addExplosion(b.x, b.y, '#9bffb0', 6);
        if (e.hp <= 0) {
          addExplosion(e.x, e.y, '#ffdf6b', 20);
          enemies.splice(i,1);
          score += 50 + Math.floor(world.difficulty * 10);
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
          player.hp -= 20; player.invul = 0.5; addExplosion(player.x, player.y, '#57c7ff', 10);
        }
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (circleOverlap(player.x, player.y, player.radius, e.x, e.y, e.radius)) {
        enemies.splice(i,1);
        if (player.invul <= 0) {
          player.hp -= 30; player.invul = 0.6; addExplosion(player.x, player.y, '#ff6b6b', 12);
        }
      }
    }
  }

  // Health UI and score
  healthFillEl.style.width = `${clamp(player.hp / player.maxHp, 0, 1) * 100}%`;
  scoreEl.textContent = score.toString();

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
    if (blink) drawShip(player.x, player.y, '#57c7ff', player.radius);
  }

  // Draw enemies
  for (const e of enemies) drawEnemy(e.x, e.y, e.type, e.radius);

  // Draw bullets
  for (const b of bullets) drawBullet(b.x, b.y, b.radius, '#9bffb0');
  for (const b of enemyBullets) drawBullet(b.x, b.y, b.radius, '#ff9b9b');

  // Draw particles
  drawParticles(dt);

  requestAnimationFrame(loop);
}

function endGame() {
  gameState = State.GameOver;
  overlayEl.classList.remove('hidden');
  restartBtn.classList.remove('hidden');
  finalStatsEl.classList.remove('hidden');
  finalStatsEl.textContent = `SCORE: ${score}`;
  if (score > highScore) { highScore = score; localStorage.setItem('shmupZeroHighScore', String(highScore)); }
  highScoreEl.textContent = highScore.toString();
}

// ステージクリア演出 & 再開
function showStageClearModal(clearedStage) {
  if (!stageModalEl || !stageModalTitleEl) return;
  stageModalTitleEl.textContent = `ステージ${clearedStage}クリア！`;
  stageModalEl.classList.remove('hidden');
  gameState = State.Paused;
  pauseBtn.textContent = '▶';
}

function checkStageProgression() {
  if (stageTransitionPending || gameState !== State.Playing) return;
  const s = getStageForScore(score);
  if (s > currentStage) {
    pendingStage = s;
    stageTransitionPending = true;
    showStageClearModal(currentStage);
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
