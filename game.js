// --- Game Config ---
const GRID = 20;
const CELL = 20; // canvas 400 / 20
const INITIAL_SPEED = 150; // ms per tick
const SPEED_INCREMENT = 2; // ms faster per food eaten

// --- DOM ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlayMsg');

// --- State ---
let snake, direction, nextDirection, food, score, highScore, speed, timer, running, gameOver;

function init() {
  snake = [{ x: 10, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  speed = INITIAL_SPEED;
  running = false;
  gameOver = false;
  scoreEl.textContent = '0';
  highScore = parseInt(localStorage.getItem('snakeHigh') || '0', 10);
  highScoreEl.textContent = highScore;
  placeFood();
  draw();
  overlay.classList.remove('hidden');
  overlayMsg.textContent = '按 空格键 或点击开始';
}

// --- Food ---
function placeFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

// --- Drawing ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(canvas.width, i * CELL);
    ctx.stroke();
  }

  // Snake
  snake.forEach((seg, i) => {
    const ratio = 1 - i / snake.length;
    ctx.fillStyle = `rgba(0,255,255,${0.4 + 0.6 * ratio})`;
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = i === 0 ? 8 : 2;
    roundRect(seg.x * CELL, seg.y * CELL, CELL - 1, CELL - 1, 4);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Food
  ctx.fillStyle = '#e94560';
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// --- Game Loop ---
function tick() {
  direction = { ...nextDirection };
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // Wall collision
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return endGame();
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) return endGame();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem('snakeHigh', highScore);
    }
    speed = Math.max(50, speed - SPEED_INCREMENT);
    placeFood();
    restartTimer();
  } else {
    snake.pop();
  }

  draw();
}

function restartTimer() {
  clearInterval(timer);
  timer = setInterval(tick, speed);
}

function startGame() {
  if (gameOver) init();
  running = true;
  overlay.classList.add('hidden');
  restartTimer();
}

function pauseGame() {
  running = false;
  clearInterval(timer);
  overlay.classList.remove('hidden');
  overlayMsg.textContent = '暂停中 — 按空格继续';
}

function endGame() {
  running = false;
  gameOver = true;
  clearInterval(timer);
  overlay.classList.remove('hidden');
  overlayMsg.textContent = `游戏结束！得分: ${score}  按空格重新开始`;
}

// --- Input ---
const DIR_MAP = {
  ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
};

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!running) startGame(); else pauseGame();
    return;
  }
  const dir = DIR_MAP[e.code];
  if (dir && (dir.x + direction.x !== 0 || dir.y + direction.y !== 0)) {
    nextDirection = dir;
  }
});

canvas.addEventListener('click', () => {
  if (!running) startGame();
});

// Mobile controls
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  btn.addEventListener('click', () => {
    if (!running) { startGame(); return; }
    const dir = map[btn.dataset.dir];
    if (dir && (dir.x + direction.x !== 0 || dir.y + direction.y !== 0)) {
      nextDirection = dir;
    }
  });
});

// --- Start ---
init();
