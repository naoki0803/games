// ========================================
// 手描きモード
// ========================================

let drawState = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    isEraser: false,
    penSize: 10,
    penColor: '#000000',
    lastX: 0,
    lastY: 0
};

function initDrawMode() {
    if (!drawState.canvas) {
        drawState.canvas = document.getElementById('drawCanvas');
        drawState.ctx = drawState.canvas.getContext('2d');
    }
    
    // キャンバスを白で塗りつぶす
    drawState.ctx.fillStyle = '#ffffff';
    drawState.ctx.fillRect(0, 0, drawState.canvas.width, drawState.canvas.height);
    
    // 消しゴムモードをリセット
    drawState.isEraser = false;
    const eraserBtn = document.getElementById('eraserBtn');
    eraserBtn.style.background = '';
    eraserBtn.style.color = '';
}

// ページロード完了時またはDOMContentLoaded時にイベントリスナーを登録
function setupDrawListeners() {
    const canvas = document.getElementById('drawCanvas');
    if (!canvas) {
        console.error('drawCanvas not found');
        return;
    }
    const ctx = canvas.getContext('2d');
    
    // ペンサイズスライダー
    const penSizeInput = document.getElementById('penSize');
    const penSizeValue = document.getElementById('penSizeValue');
    
    penSizeInput.addEventListener('input', (e) => {
        drawState.penSize = parseInt(e.target.value);
        penSizeValue.textContent = drawState.penSize;
    });
    
    // ペンカラー
    const penColorInput = document.getElementById('penColor');
    penColorInput.addEventListener('change', (e) => {
        drawState.penColor = e.target.value;
        drawState.isEraser = false;
    });
    
    // 消しゴムボタン
    document.getElementById('eraserBtn').addEventListener('click', () => {
        drawState.isEraser = !drawState.isEraser;
        const btn = document.getElementById('eraserBtn');
        if (drawState.isEraser) {
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        } else {
            btn.style.background = '';
            btn.style.color = '';
        }
    });
    
    // 全消去ボタン
    document.getElementById('clearCanvasBtn').addEventListener('click', () => {
        if (confirm('キャンバスを全消去しますか？')) {
            if (!drawState.ctx) {
                drawState.canvas = document.getElementById('drawCanvas');
                drawState.ctx = drawState.canvas.getContext('2d');
            }
            drawState.ctx.fillStyle = '#ffffff';
            drawState.ctx.fillRect(0, 0, drawState.canvas.width, drawState.canvas.height);
        }
    });
    
    // 描画イベント（マウス）
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // 描画イベント（タッチ）
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // 戻るボタン
    document.getElementById('drawBackBtn').addEventListener('click', () => {
        showScreen('start');
    });
    
    // 完了ボタン
    document.getElementById('drawDoneBtn').addEventListener('click', () => {
        if (!drawState.canvas) {
            drawState.canvas = document.getElementById('drawCanvas');
        }
        gameState.imageSource = 'draw';
        gameState.imageData = drawState.canvas.toDataURL();
        console.log('手描きデータを保存:', gameState.imageData.substring(0, 50) + '...');
        showPreview();
    });
}

// ページロード時に実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDrawListeners);
} else {
    setupDrawListeners();
}

function startDrawing(e) {
    drawState.isDrawing = true;
    const rect = drawState.canvas.getBoundingClientRect();
    const scaleX = drawState.canvas.width / rect.width;
    const scaleY = drawState.canvas.height / rect.height;
    
    drawState.lastX = (e.clientX - rect.left) * scaleX;
    drawState.lastY = (e.clientY - rect.top) * scaleY;
}

function draw(e) {
    if (!drawState.isDrawing) return;
    
    const rect = drawState.canvas.getBoundingClientRect();
    const scaleX = drawState.canvas.width / rect.width;
    const scaleY = drawState.canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    drawLine(drawState.lastX, drawState.lastY, x, y);
    
    drawState.lastX = x;
    drawState.lastY = y;
}

function handleTouchStart(e) {
    e.preventDefault();
    drawState.isDrawing = true;
    
    const rect = drawState.canvas.getBoundingClientRect();
    const scaleX = drawState.canvas.width / rect.width;
    const scaleY = drawState.canvas.height / rect.height;
    
    const touch = e.touches[0];
    drawState.lastX = (touch.clientX - rect.left) * scaleX;
    drawState.lastY = (touch.clientY - rect.top) * scaleY;
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!drawState.isDrawing) return;
    
    const rect = drawState.canvas.getBoundingClientRect();
    const scaleX = drawState.canvas.width / rect.width;
    const scaleY = drawState.canvas.height / rect.height;
    
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    drawLine(drawState.lastX, drawState.lastY, x, y);
    
    drawState.lastX = x;
    drawState.lastY = y;
}

function stopDrawing() {
    drawState.isDrawing = false;
}

function drawLine(x1, y1, x2, y2) {
    drawState.ctx.beginPath();
    drawState.ctx.moveTo(x1, y1);
    drawState.ctx.lineTo(x2, y2);
    
    if (drawState.isEraser) {
        drawState.ctx.strokeStyle = '#ffffff';
        drawState.ctx.lineWidth = drawState.penSize * 2;
    } else {
        drawState.ctx.strokeStyle = drawState.penColor;
        drawState.ctx.lineWidth = drawState.penSize;
    }
    
    drawState.ctx.lineCap = 'round';
    drawState.ctx.lineJoin = 'round';
    drawState.ctx.stroke();
}

// キャンバスのリサイズ対応（既に登録されている場合は重複しないように）
if (!window.drawResizeListenerAdded) {
    window.addEventListener('resize', () => {
        if (drawState.canvas && gameState.currentScreen === 'draw') {
            // リサイズ時の処理（必要に応じて）
        }
    });
    window.drawResizeListenerAdded = true;
}
