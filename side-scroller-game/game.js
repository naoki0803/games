// 横スクロール・シューティング（グラディウス風・最小プレイアブル）
let canvas, ctx;

// ワールド座標（右方向に進む）
const WORLD = { speed: 2.2, distance: 0 };

// プレイヤー
const player = {
  x: 120, y: 200, w: 36, h: 24,
  vx: 0, vy: 0, baseSpeed: 3.0,
  canShoot: true, fireDelayMs: 200,
  lives: 3, invincibleTimer: 0
};

// 入力
const input = { left: false, right: false, up: false, down: false, fire: false };

// 弾・敵・エフェクト
let bullets = []; // {x,y,vx,vy}
let enemies = []; // {x,y,w,h,vx,vy,hp}
let explosions = []; // {x,y,t}

// スコア・状態
let score = 0;
let gameState = 'ready'; // ready, playing, gameOver, win
let animationId = 0;

function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const isMobile = window.innerWidth <= 820;
  if (isMobile) {
    canvas.width = Math.min(window.innerWidth - 20, 800);
    canvas.height = Math.floor(canvas.width * 0.6);
  } else {
    canvas.width = 800;
    canvas.height = 480;
  }
}

function resetGame() {
  WORLD.distance = 0;
  enemies = [];
  bullets = [];
  explosions = [];
  score = 0;
  player.x = 120; player.y = canvas.height/2; player.lives = 3; player.invincibleTimer = 0;
  spawnInitialEnemies();
}

// 背景のパララックス用スター
const stars = Array.from({length: 80}, () => ({
  x: Math.random()*800, y: Math.random()*480, r: Math.random()*1.5+0.5, s: Math.random()*0.6+0.2
}));

function updateStars() {
  for (const st of stars) {
    st.x -= st.s * WORLD.speed * 0.8;
    if (st.x < 0) { st.x += canvas.width + 20; st.y = Math.random()*canvas.height; }
  }
}

function drawStars() {
  for (const st of stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
    ctx.fill();
  }
}

// プレイヤー制御
function updatePlayer() {
  const sp = player.baseSpeed;
  player.vx = (input.right? sp : 0) + (input.left? -sp : 0);
  player.vy = (input.down? sp : 0) + (input.up? -sp : 0);
  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.max(10, Math.min(canvas.width - player.w - 10, player.x));
  player.y = Math.max(10, Math.min(canvas.height - player.h - 10, player.y));
  if (player.invincibleTimer > 0) player.invincibleTimer--;
}

function drawPlayer() {
  // 無敵点滅
  const blink = player.invincibleTimer > 0 && Math.floor(player.invincibleTimer/5)%2===0;
  if (!blink) {
    ctx.fillStyle = '#00e0ff';
    ctx.beginPath();
    // 三角機体
    ctx.moveTo(player.x + player.w, player.y + player.h/2);
    ctx.lineTo(player.x, player.y);
    ctx.lineTo(player.x, player.y + player.h);
    ctx.closePath();
    ctx.fill();
    // コア
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + player.w*0.45, player.y + player.h*0.35, 4, 4);
  }
}

// 弾
function tryFire() {
  if (!player.canShoot) return;
  player.canShoot = false;
  bullets.push({ x: player.x + player.w - 2, y: player.y + player.h/2 - 2, vx: 6, vy: 0 });
  setTimeout(()=> player.canShoot = true, player.fireDelayMs);
}

function updateBullets() {
  bullets = bullets.filter(b => {
    b.x += b.vx; b.y += b.vy;
    return b.x < canvas.width + 20 && b.y>-20 && b.y<canvas.height+20;
  });
}

function drawBullets() {
  ctx.fillStyle = '#ffcf00';
  for (const b of bullets) ctx.fillRect(b.x, b.y, 6, 3);
}

// 敵
function spawnInitialEnemies() {
  // 前半はザコ、一定距離で中型出現
  for (let i=0;i<12;i++) {
    enemies.push({ x: 500 + i*160, y: 80 + (i%5)*50, w: 26, h: 20, vx: -1.4, vy: Math.sin(i)*0.6, hp: 1 });
  }
}

function maybeSpawnProgressEnemies() {
  if (WORLD.distance > 1200 && !enemies.some(e=>e.hp>1)) {
    // 中型編隊
    for (let i=0;i<6;i++) {
      enemies.push({ x: canvas.width + 80 + i*80, y: 120 + Math.sin(i)*30, w: 38, h: 28, vx: -1.6, vy: 0.2, hp: 3 });
    }
  }
  if (WORLD.distance > 2600 && !enemies.some(e=>e.boss)) {
    // 簡易ボス
    enemies.push({ x: canvas.width + 120, y: canvas.height/2 - 40, w: 120, h: 80, vx: -0.8, vy: 0, hp: 40, boss: true });
  }
}

function updateEnemies() {
  for (const e of enemies) {
    e.x += e.vx * (1 + WORLD.speed*0.1);
    e.y += e.vy;
    // 簡易波動
    if (!e.boss) e.y += Math.sin((e.x+e.y)*0.02)*0.4;
  }
  enemies = enemies.filter(e => e.x + e.w > -40 && e.hp > 0);
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.boss) {
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      // コア
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x + e.w/2 - 6, e.y + e.h/2 - 6, 12, 12);
    } else if (e.hp>1) {
      ctx.fillStyle = '#ffa640';
      ctx.fillRect(e.x, e.y, e.w, e.h);
    } else {
      ctx.fillStyle = '#ff5fe0';
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  }
}

// 衝突
function aabb(ax,ay,aw,ah,bx,by,bw,bh) {
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}

function handleCollisions() {
  // 弾と敵
  for (let i=bullets.length-1;i>=0;i--) {
    const b = bullets[i];
    let hitIndex = -1;
    for (let j=0;j<enemies.length;j++) {
      const e = enemies[j];
      if (aabb(b.x,b.y,6,3,e.x,e.y,e.w,e.h)) { hitIndex = j; break; }
    }
    if (hitIndex>=0) {
      const e = enemies[hitIndex];
      e.hp -= 1;
      explosions.push({ x: b.x, y: b.y, t: 0 });
      bullets.splice(i,1);
      if (e.hp<=0) {
        score += e.boss? 1000 : (e.w>30? 100 : 50);
        explosions.push({ x: e.x+e.w/2, y: e.y+e.h/2, t: 0 });
      }
    }
  }

  // 敵とプレイヤー
  if (player.invincibleTimer===0) {
    for (const e of enemies) {
      if (aabb(player.x,player.y,player.w,player.h,e.x,e.y,e.w,e.h)) {
        playerHit();
        break;
      }
    }
  }
}

function playerHit() {
  player.lives -= 1;
  player.invincibleTimer = 120;
  explosions.push({ x: player.x + player.w/2, y: player.y + player.h/2, t: 0 });
  if (player.lives <= 0) gameOver();
  updateHUD();
}

// エフェクト
function updateExplosions() {
  for (const ex of explosions) ex.t += 1;
  explosions = explosions.filter(ex => ex.t < 40);
}

function drawExplosions() {
  for (const ex of explosions) {
    const a = Math.max(0, 1 - ex.t/40);
    const r = 4 + ex.t*0.9;
    ctx.strokeStyle = `rgba(255,200,80,${a})`;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, r, 0, Math.PI*2);
    ctx.stroke();
  }
}

// HUD
function updateHUD() {
  document.getElementById('score').textContent = String(score);
  document.getElementById('lives').textContent = String(player.lives);
}

function gameOver() {
  gameState = 'gameOver';
  document.getElementById('finalScore').textContent = String(score);
  document.getElementById('gameOver').classList.remove('hidden');
  updateButtons();
}

function maybeWin() {
  if (enemies.length===0 && WORLD.distance>3200) {
    gameState = 'win';
    document.getElementById('winScore').textContent = String(score);
    document.getElementById('gameWin').classList.remove('hidden');
    updateButtons();
  }
}

// ループ
let frame = 0;
function loop() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  frame++;
  WORLD.distance += WORLD.speed;
  updateStars();
  if (gameState==='playing') {
    updatePlayer();
    if (input.fire && frame%4===0) tryFire();
    updateBullets();
    updateEnemies();
    handleCollisions();
    updateExplosions();
    maybeSpawnProgressEnemies();
    maybeWin();
  } else {
    updateExplosions();
  }

  drawStars();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawExplosions();

  // ガイド
  if (gameState==='ready') {
    ctx.fillStyle = '#0ef';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Enter でスタート', canvas.width/2, canvas.height/2);
  }

  animationId = requestAnimationFrame(loop);
}

// 入力
function bindInputs() {
  document.addEventListener('keydown', (e)=>{
    if (e.key==='ArrowLeft' || e.key==='a') input.left = true;
    if (e.key==='ArrowRight' || e.key==='d') input.right = true;
    if (e.key==='ArrowUp' || e.key==='w') input.up = true;
    if (e.key==='ArrowDown' || e.key==='s') input.down = true;
    if (e.key===' ' || e.key==='j') input.fire = true;
    if (e.key==='Enter') onPressEnter();
  });
  document.addEventListener('keyup', (e)=>{
    if (e.key==='ArrowLeft' || e.key==='a') input.left = false;
    if (e.key==='ArrowRight' || e.key==='d') input.right = false;
    if (e.key==='ArrowUp' || e.key==='w') input.up = false;
    if (e.key==='ArrowDown' || e.key==='s') input.down = false;
    if (e.key===' ' || e.key==='j') input.fire = false;
  });

  // モバイルボタン
  const id = s=>document.getElementById(s);
  const bindBtn = (el, set, unset) => {
    el.addEventListener('touchstart', (e)=>{ e.preventDefault(); set(); }, {passive:false});
    el.addEventListener('touchend',   (e)=>{ e.preventDefault(); unset(); }, {passive:false});
  };
  bindBtn(id('leftBtn'), ()=>input.left=true, ()=>input.left=false);
  bindBtn(id('rightBtn'), ()=>input.right=true, ()=>input.right=false);
  bindBtn(id('upBtn'), ()=>input.up=true, ()=>input.up=false);
  bindBtn(id('downBtn'), ()=>input.down=true, ()=>input.down=false);
  bindBtn(id('fireBtn'), ()=>input.fire=true, ()=>input.fire=false);

  id('startBtn').addEventListener('click', ()=> onPressEnter());
}

function updateButtons() {
  const fireBtn = document.getElementById('fireBtn');
  const startBtn = document.getElementById('startBtn');
  if (gameState==='playing') {
    fireBtn.style.display = 'block';
    startBtn.style.display = 'none';
  } else if (gameState==='ready') {
    fireBtn.style.display = 'block';
    startBtn.style.display = 'none';
  } else {
    fireBtn.style.display = 'none';
    startBtn.style.display = 'block';
  }
}

function onPressEnter() {
  if (gameState==='ready') {
    gameState='playing'; updateButtons();
  } else if (gameState==='gameOver') {
    document.getElementById('gameOver').classList.add('hidden');
    resetGame(); gameState='playing'; updateButtons();
  } else if (gameState==='win') {
    document.getElementById('gameWin').classList.add('hidden');
    resetGame(); gameState='playing'; updateButtons();
  }
}

function start() {
  initCanvas();
  resetGame();
  bindInputs();
  updateHUD();
  loop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
