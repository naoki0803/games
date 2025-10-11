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
    width: 50,
    height: 30,
    speed: 5,
    moveLeft: false,
    moveRight: false
};

// 弾丸
let bullets = [];
const bulletSpeed = 7;
const bulletWidth = 4;
const bulletHeight = 15;

// 敵
let invaders = [];
let invaderRows = 6;
let invaderCols = 12;
const invaderWidth = 36;
const invaderHeight = 27;
let invaderSpeed = 0.7;
let invaderDirection = 1;
let invaderDropDistance = 15;

// 敵の弾丸
let enemyBullets = [];
const enemyBulletSpeed = 3;

// 初期化
function init() {
    gameState = 'ready';
    score = 0;
    lives = 3;
    bullets = [];
    enemyBullets = [];
    
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
    ctx.fillStyle = '#00ff00';
    // 宇宙船の形
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // コックピット
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(player.x + player.width / 2 - 5, player.y + 10, 10, 10);
}

// インベーダーを描画
function drawInvaders() {
    invaders.forEach(invader => {
        if (invader.alive) {
            // 種類によって色を変える
            const colors = ['#ff00ff', '#ff0000', '#ff8800', '#ffff00', '#ffffff'];
            ctx.fillStyle = colors[invader.type];
            
            // シンプルなインベーダーの形
            ctx.fillRect(invader.x + 5, invader.y, invader.width - 10, invader.height - 5);
            ctx.fillRect(invader.x, invader.y + 10, invader.width, invader.height - 15);
            
            // 目
            ctx.fillStyle = '#000';
            ctx.fillRect(invader.x + 10, invader.y + 5, 5, 5);
            ctx.fillRect(invader.x + invader.width - 15, invader.y + 5, 5, 5);
        }
    });
}

// 弾丸を描画
function drawBullets() {
    ctx.fillStyle = '#00ff00';
    bullets.forEach(bullet => {
        ctx.fillRect(bullet.x, bullet.y, bulletWidth, bulletHeight);
    });
    
    ctx.fillStyle = '#ff0000';
    enemyBullets.forEach(bullet => {
        ctx.fillRect(bullet.x, bullet.y, bulletWidth, bulletHeight);
    });
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
    
    if (gameState === 'playing') {
        updatePlayer();
        updateBullets();
        updateInvaders();
        checkCollisions();
    }
    
    drawPlayer();
    drawInvaders();
    drawBullets();
    
    // ゲーム状態テキスト
    if (gameState === 'ready') {
        ctx.fillStyle = '#00ff00';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Enterキーでスタート', canvas.width / 2, canvas.height / 2);
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
