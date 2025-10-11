// ========================================
// グローバル変数
// ========================================
let gameState = {
    currentScreen: 'start',
    imageData: null,
    imageSource: null,
    tiles: [],
    emptyTile: { row: 4, col: 4 },
    moves: 0,
    startTime: null,
    timerInterval: null,
    isComplete: false
};

// ========================================
// 画面遷移
// ========================================
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const screen = document.getElementById(`${screenName}Screen`);
    if (screen) {
        screen.classList.add('active');
        gameState.currentScreen = screenName;
    }
}

// ========================================
// スタート画面
// ========================================
document.getElementById('drawModeBtn').addEventListener('click', () => {
    showScreen('draw');
    initDrawMode();
});

document.getElementById('uploadModeBtn').addEventListener('click', () => {
    document.getElementById('imageInput').click();
});

document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // ファイルサイズチェック（5MB以下）
        if (file.size > 5 * 1024 * 1024) {
            alert('ファイルサイズが大きすぎます。5MB以下の画像を選択してください。');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                gameState.imageSource = 'upload';
                processImage(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// ========================================
// 画像処理
// ========================================
function processImage(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 元画像のサイズ
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    // 正方形のサイズを決定（短い方の辺に合わせる）
    const size = Math.min(imgWidth, imgHeight);
    
    // 最大サイズを800x800に制限
    const maxSize = 800;
    const finalSize = Math.min(size, maxSize);
    
    canvas.width = finalSize;
    canvas.height = finalSize;
    
    // 元画像の中央から正方形を切り取る
    // ソース座標（元画像のどこから切り取るか）
    const sx = (imgWidth - size) / 2;  // 横方向の中央
    const sy = (imgHeight - size) / 2; // 縦方向の中央
    
    // 元画像の中央部分(size x size)をcanvas全体(finalSize x finalSize)に描画
    ctx.drawImage(
        img,           // ソース画像
        sx, sy,        // ソースの切り取り開始位置
        size, size,    // ソースの切り取りサイズ
        0, 0,          // canvas上の描画開始位置
        finalSize, finalSize  // canvas上の描画サイズ
    );
    
    gameState.imageData = canvas.toDataURL();
    showPreview();
}

function showPreview() {
    document.getElementById('previewImage').src = gameState.imageData;
    showScreen('preview');
}

// ========================================
// プレビュー画面
// ========================================
document.getElementById('previewBackBtn').addEventListener('click', () => {
    if (gameState.imageSource === 'draw') {
        showScreen('draw');
    } else {
        showScreen('start');
    }
});

document.getElementById('startGameBtn').addEventListener('click', () => {
    initGame();
});

// ========================================
// ゲーム初期化
// ========================================
function initGame() {
    showScreen('game');
    
    // タイルを初期化
    gameState.tiles = [];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            gameState.tiles.push({
                row: row,
                col: col,
                currentRow: row,
                currentCol: col
            });
        }
    }
    
    // 空白タイルは右下
    gameState.emptyTile = { row: 4, col: 4 };
    
    // DOMのレンダリングとレイアウト計算を待ってからパズルボードを作成
    // これにより.puzzle-boardのサイズが正しく計算された後にタイルが生成される
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // パズルボードを作成
            createPuzzleBoard();
            
            // シャッフル
            shufflePuzzle();
            
            // ゲーム状態をリセット
            gameState.moves = 0;
            gameState.isComplete = false;
            updateMoveCount();
            startTimer();
        });
    });
}

function createPuzzleBoard() {
    const board = document.getElementById('puzzleBoard');
    board.innerHTML = '';
    
    // パズルボードの高さを明示的に設定（aspect-ratioのフォールバック）
    const boardWidth = board.offsetWidth;
    if (boardWidth > 0) {
        board.style.height = `${boardWidth}px`;
    }
    
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement('div');
        tile.className = 'puzzle-tile';
        tile.dataset.index = i;
        
        const row = Math.floor(i / 5);
        const col = i % 5;
        
        if (row === 4 && col === 4) {
            tile.classList.add('empty');
        } else {
            // 背景画像の位置を設定
            tile.style.backgroundImage = `url(${gameState.imageData})`;
            tile.style.backgroundPosition = `${-col * 20}% ${-row * 20}%`;
        }
        
        tile.addEventListener('click', () => handleTileClick(row, col));
        
        // タッチイベント（スワイプ対応）
        let touchStartX, touchStartY;
        tile.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        tile.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
                handleSwipe(row, col, deltaX, deltaY);
            } else {
                handleTileClick(row, col);
            }
            
            touchStartX = null;
            touchStartY = null;
        });
        
        board.appendChild(tile);
    }
}

// ========================================
// パズルシャッフル
// ========================================
function shufflePuzzle() {
    // 完成状態から有効な移動を繰り返して、解決可能な配置を生成
    const moves = 200;
    let lastMove = null;
    
    for (let i = 0; i < moves; i++) {
        const possibleMoves = getValidMoves();
        
        // 直前の移動の逆を避ける（効率的なシャッフル）
        let validMoves = possibleMoves;
        if (lastMove) {
            validMoves = possibleMoves.filter(move => 
                !(move.row === lastMove.row && move.col === lastMove.col)
            );
        }
        
        if (validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            lastMove = { row: gameState.emptyTile.row, col: gameState.emptyTile.col };
            moveTile(randomMove.row, randomMove.col, true);
        }
    }
    
    // カウンターをリセット
    gameState.moves = 0;
    updateMoveCount();
}

function getValidMoves() {
    const moves = [];
    const { row, col } = gameState.emptyTile;
    
    // 上
    if (row > 0) moves.push({ row: row - 1, col: col });
    // 下
    if (row < 4) moves.push({ row: row + 1, col: col });
    // 左
    if (col > 0) moves.push({ row: row, col: col - 1 });
    // 右
    if (col < 4) moves.push({ row: row, col: col + 1 });
    
    return moves;
}

// ========================================
// タイル移動
// ========================================
function handleTileClick(row, col) {
    if (gameState.isComplete) return;
    
    const canMove = isAdjacent(row, col, gameState.emptyTile.row, gameState.emptyTile.col);
    if (canMove) {
        moveTile(row, col);
        checkCompletion();
    }
}

function handleSwipe(row, col, deltaX, deltaY) {
    if (gameState.isComplete) return;
    
    // スワイプ方向を判定
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // 横スワイプ
        if (deltaX > 0 && col > 0 && gameState.emptyTile.row === row && gameState.emptyTile.col === col - 1) {
            moveTile(row, col);
        } else if (deltaX < 0 && col < 4 && gameState.emptyTile.row === row && gameState.emptyTile.col === col + 1) {
            moveTile(row, col);
        }
    } else {
        // 縦スワイプ
        if (deltaY > 0 && row > 0 && gameState.emptyTile.col === col && gameState.emptyTile.row === row - 1) {
            moveTile(row, col);
        } else if (deltaY < 0 && row < 4 && gameState.emptyTile.col === col && gameState.emptyTile.row === row + 1) {
            moveTile(row, col);
        }
    }
    
    checkCompletion();
}

function isAdjacent(row1, col1, row2, col2) {
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

function moveTile(row, col, isShuffle = false) {
    const board = document.getElementById('puzzleBoard');
    const tileIndex = row * 5 + col;
    const emptyIndex = gameState.emptyTile.row * 5 + gameState.emptyTile.col;
    
    const tiles = board.children;
    const tile = tiles[tileIndex];
    const emptyTile = tiles[emptyIndex];
    
    // 背景とクラスを入れ替え
    const tempBg = tile.style.backgroundImage;
    const tempBgPos = tile.style.backgroundPosition;
    
    tile.style.backgroundImage = emptyTile.style.backgroundImage;
    tile.style.backgroundPosition = emptyTile.style.backgroundPosition;
    emptyTile.style.backgroundImage = tempBg;
    emptyTile.style.backgroundPosition = tempBgPos;
    
    // クラスを入れ替え
    tile.classList.add('empty');
    emptyTile.classList.remove('empty');
    
    // 空白タイルの位置を更新
    gameState.emptyTile = { row, col };
    
    // 移動回数をカウント（シャッフル時は除く）
    if (!isShuffle) {
        gameState.moves++;
        updateMoveCount();
    }
}

// ========================================
// 完成判定
// ========================================
function checkCompletion() {
    const board = document.getElementById('puzzleBoard');
    const tiles = board.children;
    
    // 空白タイルが右下にあるかチェック
    if (gameState.emptyTile.row !== 4 || gameState.emptyTile.col !== 4) {
        return false;
    }
    
    // 各タイルが正しい位置にあるかチェック
    for (let i = 0; i < 24; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const tile = tiles[i];
        
        const expectedBgPos = `${-col * 20}% ${-row * 20}%`;
        if (tile.style.backgroundPosition !== expectedBgPos) {
            return false;
        }
    }
    
    // 完成！
    gameState.isComplete = true;
    stopTimer();
    showCompletionEffect();
    
    setTimeout(() => {
        showCompletionScreen();
    }, 2000);
    
    return true;
}

// ========================================
// 完成エフェクト
// ========================================
function showCompletionEffect() {
    // 紙吹雪エフェクト
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confetti = [];
    const colors = ['#667eea', '#764ba2', '#48bb78', '#f6ad55', '#f56565', '#4299e1'];
    
    for (let i = 0; i < 100; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            rotation: Math.random() * 360
        });
    }
    
    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confetti.forEach((piece, index) => {
            ctx.save();
            ctx.translate(piece.x, piece.y);
            ctx.rotate(piece.rotation * Math.PI / 180);
            ctx.fillStyle = piece.color;
            ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
            ctx.restore();
            
            piece.y += piece.speedY;
            piece.x += piece.speedX;
            piece.rotation += 5;
            
            if (piece.y > canvas.height) {
                confetti.splice(index, 1);
            }
        });
        
        if (confetti.length > 0) {
            requestAnimationFrame(animateConfetti);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    animateConfetti();
}

function showCompletionScreen() {
    document.getElementById('finalMoves').textContent = gameState.moves;
    document.getElementById('finalTime').textContent = document.getElementById('timer').textContent;
    document.getElementById('completeImage').src = gameState.imageData;
    showScreen('complete');
}

// ========================================
// タイマー
// ========================================
function startTimer() {
    gameState.startTime = Date.now();
    gameState.timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (!gameState.startTime) return;
    
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('timer').textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function updateMoveCount() {
    document.getElementById('moveCount').textContent = gameState.moves;
}

// ========================================
// ゲームコントロール
// ========================================
document.getElementById('hintBtn').addEventListener('click', () => {
    document.getElementById('hintImage').src = gameState.imageData;
    document.getElementById('hintModal').classList.add('active');
});

document.getElementById('closeHintBtn').addEventListener('click', () => {
    document.getElementById('hintModal').classList.remove('active');
});

document.getElementById('hintModal').addEventListener('click', (e) => {
    if (e.target.id === 'hintModal') {
        document.getElementById('hintModal').classList.remove('active');
    }
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('パズルをリセットしますか？')) {
        initGame();
    }
});

document.getElementById('giveUpBtn').addEventListener('click', () => {
    if (confirm('諦めて正解を表示しますか？')) {
        stopTimer();
        gameState.isComplete = true;
        showCompletionScreen();
    }
});

// ========================================
// 完成画面
// ========================================
document.getElementById('playAgainBtn').addEventListener('click', () => {
    initGame();
});

document.getElementById('newImageBtn').addEventListener('click', () => {
    // 状態をリセット
    gameState = {
        currentScreen: 'start',
        imageData: null,
        imageSource: null,
        tiles: [],
        emptyTile: { row: 4, col: 4 },
        moves: 0,
        startTime: null,
        timerInterval: null,
        isComplete: false
    };
    
    showScreen('start');
});

// ========================================
// Service Worker登録（PWA対応）
// ========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('Service Worker登録成功:', registration.scope);
            })
            .catch((error) => {
                console.log('Service Worker登録失敗:', error);
            });
    });
}

// ========================================
// 初期化
// ========================================
window.addEventListener('load', () => {
    showScreen('start');
});

// ページ離脱時の確認
window.addEventListener('beforeunload', (e) => {
    if (gameState.currentScreen === 'game' && !gameState.isComplete) {
        e.preventDefault();
        e.returnValue = '';
    }
});
