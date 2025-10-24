// ゲーム設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// キャンバスサイズをデバイスに合わせて設定
function setCanvasSize() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        // モバイル: 縦画面に最適化
        canvas.width = Math.min(window.innerWidth - 20, 400);
        canvas.height = Math.min(window.innerHeight - 250, 600);
    } else {
        // PC: 従来のサイズ
        canvas.width = 800;
        canvas.height = 600;
    }
}

setCanvasSize();
window.addEventListener('resize', setCanvasSize);

// デバイス検出
const isMobile = () => window.innerWidth <= 768;

// ゲーム状態
let gameState = 'ready'; // ready, playing, gameOver, win
let score = 0;
let lives = 3;
let level = 1;
let lastFireTime = 0;
const fireDelay = 300; // 連射制限（ミリ秒）

// プレイヤー
const player = {
    x: 0,
    y: 0,
    width: 40,
    height: 24,
    speed: 5,
    moveLeft: false,
    moveRight: false
};

// 弾丸
let bullets = [];
const bulletSpeed = 7;
const bulletWidth = 3;
const bulletHeight = 12;

// 敵
let invaders = [];
let invaderRows = 6;
let invaderCols = 12;
const invaderWidth = 28;
const invaderHeight = 21;
let invaderSpeed = 0.7;
let invaderDirection = 1;
let invaderDropDistance = 15;

// 敵の弾丸
let enemyBullets = [];
const enemyBulletSpeed = 3;

// パーティクル（爆発エフェクト）
let particles = [];

// 星空背景
let stars = [];

// アニメーション用フレームカウンター
let animationFrame = 0;

// 星空を作成
function createStars() {
    stars = [];
    const starCount = isMobile() ? 50 : 100;
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.5 + 0.5,
            twinkleSpeed: Math.random() * 0.02 + 0.01
        });
    }
}

// パーティクルを作成（爆発エフェクト）
function createExplosion(x, y, color) {
    const particleCount = isMobile() ? 8 : 15;
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = Math.random() * 3 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: color,
            size: Math.random() * 3 + 2
        });
    }
}

// 初期化
function init() {
    gameState = 'ready';
    score = 0;
    lives = 3;
    bullets = [];
    enemyBullets = [];
    particles = [];
    
    // プレイヤーの位置を初期化
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 60;
    
    // モバイルでは敵の数を減らす
    if (isMobile()) {
        invaderRows = 5;
        invaderCols = 8;
        player.speed = 6; // 移動を少し速く
    } else {
        invaderRows = 6;
        invaderCols = 12;
        player.speed = 5;
    }
    
    invaderSpeed = 0.7 + (level - 1) * 0.2;
    createInvaders();
    createStars();
    updateDisplay();
}

// インベーダーを作成
function createInvaders() {
    invaders = [];
    
    // キャンバスサイズに応じて調整
    const scale = isMobile() ? 0.8 : 1;
    const startX = isMobile() ? 20 : 50;
    const startY = isMobile() ? 30 : 50;
    const spacingX = isMobile() ? Math.floor((canvas.width - 40) / invaderCols) : 60;
    const spacingY = isMobile() ? 40 : 50;
    
    for (let row = 0; row < invaderRows; row++) {
        for (let col = 0; col < invaderCols; col++) {
            invaders.push({
                x: startX + col * spacingX,
                y: startY + row * spacingY,
                width: invaderWidth * scale,
                height: invaderHeight * scale,
                alive: true,
                type: row // 種類を行番号で決定
            });
        }
    }
}

// プレイヤーを描画
function drawPlayer() {
    // 影
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ff00';
    
    // グラデーション
    const gradient = ctx.createLinearGradient(
        player.x + player.width / 2, player.y,
        player.x + player.width / 2, player.y + player.height
    );
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(0.5, '#00dd00');
    gradient.addColorStop(1, '#00aa00');
    
    ctx.fillStyle = gradient;
    // 宇宙船の形
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // エンジン炎のアニメーション
    if (gameState === 'playing' && Math.floor(animationFrame / 5) % 2 === 0) {
        const flameGradient = ctx.createLinearGradient(
            player.x + player.width / 2, player.y + player.height,
            player.x + player.width / 2, player.y + player.height + 8
        );
        flameGradient.addColorStop(0, 'rgba(255, 200, 0, 0.9)');
        flameGradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.7)');
        flameGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.fillStyle = flameGradient;
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2 - 5, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + 8);
        ctx.lineTo(player.x + player.width / 2 + 5, player.y + player.height);
        ctx.closePath();
        ctx.fill();
    }
    
    // コックピット
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(player.x + player.width / 2 - 4, player.y + 8, 8, 8);
    
    // 影をリセット
    ctx.shadowBlur = 0;
}

// インベーダーを描画
function drawInvaders() {
    invaders.forEach(invader => {
        if (invader.alive) {
            // 種類によって色を変える
            const colors = [
                { start: '#ff00ff', end: '#cc00cc' },
                { start: '#ff0000', end: '#cc0000' },
                { start: '#ff8800', end: '#cc6600' },
                { start: '#ffff00', end: '#cccc00' },
                { start: '#ffffff', end: '#cccccc' }
            ];
            const colorSet = colors[invader.type];
            
            // 影とグロー
            ctx.shadowBlur = 10;
            ctx.shadowColor = colorSet.start;
            
            // グラデーション
            const gradient = ctx.createLinearGradient(
                invader.x, invader.y,
                invader.x, invader.y + invader.height
            );
            gradient.addColorStop(0, colorSet.start);
            gradient.addColorStop(1, colorSet.end);
            ctx.fillStyle = gradient;
            
            // アニメーションでわずかに動く
            const wobble = Math.sin(animationFrame * 0.1 + invader.x) * 1;
            
            // インベーダーの体
            ctx.fillRect(invader.x + 4, invader.y + wobble, invader.width - 8, invader.height - 4);
            ctx.fillRect(invader.x, invader.y + 8 + wobble, invader.width, invader.height - 12);
            
            // 触角
            ctx.fillRect(invader.x + 2, invader.y - 2 + wobble, 3, 4);
            ctx.fillRect(invader.x + invader.width - 5, invader.y - 2 + wobble, 3, 4);
            
            // 目（光る）
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = Math.floor(animationFrame / 10) % 2 === 0 ? '#ffff00' : '#ff0000';
            ctx.fillRect(invader.x + 7, invader.y + 4 + wobble, 4, 4);
            ctx.fillRect(invader.x + invader.width - 11, invader.y + 4 + wobble, 4, 4);
            
            ctx.shadowBlur = 0;
        }
    });
}

// 星空を描画
function drawStars() {
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 星のきらめき
        star.alpha += star.twinkleSpeed;
        if (star.alpha > 1 || star.alpha < 0.3) {
            star.twinkleSpeed *= -1;
        }
    });
}

// パーティクルを描画
function drawParticles() {
    particles.forEach(particle => {
        ctx.fillStyle = `rgba(${particle.color}, ${particle.life})`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = `rgba(${particle.color}, ${particle.life})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;
}

// 弾丸を描画
function drawBullets() {
    // プレイヤーの弾丸（グロー効果付き）
    bullets.forEach(bullet => {
        const gradient = ctx.createLinearGradient(
            bullet.x, bullet.y,
            bullet.x, bullet.y + bulletHeight
        );
        gradient.addColorStop(0, '#00ff00');
        gradient.addColorStop(0.5, '#00ff88');
        gradient.addColorStop(1, '#00ffff');
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
        ctx.fillStyle = gradient;
        ctx.fillRect(bullet.x, bullet.y, bulletWidth, bulletHeight);
    });
    
    // 敵の弾丸（グロー効果付き）
    enemyBullets.forEach(bullet => {
        const gradient = ctx.createLinearGradient(
            bullet.x, bullet.y,
            bullet.x, bullet.y + bulletHeight
        );
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.5, '#ff8800');
        gradient.addColorStop(1, '#ffff00');
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = gradient;
        ctx.fillRect(bullet.x, bullet.y, bulletWidth, bulletHeight);
    });
    
    ctx.shadowBlur = 0;
}

// プレイヤーを更新
function updatePlayer() {
    if (player.moveLeft && player.x > 0) {
        player.x -= player.speed;
    }
    if (player.moveRight && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
}

// パーティクルを更新
function updateParticles() {
    particles = particles.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.02;
        return particle.life > 0;
    });
}

// 弾丸を更新
function updateBullets() {
    // プレイヤーの弾丸
    bullets = bullets.filter(bullet => {
        bullet.y -= bulletSpeed;
        return bullet.y > 0;
    });
    
    // 敵の弾丸
    enemyBullets = enemyBullets.filter(bullet => {
        bullet.y += enemyBulletSpeed;
        return bullet.y < canvas.height;
    });
}

// インベーダーを更新
function updateInvaders() {
    let hitEdge = false;
    
    invaders.forEach(invader => {
            if (invader.alive) {
                invader.x += invaderSpeed * invaderDirection;
                
                if (invader.x <= 0 || invader.x >= canvas.width - invader.width) {
                    hitEdge = true;
                }
            }
    });
    
    if (hitEdge) {
        invaderDirection *= -1;
        invaders.forEach(invader => {
            if (invader.alive) {
                invader.y += invaderDropDistance;
                // ゲームオーバー条件: インベーダーがプレイヤーの位置まで到達
                if (invader.y + invaderHeight >= player.y) {
                    lives = 0;
                    gameOver();
                }
            }
        });
    }
    
    // ランダムに敵が弾を撃つ（モバイルでは頻度を下げる）
    const fireChance = isMobile() ? 0.008 : 0.01;
    if (Math.random() < fireChance) {
        const aliveInvaders = invaders.filter(inv => inv.alive);
        if (aliveInvaders.length > 0) {
            const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
            enemyBullets.push({
                x: shooter.x + shooter.width / 2,
                y: shooter.y + shooter.height
            });
        }
    }
}

// 衝突判定
function checkCollisions() {
    // プレイヤーの弾丸とインベーダー
    bullets.forEach((bullet, bulletIndex) => {
        invaders.forEach(invader => {
            if (invader.alive &&
                bullet.x < invader.x + invader.width &&
                bullet.x + bulletWidth > invader.x &&
                bullet.y < invader.y + invader.height &&
                bullet.y + bulletHeight > invader.y) {
                
                invader.alive = false;
                bullets.splice(bulletIndex, 1);
                score += (5 - invader.type) * 10;
                
                // 爆発エフェクト
                const colors = [
                    '255, 0, 255',
                    '255, 0, 0',
                    '255, 136, 0',
                    '255, 255, 0',
                    '255, 255, 255'
                ];
                createExplosion(
                    invader.x + invader.width / 2,
                    invader.y + invader.height / 2,
                    colors[invader.type]
                );
                
                updateDisplay();
                
                // 全滅チェック
                if (invaders.every(inv => !inv.alive)) {
                    winLevel();
                }
            }
        });
    });
    
    // 敵の弾丸とプレイヤー
    enemyBullets.forEach((bullet, bulletIndex) => {
        if (bullet.x < player.x + player.width &&
            bullet.x + bulletWidth > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bulletHeight > player.y) {
            
            enemyBullets.splice(bulletIndex, 1);
            lives--;
            
            // プレイヤーが被弾した時の爆発エフェクト
            createExplosion(
                player.x + player.width / 2,
                player.y + player.height / 2,
                '255, 0, 0'
            );
            
            updateDisplay();
            
            if (lives <= 0) {
                gameOver();
            }
        }
    });
}

// 画面表示を更新
function updateDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
}

// ゲームオーバー
function gameOver() {
    gameState = 'gameOver';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
}

// ステージクリア
function winLevel() {
    gameState = 'win';
    document.getElementById('winScore').textContent = score;
    document.getElementById('gameWin').classList.remove('hidden');
}

// ゲームループ
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // アニメーションフレームを更新
    animationFrame++;
    
    // 星空を描画
    drawStars();
    
    if (gameState === 'playing') {
        updatePlayer();
        updateBullets();
        updateInvaders();
        updateParticles();
        checkCollisions();
    } else {
        updateParticles();
    }
    
    drawPlayer();
    drawInvaders();
    drawBullets();
    drawParticles();
    
    // ゲーム状態テキスト
    if (gameState === 'ready') {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Enterキーでスタート', canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
    }
    
    requestAnimationFrame(gameLoop);
}

// キーボードイベント
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        player.moveLeft = true;
    }
    if (e.key === 'ArrowRight') {
        player.moveRight = true;
    }
    if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault();
        // 連射制限
        const currentTime = Date.now();
        if (currentTime - lastFireTime > fireDelay) {
            bullets.push({
                x: player.x + player.width / 2 - bulletWidth / 2,
                y: player.y
            });
            lastFireTime = currentTime;
        }
    }
    if (e.key === 'Enter') {
        if (gameState === 'ready') {
            gameState = 'playing';
        } else if (gameState === 'gameOver') {
            document.getElementById('gameOver').classList.add('hidden');
            level = 1;
            init();
            gameState = 'playing';
        } else if (gameState === 'win') {
            document.getElementById('gameWin').classList.add('hidden');
            level++;
            init();
            gameState = 'playing';
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') {
        player.moveLeft = false;
    }
    if (e.key === 'ArrowRight') {
        player.moveRight = false;
    }
});

// タッチ操作
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

// キャンバスタッチイベント（移動用）
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    touchStartX = touchX;
    touchStartY = touchY;
    isTouching = true;
    
    // タッチ位置に応じて移動方向を決定
    const canvasCenter = canvas.width / 2;
    if (touchX < canvasCenter) {
        player.moveLeft = true;
        player.moveRight = false;
    } else {
        player.moveRight = true;
        player.moveLeft = false;
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    
    // タッチ位置に応じて移動方向を更新
    const canvasCenter = canvas.width / 2;
    if (touchX < canvasCenter) {
        player.moveLeft = true;
        player.moveRight = false;
    } else {
        player.moveRight = true;
        player.moveLeft = false;
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    player.moveLeft = false;
    player.moveRight = false;
    isTouching = false;
});

// 仮想ボタンのイベントリスナー
function setupVirtualButtons() {
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const fireBtn = document.getElementById('fireBtn');
    const startBtn = document.getElementById('startBtn');
    
    // 左ボタン
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        player.moveLeft = true;
    });
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        player.moveLeft = false;
    });
    
    // 右ボタン
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        player.moveRight = true;
    });
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        player.moveRight = false;
    });
    
    // 発射ボタン
    fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'playing') {
            // 連射制限
            const currentTime = Date.now();
            if (currentTime - lastFireTime > fireDelay) {
                bullets.push({
                    x: player.x + player.width / 2 - bulletWidth / 2,
                    y: player.y
                });
                lastFireTime = currentTime;
            }
        }
    });
    
    // スタートボタン
    startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameState === 'ready') {
            gameState = 'playing';
        } else if (gameState === 'gameOver') {
            document.getElementById('gameOver').classList.add('hidden');
            level = 1;
            init();
            gameState = 'playing';
        } else if (gameState === 'win') {
            document.getElementById('gameWin').classList.add('hidden');
            level++;
            init();
            gameState = 'playing';
        }
    });
}

// ゲーム開始
init();
setupVirtualButtons();
gameLoop();

// 自動的にゲームを開始
setTimeout(() => {
    if (gameState === 'ready') {
        gameState = 'playing';
    }
}, 100);
