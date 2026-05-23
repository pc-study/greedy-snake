// ============================================================
//  GREEDY SNAKE — Enhanced Edition
// ============================================================

// --- Config ---
const GRID = 24;
const INITIAL_SPEED = 140;
const SPEED_INC = 2;
const CANVAS_SIZE = 480;
const CELL = CANVAS_SIZE / GRID;

// --- DOM ---
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const bgCvs   = document.getElementById('bgCanvas');
const bgCtx   = bgCvs.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl  = document.getElementById('highScore');
const lenEl   = document.getElementById('length');
const overlay = document.getElementById('overlay');
const startScreen    = document.getElementById('startScreen');
const pauseScreen    = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl   = document.getElementById('finalScore');
const newRecordEl    = document.getElementById('newRecord');

// --- Audio (Web Audio API — no external files) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function ensureAudio() { if (!audioCtx) audioCtx = new AudioCtx(); }

function playTone(freq, dur, type = 'square', vol = 0.08) {
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}

function sfxEat()   { playTone(880, 0.1, 'square', 0.06); setTimeout(() => playTone(1320, 0.12, 'square', 0.05), 60); }
function sfxDie()   { playTone(200, 0.3, 'sawtooth', 0.1); setTimeout(() => playTone(120, 0.4, 'sawtooth', 0.08), 150); }
function sfxStart() { playTone(660, 0.08); setTimeout(() => playTone(880, 0.08), 80); setTimeout(() => playTone(1100, 0.12), 160); }

// --- Particles ---
let particles = [];
function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      size: 2 + Math.random() * 3,
      color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// --- Background Stars ---
let stars = [];
function initBg() {
  bgCvs.width = window.innerWidth;
  bgCvs.height = window.innerHeight;
  stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * bgCvs.width,
      y: Math.random() * bgCvs.height,
      r: 0.3 + Math.random() * 1.2,
      a: Math.random(),
      da: 0.005 + Math.random() * 0.015,
    });
  }
}

function drawBg() {
  bgCtx.clearRect(0, 0, bgCvs.width, bgCvs.height);

  // Radial gradient center glow
  const grd = bgCtx.createRadialGradient(
    bgCvs.width / 2, bgCvs.height / 2, 0,
    bgCvs.width / 2, bgCvs.height / 2, bgCvs.width * 0.6
  );
  grd.addColorStop(0, 'rgba(0,229,255,0.03)');
  grd.addColorStop(0.5, 'rgba(124,77,255,0.015)');
  grd.addColorStop(1, 'transparent');
  bgCtx.fillStyle = grd;
  bgCtx.fillRect(0, 0, bgCvs.width, bgCvs.height);

  // Stars
  stars.forEach(s => {
    s.a += s.da;
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(s.a));
    bgCtx.fillStyle = `rgba(180,210,255,${alpha})`;
    bgCtx.beginPath();
    bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    bgCtx.fill();
  });
}

window.addEventListener('resize', initBg);
initBg();

// --- Food Animation ---
let foodPulse = 0;

// --- State ---
let snake, direction, nextDirection, food, score, highScore, speed, timer, running, gameOver;
let trail = []; // ghost trail for visual effect

function init() {
  snake = [{ x: 12, y: 12 }];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  speed = INITIAL_SPEED;
  running = false;
  gameOver = false;
  particles = [];
  trail = [];
  scoreEl.textContent = '0';
  lenEl.textContent = '1';
  highScore = parseInt(localStorage.getItem('snakeHigh2') || '0', 10);
  highEl.textContent = highScore;
  placeFood();
  draw();
  showScreen('start');
}

// --- Screens ---
function showScreen(name) {
  overlay.classList.remove('hidden');
  startScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  if (name === 'start')    startScreen.classList.remove('hidden');
  if (name === 'pause')    pauseScreen.classList.remove('hidden');
  if (name === 'gameover') gameOverScreen.classList.remove('hidden');
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
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawGrid();
  drawTrail();
  drawFood();
  drawSnake();
  drawParticles();
}

function drawGrid() {
  // Subtle dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      ctx.beginPath();
      ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTrail() {
  trail.forEach((t, i) => {
    ctx.save();
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = 'rgba(0,229,255,0.15)';
    roundRect(t.x * CELL + 1, t.y * CELL + 1, CELL - 2, CELL - 2, 5);
    ctx.fill();
    ctx.restore();
    t.alpha -= 0.02;
  });
  trail = trail.filter(t => t.alpha > 0);
}

function drawSnake() {
  const len = snake.length;
  snake.forEach((seg, i) => {
    const t = len > 1 ? i / (len - 1) : 0;
    // Gradient from cyan to purple along body
    const r = Math.round(0 + t * 124);
    const g = Math.round(229 - t * 152);
    const b = Math.round(255);
    const color = `rgb(${r},${g},${b})`;

    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = i === 0 ? 14 : 4;

    const padding = i === 0 ? 0.5 : 1;
    const radius = i === 0 ? 7 : 5;
    roundRect(
      seg.x * CELL + padding,
      seg.y * CELL + padding,
      CELL - padding * 2,
      CELL - padding * 2,
      radius
    );
    ctx.fill();

    // Head eyes
    if (i === 0) {
      drawEyes(seg);
    }
    ctx.restore();
  });
}

function drawEyes(head) {
  const cx = head.x * CELL + CELL / 2;
  const cy = head.y * CELL + CELL / 2;
  const d = direction;
  const eyeOff = 3;
  const eyeR = 2;

  let e1x, e1y, e2x, e2y;
  if (d.x === 1)       { e1x = cx+4; e1y = cy-eyeOff; e2x = cx+4; e2y = cy+eyeOff; }
  else if (d.x === -1) { e1x = cx-4; e1y = cy-eyeOff; e2x = cx-4; e2y = cy+eyeOff; }
  else if (d.y === -1) { e1x = cx-eyeOff; e1y = cy-4; e2x = cx+eyeOff; e2y = cy-4; }
  else                 { e1x = cx-eyeOff; e1y = cy+4; e2x = cx+eyeOff; e2y = cy+4; }

  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2); ctx.fill();

  // Pupils
  ctx.fillStyle = '#0a0e1a';
  ctx.beginPath(); ctx.arc(e1x + d.x * 0.8, e1y + d.y * 0.8, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(e2x + d.x * 0.8, e2y + d.y * 0.8, 1, 0, Math.PI * 2); ctx.fill();
}

function drawFood() {
  foodPulse += 0.06;
  const px = food.x * CELL + CELL / 2;
  const py = food.y * CELL + CELL / 2;
  const baseR = CELL / 2 - 3;
  const pulseR = baseR + Math.sin(foodPulse) * 1.5;

  // Outer glow
  const grd = ctx.createRadialGradient(px, py, 0, px, py, CELL);
  grd.addColorStop(0, 'rgba(255,45,117,0.2)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(food.x * CELL - CELL / 2, food.y * CELL - CELL / 2, CELL * 2, CELL * 2);

  // Apple body
  ctx.save();
  ctx.fillStyle = '#ff2d75';
  ctx.shadowColor = '#ff2d75';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(px, py, pulseR, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(px - 2, py - 2, pulseR * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Stem
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py - pulseR);
  ctx.quadraticCurveTo(px + 3, py - pulseR - 5, px + 5, py - pulseR - 3);
  ctx.stroke();
  ctx.restore();
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

// --- Score Pop Animation ---
function popScore(el) {
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 200);
}

// --- Game Loop ---
function tick() {
  direction = { ...nextDirection };
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // Wall collision
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { endGame(); return; }
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) { endGame(); return; }

  // Add trail from current tail
  if (snake.length > 1) {
    const tail = snake[snake.length - 1];
    trail.push({ x: tail.x, y: tail.y, alpha: 0.3 });
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreEl.textContent = score;
    lenEl.textContent = snake.length;
    popScore(scoreEl);
    sfxEat();

    if (score > highScore) {
      highScore = score;
      highEl.textContent = highScore;
      localStorage.setItem('snakeHigh2', highScore);
    }

    // Particles at food position
    const fpx = food.x * CELL + CELL / 2;
    const fpy = food.y * CELL + CELL / 2;
    spawnParticles(fpx, fpy, '#ff2d75', 15);
    spawnParticles(fpx, fpy, '#ffd700', 8);

    speed = Math.max(50, speed - SPEED_INC);
    placeFood();
    restartTimer();
  } else {
    snake.pop();
  }

  updateParticles();
  draw();
}

function restartTimer() {
  clearInterval(timer);
  timer = setInterval(tick, speed);
}

// --- Animation Frame for visuals when paused/idle ---
let animFrame;
function animLoop() {
  drawBg();
  if (!running) {
    // Keep food pulsing and particles alive on canvas even when not ticking
    updateParticles();
    draw();
  }
  animFrame = requestAnimationFrame(animLoop);
}
animLoop();

// --- Game Actions ---
function startGame() {
  if (gameOver) init();
  ensureAudio();
  sfxStart();
  running = true;
  overlay.classList.add('hidden');
  restartTimer();
}

function pauseGame() {
  running = false;
  clearInterval(timer);
  showScreen('pause');
}

function endGame() {
  running = false;
  gameOver = true;
  clearInterval(timer);
  sfxDie();

  // Death particles
  const hx = snake[0].x * CELL + CELL / 2;
  const hy = snake[0].y * CELL + CELL / 2;
  spawnParticles(hx, hy, '#ff2d75', 25);
  spawnParticles(hx, hy, '#00e5ff', 15);

  finalScoreEl.textContent = score;
  if (score > 0 && score >= highScore) {
    newRecordEl.classList.remove('hidden');
  } else {
    newRecordEl.classList.add('hidden');
  }
  showScreen('gameover');
}

// --- Input ---
const DIR_MAP = {
  ArrowUp:    { x:  0, y: -1 }, KeyW: { x:  0, y: -1 },
  ArrowDown:  { x:  0, y:  1 }, KeyS: { x:  0, y:  1 },
  ArrowLeft:  { x: -1, y:  0 }, KeyA: { x: -1, y:  0 },
  ArrowRight: { x:  1, y:  0 }, KeyD: { x:  1, y:  0 },
};

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameOver) { init(); startGame(); }
    else if (!running) startGame();
    else pauseGame();
    return;
  }
  const dir = DIR_MAP[e.code];
  if (dir && (dir.x + direction.x !== 0 || dir.y + direction.y !== 0)) {
    nextDirection = dir;
  }
});

// Button clicks
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', () => { init(); startGame(); });

canvas.addEventListener('click', () => {
  if (!running && !gameOver) startGame();
});

// Mobile D-pad
const dpadMap = { up: { x:0,y:-1 }, down: { x:0,y:1 }, left: { x:-1,y:0 }, right: { x:1,y:0 } };
document.querySelectorAll('.dpad-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!running && !gameOver) { startGame(); return; }
    if (!running) return;
    const dir = dpadMap[btn.dataset.dir];
    if (dir && (dir.x + direction.x !== 0 || dir.y + direction.y !== 0)) {
      nextDirection = dir;
    }
  });
});

// Prevent scrolling with arrow keys
window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
    e.preventDefault();
  }
}, { passive: false });

// --- Init ---
init();
