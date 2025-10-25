// ゲーム設定
let canvas;
let ctx;

// キャンバスの初期化
function initCanvas() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return false;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Cannot get 2D context!');
        return false;
    }
    return true;
}

// キャンバスサイズをデバイスに合わせて設定
function setCanvasSize() {
    if (!canvas) return;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        // モバイル: 縦画面に最適化（見切れ防止のため高さを調整）
        // iPhone15のホーム画面起動に対応した高さ計算
        // visualViewportまたはwindow.innerHeightを使用
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        
        canvas.width = Math.min(window.innerWidth - 20, 400);
        // ヘッダー（約70px）、フリックコントローラー（約160px）、余白（約30px）を考慮
        // さらに余裕を持たせて見切れを防ぐ
        canvas.height = Math.max(Math.min(viewportHeight - 280, 600), 340);
    } else {
        // PC: 従来のサイズ
        canvas.width = 800;
        canvas.height = 600;
    }
}

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

// パワーアップアイテム
let powerUps = [];
const powerUpSpeed = 2;
const powerUpTypes = [
    { type: 'attack', color: '#ff0000', label: 'P', effect: 'パワーアップ' },
    { type: 'speed', color: '#00ff00', label: 'S', effect: 'スピードアップ' },
    { type: 'shield', color: '#0088ff', label: 'B', effect: 'バリア' },
    { type: 'laser', color: '#ff00ff', label: 'L', effect: 'レーザー' },
    { type: 'bomb', color: '#ffaa00', label: 'X', effect: '爆弾' },
    { type: 'rapid', color: '#00ffff', label: 'R', effect: '連射' },
    { type: 'penetrate', color: '#ffff00', label: 'T', effect: '貫通弾' },
    { type: 'multishot', color: '#ff0088', label: 'M', effect: 'マルチショット' }
];

// プレイヤーのパワーアップ状態
let playerPowerUps = {
    attack: { active: false, timer: 0, duration: 10000, multiplier: 2 },
    speed: { active: false, timer: 0, duration: 10000, speedBonus: 3 },
    shield: { active: false, timer: 0, duration: 8000 },
    laser: { active: false, timer: 0, duration: 8000 },
    bomb: { active: false, timer: 0, duration: 12000 },
    rapid: { active: false, timer: 0, duration: 10000 },
    penetrate: { active: false, timer: 0, duration: 10000 },
    multishot: { active: false, timer: 0, duration: 10000 }
};

// パーティクル（爆発エフェクト）
let particles = [];

// 星空背景
let stars = [];

// アニメーション用フレームカウンター
let animationFrame = 0;

// 星空を作成
function createStars() {
    if (!canvas) return;
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
    if (!canvas) return;
    
    gameState = 'ready';
    score = 0;
    lives = 3;
    bullets = [];
    enemyBullets = [];
    powerUps = [];
    particles = [];
    
    // パワーアップをリセット
    Object.keys(playerPowerUps).forEach(key => {
        playerPowerUps[key].active = false;
        playerPowerUps[key].timer = 0;
    });
    
    // プレイヤーの位置を初期化
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 60;
    
    // モバイルでは敵の数を減らす
    if (isMobile()) {
        invaderRows = 5;
        invaderCols = 8;
        player.speed = 4; // 移動を少し遅く（6から4へ変更）
    } else {
        invaderRows = 6;
        invaderCols = 12;
        player.speed = 3.5; // 移動を少し遅く（5から3.5へ変更）
    }
    
    // ベース速度を記録
    player.baseSpeed = player.speed;
    
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
    // バリアエフェクト（アクティブな場合）- 最適化版
    if (playerPowerUps.shield.active) {
        const shieldRadius = 30;
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
            player.x + player.width / 2, 
            player.y + player.height / 2, 
            shieldRadius + Math.sin(animationFrame * 0.1) * 2, 
            0, 
            Math.PI * 2
        );
        ctx.stroke();
    }
    
    // プレイヤー色の決定（パワーアップに応じて変化）
    let playerColor = '#00ff00';
    if (playerPowerUps.laser.active) playerColor = '#ff00ff';
    else if (playerPowerUps.bomb.active) playerColor = '#ffaa00';
    else if (playerPowerUps.attack.active) playerColor = '#ff0000';
    else if (playerPowerUps.penetrate.active) playerColor = '#ffff00';
    else if (playerPowerUps.multishot.active) playerColor = '#ff0088';
    
    ctx.fillStyle = playerColor;
    // 宇宙船の形
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // エンジン炎のアニメーション（スピードアップ時は大きく）- 最適化版
    const flameSize = playerPowerUps.speed.active ? 12 : 8;
    if (gameState === 'playing' && Math.floor(animationFrame / 5) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 150, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2 - 5, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + flameSize);
        ctx.lineTo(player.x + player.width / 2 + 5, player.y + player.height);
        ctx.closePath();
        ctx.fill();
    }
    
    // コックピット
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(player.x + player.width / 2 - 4, player.y + 8, 8, 8);
}

// インベーダーを描画（最適化版）
function drawInvaders() {
    const colors = ['#ff00ff', '#ff0000', '#ff8800', '#ffff00', '#ffffff'];
    const eyeColor = Math.floor(animationFrame / 10) % 2 === 0 ? '#ffff00' : '#ff0000';
    const wobble = Math.sin(animationFrame * 0.1) * 0.5; // 共通のwobble値
    
    invaders.forEach(invader => {
        if (invader.alive) {
            ctx.fillStyle = colors[invader.type];
            
            // インベーダーの体（シンプル化）
            ctx.fillRect(invader.x + 4, invader.y + wobble, invader.width - 8, invader.height - 4);
            ctx.fillRect(invader.x, invader.y + 8 + wobble, invader.width, invader.height - 12);
            
            // 触角
            ctx.fillRect(invader.x + 2, invader.y - 2 + wobble, 3, 4);
            ctx.fillRect(invader.x + invader.width - 5, invader.y - 2 + wobble, 3, 4);
            
            // 目
            ctx.fillStyle = eyeColor;
            ctx.fillRect(invader.x + 7, invader.y + 4 + wobble, 4, 4);
            ctx.fillRect(invader.x + invader.width - 11, invader.y + 4 + wobble, 4, 4);
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

// パーティクルを描画（最適化版）
function drawParticles() {
    particles.forEach(particle => {
        ctx.fillStyle = `rgba(${particle.color}, ${particle.life})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// パワーアップアイテムを描画（最適化版）
function drawPowerUps() {
    powerUps.forEach(powerUp => {
        const size = 20;
        const x = powerUp.x;
        const y = powerUp.y;
        
        // 外側の円（回転するリング）
        ctx.strokeStyle = powerUp.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, size, animationFrame * 0.05, animationFrame * 0.05 + Math.PI * 1.5);
        ctx.stroke();
        
        // 内側の円
        ctx.fillStyle = powerUp.color;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        // アイコンラベル
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.label, x, y);
    });
}

// 弾丸を描画（最適化版）
function drawBullets() {
    // プレイヤーの弾丸
    bullets.forEach(bullet => {
        let width = bulletWidth;
        let height = bulletHeight;
        let color = '#00ff00';
        
        // パワーアップに応じて弾丸の見た目を変更
        if (bullet.type === 'laser') {
            width = bulletWidth * 2;
            height = bullet.y; // プレイヤー位置から上端まで
            color = '#ff00ff';
            // レーザーの透明度を調整（点滅効果）
            const alpha = bullet.life ? (bullet.life / 3) * 0.8 + 0.2 : 0.8;
            ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
            ctx.fillRect(bullet.x - (width - bulletWidth) / 2, 0, width, height);
            // レーザーの中心線（明るく）
            ctx.fillStyle = `rgba(255, 100, 255, ${alpha})`;
            ctx.fillRect(bullet.x, 0, bulletWidth, height);
            return;
        } else if (bullet.type === 'bomb') {
            width = bulletWidth * 3;
            height = bulletHeight * 2;
            color = '#ffaa00';
        } else if (bullet.type === 'penetrate') {
            width = bulletWidth * 1.5;
            height = bulletHeight * 1.2;
            color = '#ffff00';
        } else if (playerPowerUps.attack.active) {
            width = bulletWidth * 2;
            height = bulletHeight * 1.5;
            color = '#ff0000';
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(bullet.x - (width - bulletWidth) / 2, bullet.y, width, height);
    });
    
    // 敵の弾丸
    ctx.fillStyle = '#ff0000';
    enemyBullets.forEach(bullet => {
        ctx.fillRect(bullet.x, bullet.y, bulletWidth, bulletHeight);
    });
}

// プレイヤーを更新
function updatePlayer() {
    // スピードアップ効果を適用
    const currentSpeed = playerPowerUps.speed.active 
        ? player.baseSpeed + playerPowerUps.speed.speedBonus 
        : player.baseSpeed;
    
    if (player.moveLeft && player.x > 0) {
        player.x -= currentSpeed;
    }
    if (player.moveRight && player.x < canvas.width - player.width) {
        player.x += currentSpeed;
    }
}

// パワーアップを更新
function updatePowerUps() {
    // パワーアップアイテムの移動
    powerUps = powerUps.filter(powerUp => {
        powerUp.y += powerUpSpeed;
        return powerUp.y < canvas.height + 30;
    });
    
    // パワーアップタイマーを更新
    const currentTime = Date.now();
    
    if (playerPowerUps.attack.active) {
        if (currentTime - playerPowerUps.attack.timer > playerPowerUps.attack.duration) {
            playerPowerUps.attack.active = false;
        }
    }
    
    if (playerPowerUps.speed.active) {
        if (currentTime - playerPowerUps.speed.timer > playerPowerUps.speed.duration) {
            playerPowerUps.speed.active = false;
        }
    }
    
    if (playerPowerUps.shield.active) {
        if (currentTime - playerPowerUps.shield.timer > playerPowerUps.shield.duration) {
            playerPowerUps.shield.active = false;
        }
    }
    
    // 新しいパワーアップのタイマー更新
    ['laser', 'bomb', 'rapid', 'penetrate', 'multishot'].forEach(type => {
        if (playerPowerUps[type].active) {
            if (currentTime - playerPowerUps[type].timer > playerPowerUps[type].duration) {
                playerPowerUps[type].active = false;
            }
        }
    });
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
        // レーザーは移動しない、通常弾は上に移動
        if (bullet.type !== 'laser') {
            bullet.y -= bulletSpeed;
            if (bullet.vx) bullet.x += bullet.vx; // マルチショット用の横移動
        }
        
        // レーザーの寿命管理
        if (bullet.type === 'laser') {
            if (bullet.life !== undefined) {
                bullet.life--;
                return bullet.life > 0;
            }
            return false;
        }
        
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
        let hitCount = 0;
        invaders.forEach(invader => {
            // 弾丸のサイズを判定
            let currentBulletWidth = bulletWidth;
            let currentBulletHeight = bulletHeight;
            let bulletX = bullet.x - (currentBulletWidth - bulletWidth) / 2;
            let bulletY = bullet.y;
            
            if (bullet.type === 'laser') {
                currentBulletWidth = bulletWidth * 2;
                // レーザーは画面上端（y=0）から発射位置まで
                currentBulletHeight = bullet.y;
                bulletY = 0; // レーザーは上端から始まる
            } else if (bullet.type === 'bomb') {
                currentBulletWidth = bulletWidth * 3;
                currentBulletHeight = bulletHeight * 2;
            } else if (bullet.type === 'penetrate') {
                currentBulletWidth = bulletWidth * 1.5;
                currentBulletHeight = bulletHeight * 1.2;
            } else if (playerPowerUps.attack.active) {
                currentBulletWidth = bulletWidth * 2;
                currentBulletHeight = bulletHeight * 1.5;
            }
            
            bulletX = bullet.x - (currentBulletWidth - bulletWidth) / 2;
            
            if (invader.alive &&
                bulletX < invader.x + invader.width &&
                bulletX + currentBulletWidth > invader.x &&
                bulletY < invader.y + invader.height &&
                bulletY + currentBulletHeight > invader.y) {
                
                invader.alive = false;
                hitCount++;
                
                // 爆弾の場合は範囲攻撃
                if (bullet.type === 'bomb') {
                    const blastRadius = 60;
                    invaders.forEach(otherInvader => {
                        if (otherInvader.alive) {
                            const dx = (otherInvader.x + otherInvader.width/2) - (invader.x + invader.width/2);
                            const dy = (otherInvader.y + otherInvader.height/2) - (invader.y + invader.height/2);
                            const distance = Math.sqrt(dx*dx + dy*dy);
                            if (distance < blastRadius) {
                                otherInvader.alive = false;
                                score += (5 - otherInvader.type) * 10;
                                createExplosion(
                                    otherInvader.x + otherInvader.width / 2,
                                    otherInvader.y + otherInvader.height / 2,
                                    '255, 136, 0'
                                );
                            }
                        }
                    });
                }
                
                // 貫通弾とレーザー以外は弾丸を削除
                if (bullet.type !== 'penetrate' && bullet.type !== 'laser') {
                    bullets.splice(bulletIndex, 1);
                }
                
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
                
                // パワーアップをランダムでドロップ（25%の確率）
                if (Math.random() < 0.25) {
                    const powerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                    powerUps.push({
                        x: invader.x + invader.width / 2,
                        y: invader.y + invader.height / 2,
                        type: powerUpType.type,
                        color: powerUpType.color,
                        label: powerUpType.label,
                        effect: powerUpType.effect
                    });
                }
                
                updateDisplay();
                
                // 全滅チェック
                if (invaders.every(inv => !inv.alive)) {
                    winLevel();
                }
            }
        });
    });
    
    // プレイヤーとパワーアップアイテムの衝突
    powerUps.forEach((powerUp, index) => {
        const distance = Math.sqrt(
            Math.pow(powerUp.x - (player.x + player.width / 2), 2) +
            Math.pow(powerUp.y - (player.y + player.height / 2), 2)
        );
        
        if (distance < 30) {
            // パワーアップを取得
            activatePowerUp(powerUp.type);
            powerUps.splice(index, 1);
            
            // 取得エフェクト
            createExplosion(powerUp.x, powerUp.y, powerUp.color.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16)).join(', '));
        }
    });
    
    // 敵の弾丸とプレイヤー
    enemyBullets.forEach((bullet, bulletIndex) => {
        if (bullet.x < player.x + player.width &&
            bullet.x + bulletWidth > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bulletHeight > player.y) {
            
            enemyBullets.splice(bulletIndex, 1);
            
            // バリアがアクティブな場合はダメージを受けない
            if (!playerPowerUps.shield.active) {
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
            } else {
                // バリアで防いだエフェクト
                createExplosion(
                    player.x + player.width / 2,
                    player.y + player.height / 2,
                    '0, 136, 255'
                );
            }
        }
    });
}

// パワーアップを有効化
function activatePowerUp(type) {
    const currentTime = Date.now();
    
    if (playerPowerUps[type]) {
        playerPowerUps[type].active = true;
        playerPowerUps[type].timer = currentTime;
    }
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
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // アニメーションフレームを更新
    animationFrame++;
    
    // 星空を描画
    drawStars();
    
    if (gameState === 'playing') {
        updatePlayer();
        updateBullets();
        updateInvaders();
        updatePowerUps();
        updateParticles();
        checkCollisions();
    } else {
        updateParticles();
    }
    
    drawPlayer();
    drawInvaders();
    drawBullets();
    drawPowerUps();
    drawParticles();
    
    // パワーアップステータス表示
    drawPowerUpStatus();
    
    // ゲーム状態テキスト
    if (gameState === 'ready') {
        ctx.fillStyle = '#00ff00';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Enterキーでスタート', canvas.width / 2, canvas.height / 2);
    }
    
    requestAnimationFrame(gameLoop);
}

// パワーアップのステータスを表示
function drawPowerUpStatus() {
    const currentTime = Date.now();
    let yOffset = 10;
    
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    
    const statusConfig = [
        { key: 'attack', icon: '⚡', name: 'パワーアップ', color: '#ff0000' },
        { key: 'speed', icon: '⚡', name: 'スピード', color: '#00ff00' },
        { key: 'shield', icon: '🛡️', name: 'バリア', color: '#0088ff' },
        { key: 'laser', icon: '🔆', name: 'レーザー', color: '#ff00ff' },
        { key: 'bomb', icon: '💣', name: '爆弾', color: '#ffaa00' },
        { key: 'rapid', icon: '🔥', name: '連射', color: '#00ffff' },
        { key: 'penetrate', icon: '➤', name: '貫通', color: '#ffff00' },
        { key: 'multishot', icon: '✦', name: 'マルチ', color: '#ff0088' }
    ];
    
    statusConfig.forEach(config => {
        if (playerPowerUps[config.key].active) {
            const remaining = Math.ceil((playerPowerUps[config.key].duration - (currentTime - playerPowerUps[config.key].timer)) / 1000);
            ctx.fillStyle = config.color;
            ctx.fillText(`${config.icon} ${config.name}: ${remaining}秒`, 10, yOffset);
            yOffset += 18;
        }
    });
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
        fireBullet();
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

// キャンバスタッチイベントのセットアップ（移動用）
function setupCanvasTouchEvents() {
    if (!canvas) return;
    
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
}

// フリックコントローラーのセットアップ
function setupFlickController() {
    const flickController = document.getElementById('flickController');
    const flickIndicator = document.getElementById('flickIndicator');
    
    let touchStartPos = { x: 0, y: 0 };
    let isTouchingFlick = false;
    let controllerCenter = { x: 0, y: 0 };
    
    flickController.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = flickController.getBoundingClientRect();
        
        // コントローラーの中心を記録
        controllerCenter.x = rect.left + rect.width / 2;
        controllerCenter.y = rect.top + rect.height / 2;
        
        // タッチ開始位置を記録
        touchStartPos.x = touch.clientX;
        touchStartPos.y = touch.clientY;
        
        isTouchingFlick = true;
        
        // インジケーターを中央に配置
        flickIndicator.style.left = '50%';
        flickIndicator.style.top = '50%';
        flickIndicator.style.transform = 'translate(-50%, -50%)';
        flickIndicator.classList.add('active');
    });
    
    flickController.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isTouchingFlick) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartPos.x;
        const deltaY = touch.clientY - touchStartPos.y;
        
        // インジケーターの位置を更新（制限付き）
        const maxDistance = 50;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        let indicatorX = deltaX;
        let indicatorY = deltaY;
        
        if (distance > maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            indicatorX = Math.cos(angle) * maxDistance;
            indicatorY = Math.sin(angle) * maxDistance;
        }
        
        flickIndicator.style.left = `calc(50% + ${indicatorX}px)`;
        flickIndicator.style.top = `calc(50% + ${indicatorY}px)`;
        flickIndicator.style.transform = 'translate(-50%, -50%)';
        
        // 移動方向を決定（閾値を設定）
        const threshold = 15;
        if (Math.abs(deltaX) > threshold) {
            if (deltaX < 0) {
                player.moveLeft = true;
                player.moveRight = false;
            } else {
                player.moveRight = true;
                player.moveLeft = false;
            }
        } else {
            player.moveLeft = false;
            player.moveRight = false;
        }
    });
    
    flickController.addEventListener('touchend', (e) => {
        e.preventDefault();
        player.moveLeft = false;
        player.moveRight = false;
        isTouchingFlick = false;
        flickIndicator.classList.remove('active');
    });
    
    flickController.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        player.moveLeft = false;
        player.moveRight = false;
        isTouchingFlick = false;
        flickIndicator.classList.remove('active');
    });
}

// 仮想ボタンのイベントリスナー
function setupVirtualButtons() {
    const fireBtn = document.getElementById('fireBtn');
    const startBtn = document.getElementById('startBtn');
    
    // 発射ボタン
    fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'playing') {
            fireBullet();
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

// 弾丸発射関数
function fireBullet() {
    const currentTime = Date.now();
    const currentFireDelay = playerPowerUps.rapid.active ? fireDelay / 3 : fireDelay;
    
    if (currentTime - lastFireTime > currentFireDelay) {
        const centerX = player.x + player.width / 2 - bulletWidth / 2;
        const bulletY = player.y;
        
        // 弾丸タイプを決定
        let bulletType = 'normal';
        if (playerPowerUps.laser.active) bulletType = 'laser';
        else if (playerPowerUps.bomb.active) bulletType = 'bomb';
        else if (playerPowerUps.penetrate.active) bulletType = 'penetrate';
        
        if (playerPowerUps.multishot.active) {
            // マルチショット: 3方向に発射
            bullets.push({ x: centerX, y: bulletY, vx: 0, type: bulletType, life: bulletType === 'laser' ? 3 : -1 });
            bullets.push({ x: centerX - 10, y: bulletY, vx: -2, type: bulletType, life: bulletType === 'laser' ? 3 : -1 });
            bullets.push({ x: centerX + 10, y: bulletY, vx: 2, type: bulletType, life: bulletType === 'laser' ? 3 : -1 });
        } else {
            bullets.push({ x: centerX, y: bulletY, vx: 0, type: bulletType, life: bulletType === 'laser' ? 3 : -1 });
        }
        
        lastFireTime = currentTime;
    }
}

// ゲーム開始関数
let gameStarted = false;

function startGame() {
    if (gameStarted) return; // 既に開始している場合は何もしない
    
    if (!initCanvas()) {
        console.error('Failed to initialize canvas');
        return;
    }
    
    gameStarted = true;
    
    // キャンバスサイズを設定
    setCanvasSize();
    
    // リサイズイベントリスナーを一度だけ追加
    if (!window.invaderResizeListenerAdded) {
        window.addEventListener('resize', setCanvasSize);
        window.invaderResizeListenerAdded = true;
    }
    
    // ゲームを初期化
    init();
    setupCanvasTouchEvents();
    setupFlickController();
    setupVirtualButtons();
    gameLoop();
    
    // 自動的にゲームを開始
    setTimeout(() => {
        if (gameState === 'ready') {
            gameState = 'playing';
        }
    }, 100);
}

// DOMContentLoadedイベントでゲームを開始
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    // DOMが既に読み込まれている場合は即座に開始
    startGame();
}
