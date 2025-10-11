// ゲーム設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// ゲーム状態
let gameState = 'ready'; // ready, playing, gameOver, win
let score = 0;
let lives = 3;
let level = 1;

// プレイヤー
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 60,
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
const invaderRows = 5;
const invaderCols = 10;
const invaderWidth = 40;
const invaderHeight = 30;
let invaderSpeed = 1;
let invaderDirection = 1;
let invaderDropDistance = 20;

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
    player.x = canvas.width / 2 - 25;
    invaderSpeed = 1 + (level - 1) * 0.3;
    createInvaders();
    updateDisplay();
}

// インベーダーを作成
function createInvaders() {
    invaders = [];
    const startX = 50;
    const startY = 50;
    const spacingX = 60;
    const spacingY = 50;
    
    for (let row = 0; row < invaderRows; row++) {
        for (let col = 0; col < invaderCols; col++) {
            invaders.push({
                x: startX + col * spacingX,
                y: startY + row * spacingY,
                width: invaderWidth,
                height: invaderHeight,
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
            
            if (invader.x <= 0 || invader.x >= canvas.width - invaderWidth) {
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
    
    // ランダムに敵が弾を撃つ
    if (Math.random() < 0.01) {
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
        bullets.push({
            x: player.x + player.width / 2 - bulletWidth / 2,
            y: player.y
        });
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

// ゲーム開始
init();
gameLoop();
