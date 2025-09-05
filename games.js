// ゲーム管理システム
class GameManager {
    constructor() {
        this.currentGame = null;
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupEventListeners();
        this.audioContext = null;
        this.initAudio();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const maxWidth = 800;
        const maxHeight = 600;
        const aspectRatio = maxWidth / maxHeight;
        
        let width = window.innerWidth * 0.9;
        let height = window.innerHeight * 0.7;
        
        // アスペクト比を維持
        if (width / height > aspectRatio) {
            width = height * aspectRatio;
        } else {
            height = width / aspectRatio;
        }
        
        // 最大サイズを超えないように制限
        if (width > maxWidth) {
            width = maxWidth;
            height = maxHeight;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // ゲームが実行中の場合はリサイズを通知
        if (this.currentGame && this.currentGame.handleResize) {
            this.currentGame.handleResize();
        }
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    playBeep(frequency = 440, duration = 100) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.currentGame) {
                this.currentGame.handleInput(e);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.currentGame) {
                this.currentGame.handleInputRelease(e);
            }
        });

        // タッチ操作のサポート
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.currentGame) {
                this.currentGame.handleTouch(e);
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.currentGame) {
                this.currentGame.handleTouchMove(e);
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
        });

        // iOSでのスクロール防止
        document.addEventListener('touchmove', (e) => {
            if (e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    showScreen(screenName) {
        document.getElementById('gameMenu').classList.add('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        document.getElementById(screenName).classList.remove('hidden');
    }
}

// ブロック崩しゲーム
class BreakoutGame {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.canvas = gameManager.canvas;
        this.ctx = gameManager.ctx;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameRunning = false;
        this.keys = {};
        
        this.initializeGame();
    }

    initializeGame() {
        // スケール比率を計算
        this.scale = Math.min(this.width / 800, this.height / 600);
        
        // パドル設定
        this.paddle = {
            x: this.width / 2 - 60 * this.scale,
            y: this.height - 30 * this.scale,
            width: 120 * this.scale,
            height: 15 * this.scale,
            speed: 8 * this.scale,
            color: '#ff6b6b'
        };

        // ボール設定
        this.ball = {
            x: this.width / 2,
            y: this.height / 2,
            radius: 8 * this.scale,
            speedX: 5 * this.scale,
            speedY: -5 * this.scale,
            color: '#4ecdc4'
        };

        // ブロック設定
        this.createBlocks();
        this.updateDisplay();
    }

    createBlocks() {
        this.blocks = [];
        const blockWidth = 70 * this.scale;
        const blockHeight = 25 * this.scale;
        const blockPadding = 5 * this.scale;
        const blockOffsetTop = 80 * this.scale;
        const blockOffsetLeft = 35 * this.scale;
        
        const blockRows = 5 + Math.floor(this.level / 2);
        const blockCols = 10;
        
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#e17055', '#74b9ff'];
        
        for (let row = 0; row < blockRows; row++) {
            for (let col = 0; col < blockCols; col++) {
                const block = {
                    x: blockOffsetLeft + col * (blockWidth + blockPadding),
                    y: blockOffsetTop + row * (blockHeight + blockPadding),
                    width: blockWidth,
                    height: blockHeight,
                    color: colors[row % colors.length],
                    points: (blockRows - row) * 10
                };
                this.blocks.push(block);
            }
        }
    }

    handleInput(e) {
        this.keys[e.key] = true;
        
        if (e.key === ' ' || e.key === 'Enter') {
            if (!this.gameRunning) {
                this.startGame();
            }
        }
    }

    handleInputRelease(e) {
        this.keys[e.key] = false;
    }

    handleTouch(e) {
        // ゲームがまだ開始されていない場合は開始
        if (!this.gameRunning) {
            this.startGame();
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        
        this.paddle.x = x - this.paddle.width / 2;
        this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x));
    }

    handleTouchMove(e) {
        this.handleTouch(e);
    }

    handleResize() {
        // キャンバスサイズを更新
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // スケール比率を再計算
        const oldScale = this.scale;
        this.scale = Math.min(this.width / 800, this.height / 600);
        const scaleRatio = this.scale / oldScale;
        
        // パドル位置とサイズを調整
        this.paddle.x *= scaleRatio;
        this.paddle.y = this.height - 30 * this.scale;
        this.paddle.width *= scaleRatio;
        this.paddle.height *= scaleRatio;
        this.paddle.speed *= scaleRatio;
        
        // ボール位置とサイズを調整
        this.ball.x *= scaleRatio;
        this.ball.y *= scaleRatio;
        this.ball.radius *= scaleRatio;
        this.ball.speedX *= scaleRatio;
        this.ball.speedY *= scaleRatio;
        
        // ブロック位置とサイズを調整
        this.blocks.forEach(block => {
            block.x *= scaleRatio;
            block.y *= scaleRatio;
            block.width *= scaleRatio;
            block.height *= scaleRatio;
        });
    }

    startGame() {
        this.gameRunning = true;
        this.gameLoop();
    }

    gameLoop() {
        if (!this.gameRunning) return;
        
        this.update();
        this.draw();
        
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // パドルの移動
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            this.paddle.x -= this.paddle.speed;
        }
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            this.paddle.x += this.paddle.speed;
        }
        
        // パドルの境界チェック
        this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x));
        
        // ボールの移動
        this.ball.x += this.ball.speedX;
        this.ball.y += this.ball.speedY;
        
        // ボールの壁との衝突
        if (this.ball.x <= this.ball.radius || this.ball.x >= this.width - this.ball.radius) {
            this.ball.speedX = -this.ball.speedX;
            this.gameManager.playBeep(300, 100);
        }
        
        if (this.ball.y <= this.ball.radius) {
            this.ball.speedY = -this.ball.speedY;
            this.gameManager.playBeep(300, 100);
        }
        
        // ボールがパドルと衝突
        if (this.ball.y + this.ball.radius >= this.paddle.y &&
            this.ball.x >= this.paddle.x &&
            this.ball.x <= this.paddle.x + this.paddle.width) {
            
            // パドルのどの部分に当たったかで反射角度を変更
            const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
            const angle = (hitPos - 0.5) * Math.PI / 3; // -60度から60度
            
            const speed = Math.sqrt(this.ball.speedX * this.ball.speedX + this.ball.speedY * this.ball.speedY);
            this.ball.speedX = Math.sin(angle) * speed;
            this.ball.speedY = -Math.abs(Math.cos(angle) * speed);
            
            this.gameManager.playBeep(400, 150);
        }
        
        // ブロックとの衝突チェック
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            
            if (this.ball.x + this.ball.radius >= block.x &&
                this.ball.x - this.ball.radius <= block.x + block.width &&
                this.ball.y + this.ball.radius >= block.y &&
                this.ball.y - this.ball.radius <= block.y + block.height) {
                
                // ブロックを削除
                this.blocks.splice(i, 1);
                this.score += block.points;
                this.updateDisplay();
                
                // ボールの反射
                const blockCenterX = block.x + block.width / 2;
                const blockCenterY = block.y + block.height / 2;
                
                if (Math.abs(this.ball.x - blockCenterX) > Math.abs(this.ball.y - blockCenterY)) {
                    this.ball.speedX = -this.ball.speedX;
                } else {
                    this.ball.speedY = -this.ball.speedY;
                }
                
                this.gameManager.playBeep(600, 200);
                break;
            }
        }
        
        // ゲームクリア
        if (this.blocks.length === 0) {
            this.levelUp();
        }
        
        // ボールが下に落ちた
        if (this.ball.y > this.height) {
            this.lives--;
            this.updateDisplay();
            
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.resetBall();
                this.gameManager.playBeep(200, 300);
            }
        }
    }

    resetBall() {
        this.ball.x = this.width / 2;
        this.ball.y = this.height / 2;
        this.ball.speedX = 5 * (Math.random() > 0.5 ? 1 : -1);
        this.ball.speedY = -5;
    }

    levelUp() {
        this.level++;
        this.updateDisplay();
        this.createBlocks();
        this.resetBall();
        
        // ボールの速度を少し上げる
        this.ball.speedX *= 1.1;
        this.ball.speedY *= 1.1;
        
        this.gameManager.playBeep(800, 500);
    }

    gameOver() {
        this.gameRunning = false;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverTitle').textContent = this.lives <= 0 ? 'ゲームオーバー' : 'ゲームクリア！';
        this.gameManager.showScreen('gameOverScreen');
    }

    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;
    }

    draw() {
        // 背景をクリア
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 星の背景
        this.drawStars();
        
        // パドルを描画
        this.drawPaddle();
        
        // ボールを描画
        this.drawBall();
        
        // ブロックを描画
        this.drawBlocks();
        
        // ゲーム開始前のメッセージ
        if (!this.gameRunning) {
            this.drawStartMessage();
        }
    }

    drawStars() {
        this.ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
            const x = (Date.now() * 0.001 + i * 137.5) % this.width;
            const y = (i * 237.5) % this.height;
            this.ctx.fillRect(x, y, 1, 1);
        }
    }

    drawPaddle() {
        // パドルのグラデーション
        const gradient = this.ctx.createLinearGradient(this.paddle.x, 0, this.paddle.x + this.paddle.width, 0);
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#4ecdc4');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        
        // パドルの枠
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    }

    drawBall() {
        // ボールのグラデーション
        const gradient = this.ctx.createRadialGradient(this.ball.x, this.ball.y, 0, this.ball.x, this.ball.y, this.ball.radius);
        gradient.addColorStop(0, '#4ecdc4');
        gradient.addColorStop(1, '#45b7d1');
        
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // ボールの枠
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawBlocks() {
        this.blocks.forEach(block => {
            // ブロックのグラデーション
            const gradient = this.ctx.createLinearGradient(block.x, block.y, block.x, block.y + block.height);
            gradient.addColorStop(0, block.color);
            gradient.addColorStop(1, this.darkenColor(block.color, 0.3));
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(block.x, block.y, block.width, block.height);
            
            // ブロックの枠
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(block.x, block.y, block.width, block.height);
        });
    }

    drawStartMessage() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('スペースキーまたはEnterでゲーム開始！', this.width / 2, this.height / 2);
        
        this.ctx.font = '18px Arial';
        this.ctx.fillText('←→キーでパドルを動かそう！', this.width / 2, this.height / 2 + 40);
    }

    darkenColor(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        let r = (num >> 16) - Math.round(255 * amount);
        let g = (num >> 8 & 0x00FF) - Math.round(255 * amount);
        let b = (num & 0x0000FF) - Math.round(255 * amount);
        r = r < 0 ? 0 : r;
        g = g < 0 ? 0 : g;
        b = b < 0 ? 0 : b;
        return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16);
    }
}

// グローバル変数
let gameManager;

// ゲーム開始時の初期化
document.addEventListener('DOMContentLoaded', () => {
    gameManager = new GameManager();
});

// ゲーム制御関数
function startGame(gameType) {
    if (!gameManager) {
        console.error('GameManager not initialized yet');
        return;
    }
    gameManager.showScreen('gameScreen');
    
    switch (gameType) {
        case 'breakout':
            gameManager.currentGame = new BreakoutGame(gameManager);
            document.getElementById('gameTitle').textContent = 'ブロック崩し';
            break;
        default:
            alert('このゲームはまだ準備中です！');
            backToMenu();
            return;
    }
    
    gameManager.gameState = 'playing';
}

function pauseGame() {
    if (!gameManager) return;
    if (gameManager.currentGame && gameManager.currentGame.gameRunning) {
        gameManager.currentGame.gameRunning = false;
        gameManager.gameState = 'paused';
        
        // 一時停止メッセージを表示
        const ctx = gameManager.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, gameManager.canvas.width, gameManager.canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('一時停止中', gameManager.canvas.width / 2, gameManager.canvas.height / 2);
        ctx.fillText('スペースキーで再開', gameManager.canvas.width / 2, gameManager.canvas.height / 2 + 40);
    } else if (gameManager.gameState === 'paused') {
        gameManager.currentGame.gameRunning = true;
        gameManager.gameState = 'playing';
        gameManager.currentGame.gameLoop();
    }
}

function restartGame() {
    if (!gameManager) return;
    if (gameManager.currentGame) {
        gameManager.currentGame.initializeGame();
        gameManager.showScreen('gameScreen');
        gameManager.gameState = 'playing';
    }
}

function backToMenu() {
    if (!gameManager) return;
    if (gameManager.currentGame) {
        gameManager.currentGame.gameRunning = false;
    }
    gameManager.currentGame = null;
    gameManager.gameState = 'menu';
    gameManager.showScreen('gameMenu');
}

// GameManagerのインスタンスを作成
let gameManager;

// ページが読み込まれたらゲームマネージャーを初期化
document.addEventListener('DOMContentLoaded', () => {
    gameManager = new GameManager();
});

// 追加のキーボードイベント
document.addEventListener('keydown', (e) => {
    if (gameManager && e.key === ' ' && gameManager.gameState === 'paused') {
        e.preventDefault();
        pauseGame();
    }
    if (gameManager && e.key === 'Escape') {
        if (gameManager.gameState === 'playing') {
            pauseGame();
        }
    }
});