// ゲーム状態
let gameState = {
    difficulty: 'medium',
    cards: [],
    flippedCards: [],
    matchedPairs: 0,
    moves: 0,
    timer: 0,
    timerInterval: null,
    isProcessing: false,
    startTime: null
};

// カードの絵柄（絵文字）
const cardSymbols = {
    easy: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍑'],
    medium: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'],
    hard: ['🎮', '⚽', '🎸', '🎨', '🎬', '📷', '🎯', '🎲', '🎪', '🎭', '🎺', '🎻', '🎹', '🎤', '🎧', '🎼', '🎵', '🎶']
};

// DOM要素
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const clearScreen = document.getElementById('clearScreen');
const cardBoard = document.getElementById('cardBoard');
const timerDisplay = document.getElementById('timer');
const movesDisplay = document.getElementById('moves');
const pairsDisplay = document.getElementById('pairs');

// スタート画面のボタン
const difficultyButtons = document.querySelectorAll('.difficulty-btn');
const startBtn = document.getElementById('startBtn');

// ゲーム画面のボタン
const restartBtn = document.getElementById('restartBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');

// クリア画面のボタン
const playAgainBtn = document.getElementById('playAgainBtn');
const changeDifficultyBtn = document.getElementById('changeDifficultyBtn');

// 初期化
function init() {
    // 難易度選択
    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            difficultyButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.difficulty = btn.dataset.level;
        });
    });

    // ボタンイベント
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    backToMenuBtn.addEventListener('click', showStartScreen);
    playAgainBtn.addEventListener('click', startGame);
    changeDifficultyBtn.addEventListener('click', showStartScreen);
}

// 画面切り替え
function showScreen(screen) {
    [startScreen, gameScreen, clearScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showStartScreen() {
    showScreen(startScreen);
    stopTimer();
}

// ゲーム開始
function startGame() {
    // 状態リセット
    gameState.cards = [];
    gameState.flippedCards = [];
    gameState.matchedPairs = 0;
    gameState.moves = 0;
    gameState.timer = 0;
    gameState.isProcessing = false;
    gameState.startTime = Date.now();

    // 表示更新
    updateDisplay();

    // カード生成
    createCards();

    // タイマー開始
    startTimer();

    // ゲーム画面表示
    showScreen(gameScreen);
}

// カード生成
function createCards() {
    const symbols = cardSymbols[gameState.difficulty];
    const gridSize = gameState.difficulty === 'hard' ? 6 : 4;
    const numPairs = gameState.difficulty === 'hard' ? 18 : 8;

    // カードペアを作成
    const selectedSymbols = symbols.slice(0, numPairs);
    const cardPairs = [...selectedSymbols, ...selectedSymbols];

    // シャッフル
    const shuffledCards = shuffle(cardPairs);

    // カードボードをクリア
    cardBoard.innerHTML = '';
    cardBoard.className = `card-board grid-${gridSize}x${gridSize}`;

    // カードを生成
    shuffledCards.forEach((symbol, index) => {
        const card = createCardElement(symbol, index);
        cardBoard.appendChild(card);
        gameState.cards.push({
            element: card,
            symbol: symbol,
            isFlipped: false,
            isMatched: false
        });
    });

    // ペア数表示更新
    pairsDisplay.textContent = `0/${numPairs}`;
}

// カード要素を作成
function createCardElement(symbol, index) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.index = index;

    const cardInner = document.createElement('div');
    cardInner.className = 'card-inner';

    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';

    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    cardFront.textContent = symbol;

    cardInner.appendChild(cardBack);
    cardInner.appendChild(cardFront);
    card.appendChild(cardInner);

    // クリックイベント
    card.addEventListener('click', () => handleCardClick(index));

    return card;
}

// カードクリック処理
function handleCardClick(index) {
    const card = gameState.cards[index];

    // クリック無効条件
    if (gameState.isProcessing ||
        card.isFlipped ||
        card.isMatched ||
        gameState.flippedCards.length >= 2) {
        return;
    }

    // カードをめくる
    flipCard(index);
    gameState.flippedCards.push(index);

    // 2枚めくった場合
    if (gameState.flippedCards.length === 2) {
        gameState.moves++;
        updateDisplay();
        checkMatch();
    }
}

// カードをめくる
function flipCard(index) {
    const card = gameState.cards[index];
    card.element.classList.add('flipped');
    card.isFlipped = true;
}

// カードを戻す
function unflipCard(index) {
    const card = gameState.cards[index];
    card.element.classList.remove('flipped');
    card.isFlipped = false;
}

// マッチ判定
function checkMatch() {
    gameState.isProcessing = true;

    const [index1, index2] = gameState.flippedCards;
    const card1 = gameState.cards[index1];
    const card2 = gameState.cards[index2];

    if (card1.symbol === card2.symbol) {
        // マッチ
        setTimeout(() => {
            card1.element.classList.add('matched');
            card2.element.classList.add('matched');
            card1.isMatched = true;
            card2.isMatched = true;

            gameState.matchedPairs++;
            updateDisplay();

            gameState.flippedCards = [];
            gameState.isProcessing = false;

            // 全てマッチしたかチェック
            const numPairs = gameState.difficulty === 'hard' ? 18 : 8;
            if (gameState.matchedPairs === numPairs) {
                setTimeout(() => {
                    gameComplete();
                }, 500);
            }
        }, 500);
    } else {
        // ミスマッチ
        setTimeout(() => {
            unflipCard(index1);
            unflipCard(index2);
            gameState.flippedCards = [];
            gameState.isProcessing = false;
        }, 1000);
    }
}

// 表示更新
function updateDisplay() {
    movesDisplay.textContent = gameState.moves;
    const numPairs = gameState.difficulty === 'hard' ? 18 : 8;
    pairsDisplay.textContent = `${gameState.matchedPairs}/${numPairs}`;
}

// タイマー開始
function startTimer() {
    stopTimer();
    gameState.timerInterval = setInterval(() => {
        gameState.timer++;
        const minutes = Math.floor(gameState.timer / 60);
        const seconds = gameState.timer % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// タイマー停止
function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

// ゲームクリア
function gameComplete() {
    stopTimer();

    // 結果表示
    const minutes = Math.floor(gameState.timer / 60);
    const seconds = gameState.timer % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('finalTime').textContent = timeStr;
    document.getElementById('finalMoves').textContent = gameState.moves;

    // スコア計算（時間と手数で計算）
    const numPairs = gameState.difficulty === 'hard' ? 18 : 8;
    const perfectMoves = numPairs; // 最小手数
    const timeBonus = Math.max(0, 300 - gameState.timer); // 5分以内のボーナス
    const movesPenalty = Math.max(0, (gameState.moves - perfectMoves) * 10);
    const score = Math.max(0, 1000 + timeBonus * 10 - movesPenalty);

    document.getElementById('finalScore').textContent = Math.floor(score);

    // 紙吹雪エフェクト
    createConfetti();

    // クリア画面表示
    showScreen(clearScreen);
}

// 配列シャッフル（Fisher-Yates）
function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 紙吹雪エフェクト
function createConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const numberOfPieces = 150;
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

    // 紙吹雪の生成
    for (let i = 0; i < numberOfPieces; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5,
            velocity: Math.random() * 3 + 2,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        pieces.forEach((piece, index) => {
            ctx.save();
            ctx.translate(piece.x, piece.y);
            ctx.rotate((piece.rotation * Math.PI) / 180);
            ctx.fillStyle = piece.color;
            ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
            ctx.restore();

            piece.y += piece.velocity;
            piece.rotation += piece.rotationSpeed;

            if (piece.y > canvas.height) {
                pieces.splice(index, 1);
            }
        });

        if (pieces.length > 0) {
            requestAnimationFrame(animate);
        } else {
            canvas.width = 0;
            canvas.height = 0;
        }
    }

    animate();
}

// 初期化実行
init();
