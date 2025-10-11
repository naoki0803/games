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
    drawState.canvas = document.getElementById('drawCanvas');
    drawState.ctx = drawState.canvas.getContext('2d');
    
    // キャンバスを白で塗りつぶす
    drawState.ctx.fillStyle = '#ffffff';
    drawState.ctx.fillRect(0, 0, drawState.canvas.width, drawState.canvas.height);
    
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
            drawState.ctx.fillStyle = '#ffffff';
            drawState.ctx.fillRect(0, 0, drawState.canvas.width, drawState.canvas.height);
        }
    });
    
    // 描画イベント（マウス）
    drawState.canvas.addEventListener('mousedown', startDrawing);
    drawState.canvas.addEventListener('mousemove', draw);
    drawState.canvas.addEventListener('mouseup', stopDrawing);
    drawState.canvas.addEventListener('mouseleave', stopDrawing);
    
    // 描画イベント（タッチ）
    drawState.canvas.addEventListener('touchstart', handleTouchStart);
    drawState.canvas.addEventListener('touchmove', handleTouchMove);
    drawState.canvas.addEventListener('touchend', stopDrawing);
    
    // 戻るボタン
    document.getElementById('drawBackBtn').addEventListener('click', () => {
        showScreen('start');
    });
    
    // 完了ボタン
    document.getElementById('drawDoneBtn').addEventListener('click', () => {
        gameState.imageSource = 'draw';
        gameState.imageData = drawState.canvas.toDataURL();
        showPreview();
    });
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

// キャンバスのリサイズ対応
window.addEventListener('resize', () => {
    if (drawState.canvas && gameState.currentScreen === 'draw') {
        // リサイズ時の処理（必要に応じて）
    }
});
