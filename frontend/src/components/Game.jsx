import { useEffect, useRef, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './Game.css';

// Seeded PRNG Helpers
function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

function sfc32(a, b, c, d) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

// GROUND_Y is the top of the ground surface.
const GROUND_Y = 350;
const GY = GROUND_Y;

// Helper: build a gap pattern
const gap    = (x, w=130)     => [{type:'gap',      x, y:GY,       width:w,  height:100}];
const box    = (x, h=30)      => [{type:'box',      x, y:GY-h,     width:50, height:h}];
const tbox   = (x, h=70)      => [{type:'tall_box', x, y:GY-h,     width:50, height:h}];
const spike  = (x)            => [{type:'spike',    x, y:GY-30,    width:30, height:30}];
const pipe   = (x)            => [{type:'pipe',     x, y:GY-70,    width:44, height:70}];
const goomba = (x)            => [{type:'goomba',   x, y:GY-34,    width:34, height:34, speed:1}];
const turtle = (x)            => [{type:'turtle',   x, y:GY-28,    width:36, height:28, alive:true}];
const piston = (x)            => [{type:'piston',   x, y:GY-90,    width:44, height:90}];
const spring = (x)            => [{type:'spring_pad',x,y:GY-14,   width:40, height:14}];
const shield = (x)            => [{type:'shield',   x, y:GY-90,    width:26, height:26, collected:false}];
const bill   = (x, yOff=100)  => [{type:'bullet_bill',x,y:GY-yOff, width:48, height:28, speed:3}];
const stairs = (x) => [
  {type:'box',      x: x,      y:GY-30,  width:50, height:30,  isStair:true},
  {type:'tall_box', x: x+50,   y:GY-60,  width:50, height:60,  isStair:true},
  {type:'tall_box', x: x+100,  y:GY-90,  width:50, height:90,  isStair:true},
];
const platJump = (x) => [
  {type:'gap',  x: x,      y:GY,       width:300, height:100},
  {type:'box',  x: x,      y:GY-80,    width:60,  height:20},
  {type:'box',  x: x+110,  y:GY-120,   width:60,  height:20},
  {type:'box',  x: x+220,  y:GY-80,    width:60,  height:20},
];
const dSpike = (x) => [
  {type:'spike', x: x,     y:GY-30, width:30, height:30},
  {type:'spike', x: x+34,  y:GY-30, width:30, height:30},
];
const triSpike = (x) => [
  {type:'spike', x: x,     y:GY-30, width:28, height:30},
  {type:'spike', x: x+32,  y:GY-30, width:28, height:30},
  {type:'spike', x: x+64,  y:GY-30, width:28, height:30},
];
const lowBar = (x) => [
  {type:'tall_box', x: x,    y:GY-80, width:40, height:80},
  {type:'tall_box', x: x+60, y:GY-80, width:40, height:80},
];

// Level speed configs
const LEVEL_SPEEDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9];

// =====================================================================
// FIXED MARIO-STYLE LEVEL LAYOUTS
// Each entry: array of obstacle objects with world-x position.
// Level ends when worldX >= levelLength.
// =====================================================================
const makeLevelObstacles = (id) => {
  const s = LEVEL_SPEEDS[id-1] || 5;
  // helper: attach default speed
  const spd = (arr) => arr.map(o => ({ speed: s, phase: 0, ...o }));

  const layouts = {
    1: spd([
      ...box(500),  ...box(700),  ...box(900,40),
      ...spike(1100),...spike(1200),
      ...box(1400), ...box(1500), ...box(1600),
      ...gap(1800, 120),
      ...box(2000), ...box(2100,50), ...box(2200),
      ...stairs(2400),
      ...spike(2700), ...spike(2800), ...spike(2900),
      ...box(3100), ...box(3200),
      ...gap(3400, 100),
      [{type:'end_flag', x:3700, y:GY-80, width:20, height:80}],
    ].flat()),
    2: spd([
      ...spike(400),
      ...box(600),  ...box(750,50), ...box(900),
      ...dSpike(1100),
      ...gap(1350, 130), ...goomba(1550),
      ...stairs(1800),
      ...pipe(2100), ...turtle(2300), ...turtle(2500),
      ...lowBar(2700),
      ...gap(2950, 120), ...shield(3050),
      ...triSpike(3300),
      ...box(3600), ...box(3700), ...box(3800),
      [{type:'end_flag', x:4100, y:GY-80, width:20, height:80}],
    ].flat()),
    3: spd([
      ...dSpike(350), ...box(550,40),
      ...gap(750, 100), ...spring(900),
      ...piston(1100), ...spike(1250),
      ...turtle(1400), ...turtle(1550),
      ...platJump(1750),
      ...stairs(2150), ...spike(2350), ...spike(2400),
      ...pipe(2600), ...goomba(2750),
      ...lowBar(2950), ...shield(3050),
      ...triSpike(3200), ...box(3450,60),
      ...gap(3650, 140), ...spring(3820),
      ...turtle(4000), ...turtle(4100), ...turtle(4200),
      [{type:'end_flag', x:4500, y:GY-80, width:20, height:80}],
    ].flat()),
    4: spd([
      ...spike(300), ...spike(400), ...box(600,50),
      ...turtle(800), ...turtle(950),
      ...gap(1100, 130), ...spring(1270),
      ...piston(1450), ...dSpike(1620),
      ...platJump(1850), ...shield(2050),
      ...stairs(2300), ...goomba(2550),
      ...triSpike(2750), ...pipe(2950),
      ...lowBar(3150), ...turtle(3300), ...turtle(3400),
      ...gap(3600, 150),
      ...bill(3850), ...box(4050),
      ...piston(4250), ...spike(4400), ...spike(4450),
      [{type:'end_flag', x:4800, y:GY-80, width:20, height:80}],
    ].flat()),
    5: spd([
      ...triSpike(300), ...turtle(520), ...gap(700, 130),
      ...spring(880), ...piston(1050), ...piston(1200),
      ...platJump(1400), ...shield(1600),
      ...stairs(1850), ...goomba(2100), ...turtle(2250),
      ...dSpike(2450), ...dSpike(2550),
      ...pipe(2750), ...lowBar(2950),
      ...gap(3150, 160), ...bill(3350, 110),
      ...triSpike(3600), ...box(3800,60),
      ...turtle(4000), ...turtle(4100), ...turtle(4200),
      ...piston(4400), ...gap(4600, 130),
      [{type:'end_flag', x:4900, y:GY-80, width:20, height:80}],
    ].flat()),
  };

  // Levels 6-10: reuse level 5 pattern scaled for difficulty
  if (!layouts[id]) {
    const base = layouts[5].map(o => ({ ...o, x: o.x * 1.2, speed: s }));
    base.push({ type:'end_flag', x: base[base.length-1].x + 300, y:GY-80, width:20, height:80, speed:s });
    return base;
  }
  return layouts[id];
};

// Level configs (speed + visual target)
const LEVEL_CONFIG = [
  { id:1,  baseSpeed:4,   levelLength:3800 },
  { id:2,  baseSpeed:4.5, levelLength:4200 },
  { id:3,  baseSpeed:5,   levelLength:4600 },
  { id:4,  baseSpeed:5.5, levelLength:4900 },
  { id:5,  baseSpeed:6,   levelLength:5000 },
  { id:6,  baseSpeed:6.5, levelLength:5200 },
  { id:7,  baseSpeed:7,   levelLength:5400 },
  { id:8,  baseSpeed:7.5, levelLength:5600 },
  { id:9,  baseSpeed:8,   levelLength:5800 },
  { id:10, baseSpeed:9,   levelLength:6000 },
];

function getRandomObstacleType() { return 'box'; } // kept for compat, unused


function Game() {
  const canvasRef = useRef(null);
  const { user, token } = useContext(AuthContext);
  
  const [gameState, setGameState] = useState('START_MENU'); 
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [unlockedLevel, setUnlockedLevel] = useState(1);
  const [savingScore, setSavingScore] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  // Audio Context Ref
  const audioCtx = useRef(null);

  // Background Image Ref — no longer used, we draw background on canvas
  // bgImageRef kept as null to avoid breaking any stale refs
  const bgImageRef = useRef(null);

  const initAudio = () => {
    if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.current.state === 'suspended') {
        audioCtx.current.resume();
    }
  };

  const playJump = () => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, audioCtx.current.currentTime);
    osc.frequency.linearRampToValueAtTime(400, audioCtx.current.currentTime + 0.15);
    gain.gain.setValueAtTime(0.05, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.current.currentTime + 0.2);
  };

  const playCoin = () => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.current.currentTime);
    osc.frequency.setValueAtTime(1200, audioCtx.current.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.current.currentTime + 0.2);
  };

  const playHit = () => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.current.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.current.currentTime + 0.3);
  };

  const playWin = () => {
    if (!audioCtx.current) return;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
        setTimeout(() => {
           if (!audioCtx.current) return;
           const osc = audioCtx.current.createOscillator();
           const gain = audioCtx.current.createGain();
           osc.connect(gain);
           gain.connect(audioCtx.current.destination);
           osc.type = 'triangle';
           osc.frequency.value = freq;
           gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
           gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.3);
           osc.start();
           osc.stop(audioCtx.current.currentTime + 0.3);
        }, i * 100);
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('polyDashUnlockedLevel');
    if (saved) {
      setUnlockedLevel(parseInt(saved, 10));
    }
  }, []);

  const saveUnlockedLevel = (level) => {
    setUnlockedLevel(level);
    localStorage.setItem('polyDashUnlockedLevel', level.toString());
  };

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    
    // Physics constants — higher gravity + stronger jump = snappy fast arc
    const GRAVITY = 0.9;
    const JUMP_POWER = -17;
    const PLAYER_SIZE = 30;

    let player = { 
        x: 100, y: GROUND_Y - PLAYER_SIZE, size: PLAYER_SIZE,
        velocityY: 0, gravity: GRAVITY, jumpPower: JUMP_POWER,
        isGrounded: true, rotation: 0,
        hasShield: false,
        scaleY: 1, scaleX: 1
    };
    let obstacles = [];
    let particles = [];
    let playerLasers = []; // Lasers fired by the player with F key
    let frameCount = 0;
    let worldX = 0;        // Total world distance scrolled (for layout spawning)
    let nextObstacleIdx = 0; // Pointer into the level layout array
    let currentScore = 0;
    let bgScrollX = 0;
    let lastTime = null;
    
    const config = LEVEL_CONFIG.find(l => l.id === currentLevel) || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
    // Load the fixed level layout — obstacles sorted by ascending world-x
    const levelLayout = makeLevelObstacles(currentLevel).sort((a,b) => a.x - b.x);
    let isGameOver = false;
    let isLevelComplete = false;

    const handleKeyDown = (e) => {
      if (['Space', 'ArrowUp'].includes(e.code)) {
        e.preventDefault();
      }
      if ((e.code === 'Space' || e.code === 'ArrowUp') && player.isGrounded) {
        player.velocityY = player.jumpPower;
        player.isGrounded = false;
        player.scaleX = 0.8; player.scaleY = 1.3;
        spawnParticles(player.x + 15, player.y + player.size, 10, '#fde047', -2, 2, -3, 0);
        playJump();
      }
      // F key fires a player laser
      if (e.code === 'KeyF') {
        e.preventDefault();
        playerLasers.push({
          x: player.x + player.size,
          y: player.y + player.size / 2 - 3,
          width: 40,
          height: 6,
          speed: 14,
          life: 1.0
        });
        // Laser fire sound (high-pitched blip)
        if (audioCtx.current) {
          const osc = audioCtx.current.createOscillator();
          const g = audioCtx.current.createGain();
          osc.connect(g); g.connect(audioCtx.current.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(800, audioCtx.current.currentTime);
          osc.frequency.linearRampToValueAtTime(400, audioCtx.current.currentTime + 0.08);
          g.gain.setValueAtTime(0.08, audioCtx.current.currentTime);
          g.gain.linearRampToValueAtTime(0, audioCtx.current.currentTime + 0.1);
          osc.start(); osc.stop(audioCtx.current.currentTime + 0.1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    // Handle touch/click jump — use 'click' not 'mousedown' to prevent drag-firing
    let isDragging = false;
    const handleMousedown = () => { isDragging = false; };
    const handleMousemove = () => { isDragging = true; };
    const handleClick = (e) => {
      if (isDragging) return; // ignore drag releases
      e.preventDefault();
      doJump();
    };
    const handleTouch = (e) => {
      e.preventDefault();
      doJump();
    };
    const doJump = () => {
      if (player.isGrounded) {
        player.velocityY = player.jumpPower;
        player.isGrounded = false;
        player.scaleX = 0.8; player.scaleY = 1.3;
        spawnParticles(player.x + 15, player.y + player.size, 10, '#fde047', -2, 2, -3, 0);
        playJump();
      }
    };
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('mousedown', handleMousedown);
    canvas.addEventListener('mousemove', handleMousemove);
    canvas.addEventListener('click', handleClick);

    const roundRect = (ctx, x, y, width, height, radius) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    const spawnParticles = (x, y, count, color, vxMin, vxMax, vyMin, vyMax, lifespanDecay = 0.05) => {
      for(let i=0; i<count; i++) {
        particles.push({
          x, y, color, size: Math.random() * 6 + 2,
          vx: Math.random() * (vxMax - vxMin) + vxMin,
          vy: Math.random() * (vyMax - vyMin) + vyMin,
          life: 1, decay: lifespanDecay + Math.random() * 0.03
        });
      }
    };

    const gameLoop = (timestamp) => {
      if (isGameOver || isLevelComplete) return;

      // Delta-time: cap at 50ms (20fps min) to prevent spiral of death after tab switch
      if (lastTime === null) lastTime = timestamp;
      const rawDt = timestamp - lastTime;
      lastTime = timestamp;
      const dt = Math.min(rawDt, 50) / (1000 / 60); // normalise to 60fps = 1.0

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Drawn Sky Background — beautiful gradient sky + animated clouds
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, '#1e3a8a');   // deep midnight blue
      skyGrad.addColorStop(0.45, '#3b82f6'); // mid sky blue
      skyGrad.addColorStop(1, '#93c5fd');   // horizon light blue
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, GROUND_Y);

      // Sun
      ctx.save();
      ctx.shadowColor = '#fde047'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(700, 55, 38, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Clouds (parallax scroll at half speed)
      const cloudScroll = ((-bgScrollX) * 0.18) % canvas.width;
      const drawCloud = (cx, cy, scale) => {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(cx, cy, 28 * scale, 0, Math.PI * 2);
          ctx.arc(cx + 32 * scale, cy - 10 * scale, 36 * scale, 0, Math.PI * 2);
          ctx.arc(cx + 68 * scale, cy, 28 * scale, 0, Math.PI * 2);
          ctx.fill();
      };
      // Draw two sets for seamless wrapping
      [0, canvas.width].forEach(offset => {
          drawCloud((cloudScroll + offset + 60)  % (canvas.width + 200) - 100, 60,  1.0);
          drawCloud((cloudScroll + offset + 300) % (canvas.width + 200) - 100, 40,  0.7);
          drawCloud((cloudScroll + offset + 520) % (canvas.width + 200) - 100, 80,  0.85);
          drawCloud((cloudScroll + offset + 650) % (canvas.width + 200) - 100, 30,  0.5);
      });

      // Distant pink mountains silhouette
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      const mScroll = ((-bgScrollX) * 0.1) % canvas.width;
      ctx.beginPath();
      ctx.moveTo(mScroll - 40, GROUND_Y);
      ctx.lineTo(mScroll + 60, GROUND_Y - 100); ctx.lineTo(mScroll + 140, GROUND_Y - 60);
      ctx.lineTo(mScroll + 220, GROUND_Y - 130); ctx.lineTo(mScroll + 320, GROUND_Y - 55);
      ctx.lineTo(mScroll + 400, GROUND_Y - 110); ctx.lineTo(mScroll + 500, GROUND_Y - 70);
      ctx.lineTo(mScroll + 600, GROUND_Y - 120); ctx.lineTo(mScroll + 700, GROUND_Y - 50);
      ctx.lineTo(mScroll + 840, GROUND_Y - 90); ctx.lineTo(mScroll + 940, GROUND_Y);
      ctx.closePath(); ctx.fill();
      // Second offset set for loop
      ctx.beginPath();
      ctx.moveTo(mScroll + canvas.width - 40, GROUND_Y);
      ctx.lineTo(mScroll + canvas.width + 60, GROUND_Y - 100); ctx.lineTo(mScroll + canvas.width + 140, GROUND_Y - 60);
      ctx.lineTo(mScroll + canvas.width + 220, GROUND_Y - 130); ctx.lineTo(mScroll + canvas.width + 320, GROUND_Y - 55);
      ctx.lineTo(mScroll + canvas.width + 400, GROUND_Y - 110); ctx.lineTo(mScroll + canvas.width + 500, GROUND_Y - 70);
      ctx.lineTo(mScroll + canvas.width + 600, GROUND_Y - 120); ctx.lineTo(mScroll + canvas.width + 940, GROUND_Y);
      ctx.closePath(); ctx.fill();

      bgScrollX -= (config.baseSpeed * 0.8 * dt);

      let prevY = player.y;
      const prevGrounded = player.isGrounded;

      // Player physics — all multiplied by dt for frame-rate independence
      player.velocityY += player.gravity * dt;
      player.y += player.velocityY * dt;
      
      // Squash & Stretch recovery
      player.scaleX += (1 - player.scaleX) * 0.2;
      player.scaleY += (1 - player.scaleY) * 0.2;

      // Trail particles (every other frame)
      if (frameCount % 2 === 0 && !isGameOver) {
          spawnParticles(player.x + 10, player.y + 15, 1, '#fef08a', -config.baseSpeed*0.4, 0, -0.5, 0.5, 0.07);
      }
      
      if (!player.isGrounded) {
         player.rotation += 7 * dt; 
      } else {
         let target = Math.round(player.rotation / 90) * 90;
         player.rotation += (target - player.rotation) * 0.25;
      }

      // ===== FIXED LEVEL LAYOUT SPAWNING =====
      // WorldX advances each frame — same as total pixels scrolled.
      worldX += config.baseSpeed * dt;
      bgScrollX -= (config.baseSpeed * 0.8 * dt);

      // Spawn layout obstacles as they enter the right viewport edge
      while (nextObstacleIdx < levelLayout.length) {
        const template = levelLayout[nextObstacleIdx];
        const spawnThreshold = template.x - canvas.width; // world-x at which it appears on screen right
        if (worldX < spawnThreshold) break; // not yet
        const screenX = template.x - worldX + canvas.width;
        const obs = { ...template, x: screenX };
        if (obs.speed === undefined || obs.speed === 0) obs.speed = config.baseSpeed;
        if (obs.phase === undefined) obs.phase = frameCount;
        obstacles.push(obs);
        nextObstacleIdx++;
      }

      // Level complete when world passes levelLength
      if (worldX >= config.levelLength && !isLevelComplete) {
        isLevelComplete = true;
        playWin();
        setScore(currentScore);
        if (currentLevel >= unlockedLevel && currentLevel < LEVEL_CONFIG.length)
          saveUnlockedLevel(currentLevel + 1);
        setGameState('LEVEL_COMPLETE');
      }

      // Draw ground with gaps
      let overGap = false;
      let groundSlices = [{x: 0, w: canvas.width}];
      
      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        if (obs.type === 'gap') {
          // Fall if player centre is within the gap interior
          const px_center = player.x + player.size / 2;
          if (px_center >= obs.x + 8 && px_center <= obs.x + obs.width - 8) {
              overGap = true;
          }
          let newSlices = [];
          for (let slice of groundSlices) {
             const gapEnd = obs.x + obs.width;
             if (obs.x > slice.x && obs.x < slice.x + slice.w) {
                newSlices.push({x: slice.x, w: obs.x - slice.x});
                if (gapEnd < slice.x + slice.w)
                    newSlices.push({x: gapEnd, w: (slice.x + slice.w) - gapEnd});
             } else if (obs.x <= slice.x && gapEnd > slice.x) {
                const diff = gapEnd - slice.x;
                if (slice.w - diff > 0)
                    newSlices.push({x: gapEnd, w: slice.w - diff});
             } else {
                newSlices.push(slice);
             }
          }
          groundSlices = newSlices;
        }
      }

      for (let slice of groundSlices) {
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(slice.x, GROUND_Y, slice.w, 10);
          ctx.fillStyle = '#166534';
          ctx.fillRect(slice.x, GROUND_Y + 10, slice.w, 4);
          let dirtGrad = ctx.createLinearGradient(0, GROUND_Y + 14, 0, canvas.height);
          dirtGrad.addColorStop(0, '#b45309');
          dirtGrad.addColorStop(1, '#78350f');
          ctx.fillStyle = dirtGrad;
          ctx.fillRect(slice.x, GROUND_Y + 14, slice.w, canvas.height - (GROUND_Y + 14));
          // Scrolling dirt detail
          const detailX = (((-bgScrollX) * 0.5) % 160 + 160) % 160;
          ctx.fillStyle = 'rgba(69,26,3,0.5)';
          ctx.fillRect(slice.x + detailX, GROUND_Y + 20, 10, 3);
      }

      // Draw and update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      let isOnBlock = false;

      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= obs.speed * dt;

        if (obs.type === 'gap') continue;

        // === TURTLE ENEMY ===
        if (obs.type === 'turtle') {
          if (!obs.alive) continue;
          const tw = obs.width; const th = obs.height;
          const tx = obs.x;    const ty = obs.y;
          const walkCycle = Math.floor(frameCount / 8) % 2;

          ctx.save();
          // Shell (dark green oval)
          ctx.fillStyle = '#15803d';
          ctx.beginPath(); ctx.ellipse(tx + tw/2, ty + th/2 - 2, tw/2 - 2, th/2 - 3, 0, 0, Math.PI*2); ctx.fill();
          // Shell highlight
          ctx.fillStyle = '#4ade80';
          ctx.beginPath(); ctx.ellipse(tx + tw/2 - 3, ty + th/2 - 6, (tw/2 - 4)*0.55, (th/2 - 5)*0.5, -0.3, 0, Math.PI*2); ctx.fill();
          // Shell cross-lines
          ctx.strokeStyle = '#166534'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(tx + tw/2, ty+4); ctx.lineTo(tx + tw/2, ty + th - 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tx+4, ty+th/2-2); ctx.lineTo(tx+tw-4, ty+th/2-2); ctx.stroke();
          // Head (yellow-green)
          ctx.fillStyle = '#a3e635';
          ctx.beginPath(); ctx.ellipse(tx - 2, ty + th/2 - 4, 7, 6, 0.3, 0, Math.PI*2); ctx.fill();
          // Eye
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(tx - 4, ty + th/2 - 6, 2, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx - 3.5, ty + th/2 - 6.5, 0.7, 0, Math.PI*2); ctx.fill();
          // Legs (animated)
          ctx.fillStyle = '#a3e635';
          if (walkCycle === 0) {
            ctx.fillRect(tx + 4, ty + th - 6, 8, 7);
            ctx.fillRect(tx + tw - 14, ty + th - 6, 8, 7);
          } else {
            ctx.fillRect(tx + 8, ty + th - 4, 8, 5);
            ctx.fillRect(tx + tw - 18, ty + th - 4, 8, 5);
          }
          ctx.restore();

          // Turtle-player collision (kill if not shot)
          if (player.x + player.size - 3 > tx && player.x + 3 < tx + tw &&
              player.y + player.size > ty + 4 && player.y < ty + th) {
            if (player.hasShield) {
              player.hasShield = false; obs.alive = false;
              spawnParticles(tx + tw/2, ty + th/2, 20, '#4ade80', -4,4,-4,4, 0.04);
              playHit();
            } else {
              playHit(); isGameOver = true; setScore(currentScore); setGameState('GAME_OVER');
            }
          }
          continue;
        }

        if (obs.type === 'shield') {
          if (obs.collected) continue;
          ctx.save();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
          ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.arc(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/4, 0, Math.PI*2); ctx.fill();
          ctx.restore();
          
          if (player.x < obs.x + obs.width && player.x + player.size > obs.x &&
              player.y < obs.y + obs.height && player.y + player.size > obs.y) {
              obs.collected = true;
              player.hasShield = true;
              spawnParticles(obs.x + obs.width/2, obs.y + obs.height/2, 15, '#38bdf8', -3, 3, -3, 3, 0.05);
              playCoin(); 
          }
          continue;
        } else if (obs.type === 'piston') {
          // Animate piston bobbing up and down
          const pistonOffset = Math.sin((frameCount - (obs.phase||0)) * 0.05) * 20;
          obs.drawY = obs.y - pistonOffset; // update animated Y
          const pistonGrad = ctx.createLinearGradient(obs.x, obs.drawY, obs.x + obs.width, obs.drawY);
          pistonGrad.addColorStop(0, '#64748b'); pistonGrad.addColorStop(0.5, '#cbd5e1'); pistonGrad.addColorStop(1, '#374151');
          ctx.fillStyle = pistonGrad;
          ctx.fillRect(obs.x, obs.drawY, obs.width, obs.height);
          ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
          ctx.strokeRect(obs.x, obs.drawY, obs.width, obs.height);
          // Piston head highlight
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(obs.x + 4, obs.drawY, obs.width - 8, 10);
        } else if (obs.type === 'cannon_ball') {
          ctx.save();
          ctx.shadowColor = '#f97316'; ctx.shadowBlur = 12;
          const cbGrad = ctx.createRadialGradient(obs.x + obs.width*0.35, obs.y + obs.height*0.35, 2, obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2);
          cbGrad.addColorStop(0, '#fdba74'); cbGrad.addColorStop(1, '#b45309');
          ctx.fillStyle = cbGrad;
          ctx.beginPath(); ctx.arc(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        } else if (obs.type === 'spring_pad') {
          ctx.fillStyle = '#4ade80';
          roundRect(ctx, obs.x, obs.y + 5, obs.width, obs.height - 5, 4); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#14532d'; ctx.stroke();
          ctx.fillStyle = '#bbf7d0';
          ctx.fillRect(obs.x, obs.y, obs.width, 5); ctx.strokeRect(obs.x, obs.y, obs.width, 5);
        } else if (obs.type === 'spike') {
          ctx.save();
          ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
          let spikeGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height);
          spikeGrad.addColorStop(0, '#f87171'); spikeGrad.addColorStop(1, '#991b1b');
          ctx.fillStyle = spikeGrad; ctx.beginPath();
          ctx.moveTo(obs.x + obs.width / 2, obs.y); ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.lineTo(obs.x, obs.y + obs.height); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#450a0a'; ctx.stroke();
          ctx.restore();
        } else if (obs.type === 'pipe') {
          let pipeGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.width, obs.y);
          pipeGrad.addColorStop(0, '#16a34a'); pipeGrad.addColorStop(0.3, '#4ade80'); pipeGrad.addColorStop(1, '#14532d');
          ctx.fillStyle = pipeGrad; ctx.fillRect(obs.x, obs.y + 12, obs.width, obs.height - 12); ctx.fillRect(obs.x - 4, obs.y, obs.width + 8, 12);
          ctx.strokeStyle = '#052e16'; ctx.strokeRect(obs.x, obs.y + 12, obs.width, obs.height - 12); ctx.strokeRect(obs.x - 4, obs.y, obs.width + 8, 12);
        } else if (obs.type === 'goomba') {
          let goombaGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height);
          goombaGrad.addColorStop(0, '#b45309'); goombaGrad.addColorStop(1, '#78350f');
          ctx.fillStyle = goombaGrad; roundRect(ctx, obs.x, obs.y, obs.width, obs.height - 4, 8); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(obs.x + 8, obs.y + 10, 4, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(obs.x + 18, obs.y + 10, 4, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(obs.x + 6, obs.y + 10, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(obs.x + 16, obs.y + 10, 2, 0, Math.PI*2); ctx.fill();
          if (Math.floor(frameCount / 8) % 2 === 0) {
             roundRect(ctx, obs.x - 2, obs.y + obs.height - 4, 12, 6, 3); ctx.fill();
             roundRect(ctx, obs.x + obs.width - 10, obs.y + obs.height - 4, 12, 6, 3); ctx.fill();
          } else {
             roundRect(ctx, obs.x + 4, obs.y + obs.height - 4, 12, 6, 3); ctx.fill();
             roundRect(ctx, obs.x + obs.width - 16, obs.y + obs.height - 4, 12, 6, 3); ctx.fill();
          }
        } else if (obs.type === 'bullet_bill') {
          if (frameCount % 4 === 0 && gameState === 'PLAYING') {
              spawnParticles(obs.x + obs.width, obs.y + obs.height/2, 1, '#94a3b8', 1, 3, -1, 1, 0.05); // Smoke trail
          }
          let bbGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height);
          bbGrad.addColorStop(0, '#475569'); bbGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = bbGrad; ctx.beginPath(); ctx.moveTo(obs.x + obs.width, obs.y);
          ctx.lineTo(obs.x + 10, obs.y); ctx.arc(obs.x + 10, obs.y + obs.height/2, obs.height/2, Math.PI*1.5, Math.PI*0.5, true);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#000'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(obs.x + 12, obs.y + 10, 3, 0, Math.PI*2); ctx.fill();
        } else if (obs.type === 'end_flag') {
          // Draw finish flag — tall pole with a green flag
          ctx.save();
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(obs.x + 8, obs.y, 4, obs.height);
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(obs.x + 12, obs.y);
          ctx.lineTo(obs.x + 38, obs.y + 15);
          ctx.lineTo(obs.x + 12, obs.y + 30);
          ctx.closePath(); ctx.fill();
          ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 12;
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.moveTo(obs.x + 12, obs.y + 4);
          ctx.lineTo(obs.x + 34, obs.y + 15);
          ctx.lineTo(obs.x + 12, obs.y + 26);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          // Reaching the flag completes the level
          if (player.x + player.size > obs.x + 8 && player.x < obs.x + 20) {
            if (!isLevelComplete) {
              isLevelComplete = true;
              spawnParticles(obs.x + 20, obs.y + obs.height/2, 30, '#4ade80', -5, 5, -5, 5, 0.03);
              spawnParticles(obs.x + 20, obs.y + obs.height/2, 20, '#fde047', -4, 4, -4, 4, 0.04);
              playWin();
              setScore(currentScore);
              if (currentLevel >= unlockedLevel && currentLevel < LEVEL_CONFIG.length)
                saveUnlockedLevel(currentLevel + 1);
              setGameState('LEVEL_COMPLETE');
            }
          }
          continue;
        } else {
          // Box / tall_box default — with flash effect
          const flashOn = obs._hitFlash && obs._hitFlash > 0;
          if (flashOn) obs._hitFlash--;
          let boxGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height);
          if (flashOn) {
            boxGrad.addColorStop(0, '#ffffff'); boxGrad.addColorStop(1, '#fbbf24');
          } else {
            boxGrad.addColorStop(0, '#fcd34d'); boxGrad.addColorStop(1, '#d97706');
          }
          ctx.fillStyle = boxGrad; ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.lineWidth = 2; ctx.strokeStyle = '#78350f'; ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.strokeStyle = 'rgba(120, 53, 15, 0.3)'; ctx.strokeRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);
        }

        let hitBoxX = obs.x; let hitBoxWidth = obs.width; 
        let hitBoxY = (obs.drawY !== undefined) ? obs.drawY : obs.y;
        let hitBoxHeight = obs.height;
        const isSolid = ['box', 'tall_box', 'pipe', 'spring_pad', 'piston'].includes(obs.type);

        // Slimmer hitboxes for angled/wide obstacles
        if (obs.type === 'spike')      { hitBoxX += 7; hitBoxWidth -= 14; hitBoxY += 10; hitBoxHeight -= 10; }
        else if (obs.type === 'pipe')  { hitBoxX += 3; hitBoxWidth -= 6; }

        const collidesX = player.x + player.size - 2 > hitBoxX && player.x + 2 < hitBoxX + hitBoxWidth;
        const collidesY = player.y + player.size > hitBoxY && player.y < hitBoxY + hitBoxHeight;

        if (collidesX && collidesY) {
            if (obs.type === 'spring_pad') {
                // Only trigger spring when landing on top
                if (prevY + player.size <= hitBoxY + 10) {
                    player.y = hitBoxY - player.size;
                    player.velocityY = player.jumpPower * 1.6;
                    player.isGrounded = false;
                    player.scaleX = 0.5; player.scaleY = 1.7;
                    spawnParticles(player.x + 15, player.y + player.size, 20, '#4ade80', -3, 3, -5, -1, 0.05);
                    playJump();
                    isOnBlock = true;
                }
            } else if (isSolid && prevY + player.size <= hitBoxY + Math.max(18, player.velocityY * dt + 4)) {
                // Landing on top
                player.y = hitBoxY - player.size;
                player.velocityY = 0;
                player.isGrounded = true;
                isOnBlock = true;
                // === BOX HIT EFFECT: dust puff on first land frame ===
                if (!prevGrounded && (obs.type === 'box' || obs.type === 'tall_box')) {
                  spawnParticles(obs.x + obs.width/2, hitBoxY, 8, '#d97706', -3, 3, -2, 0, 0.06);
                  spawnParticles(obs.x + obs.width/2, hitBoxY, 4, '#fef3c7', -2, 2, -3, -1, 0.08);
                  // Flash the box briefly
                  obs._hitFlash = 6;
                }
            } else if (isSolid && obs.isStair) {
                // STAIR SIDE HIT: push player up to step top instead of dying
                if (player.x + player.size/2 < hitBoxX + hitBoxWidth) {
                    player.y = hitBoxY - player.size;
                    player.velocityY = 0;
                    player.isGrounded = true;
                    isOnBlock = true;
                }
            } else if (!isSolid || (!obs.isStair && prevY + player.size > hitBoxY + Math.max(18, player.velocityY * dt + 4))) {
                // Lethal collision
                if (player.hasShield && obs.type !== 'gap') {
                     player.hasShield = false;
                     obs.speed = 0; obs.y = 2000; if (obs.drawY !== undefined) obs.drawY = 2000;
                     spawnParticles(player.x + 15, player.y + 15, 30, '#38bdf8', -5, 5, -5, 5, 0.03);
                     playHit();
                } else {
                     playHit();
                     isGameOver = true; setScore(currentScore); setGameState('GAME_OVER');
                }
            }
        }
        // Extra snap — if gliding across top of solid block
        if (isSolid && !isOnBlock && collidesX && Math.abs((player.y + player.size) - hitBoxY) < 4) {
            player.y = hitBoxY - player.size; player.velocityY = 0; player.isGrounded = true; isOnBlock = true;
        }
      }

      if (!isOnBlock) {
         if (!overGap && player.y + player.size >= GROUND_Y) {
            if (!player.isGrounded) {
                player.scaleX = 1.4; player.scaleY = 0.65; // Landing squash
                spawnParticles(player.x + 5, GROUND_Y, 8, '#fde047', -3, 3, -3, 0, 0.09);
            }
            player.y = GROUND_Y - player.size; player.velocityY = 0; player.isGrounded = true;
         } else if (!isOnBlock) {
            player.isGrounded = false;
         }
      }
      // Generous bottom edge check before death
      if (player.y > 450) {
         playHit();
         isGameOver = true; setScore(currentScore); setGameState('GAME_OVER');
      }

      ctx.save();
      ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
      ctx.rotate(player.rotation * Math.PI / 180);
      ctx.scale(player.scaleX, player.scaleY);
      
      // Shield aura
      if (player.hasShield) {
          ctx.beginPath();
          ctx.arc(0, 0, player.size * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#7dd3fc';
          ctx.stroke();
      }

      ctx.translate(-(player.size / 2), -(player.size / 2));
      
      let playerGrad = ctx.createLinearGradient(0, 0, 0, player.size);
      playerGrad.addColorStop(0, '#fef08a'); playerGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = playerGrad; roundRect(ctx, 0, 0, player.size, player.size, 6); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#854d0e'; ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(20, 10, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(20, 20, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20.5, 9.5, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(20.5, 19.5, 1, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // Award 1 score point per second (at 60fps, every 60 frames)
      if (frameCount % 60 === 0) {
          currentScore += 1; setScore(currentScore);
      }

      // Modern Glassmorphism UI
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      roundRect(ctx, 10, 10, 280, 80, 15);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Fredoka One", Arial, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      ctx.fillText(`Score: ${currentScore}`, 25, 40);
      ctx.fillStyle = '#fde047';
      ctx.fillText(`Level: ${currentLevel}`, 25, 72);
      // Progress bar
      const progBarW = 240;
      const progPct = Math.min(worldX / config.levelLength, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, 25, 80, progBarW, 8, 4); ctx.fill();
      const barGrad = ctx.createLinearGradient(25, 0, 25 + progBarW, 0);
      barGrad.addColorStop(0, '#4ade80'); barGrad.addColorStop(1, '#22d3ee');
      ctx.fillStyle = barGrad;
      roundRect(ctx, 25, 80, progBarW * progPct, 8, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.shadowBlur = 0;
      ctx.fillText(`${Math.round(progPct * 100)}%`, 272, 88);
      // Shield indicator
      if (player.hasShield) {
          ctx.fillStyle = 'rgba(56,189,248,0.85)';
          roundRect(ctx, canvas.width - 110, 10, 100, 40, 10);
          ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Fredoka One", Arial, sans-serif';
          ctx.fillText('🛡️ SHIELD', canvas.width - 100, 35);
      }
      // [F] Laser key hint badge
      const hintY = player.hasShield ? 58 : 10;
      ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
      roundRect(ctx, canvas.width - 130, hintY, 120, 32, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(34,211,238,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#67e8f9'; ctx.font = 'bold 14px "Fredoka One", Arial, sans-serif';
      ctx.fillText('[F]  Fire Laser', canvas.width - 120, hintY + 21);
      ctx.restore();

      // === DRAW PLAYER LASERS (fired with F) ===
      for (let i = playerLasers.length - 1; i >= 0; i--) {
        const pl = playerLasers[i];
        pl.x += pl.speed * dt;
        pl.life -= 0.015;
        if (pl.x > canvas.width + 50 || pl.life <= 0) { playerLasers.splice(i, 1); continue; }

        // Draw the laser bolt
        ctx.save();
        ctx.globalAlpha = pl.life;
        ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16;
        ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(pl.x, pl.y + 3); ctx.lineTo(pl.x + pl.width, pl.y + 3); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pl.x, pl.y + 3); ctx.lineTo(pl.x + pl.width, pl.y + 3); ctx.stroke();
        ctx.restore();

        // Check if laser hits any turtle
        for (let j = 0; j < obstacles.length; j++) {
          const obs = obstacles[j];
          if (obs.type !== 'turtle' || !obs.alive) continue;
          if (pl.x < obs.x + obs.width && pl.x + pl.width > obs.x &&
              pl.y < obs.y + obs.height && pl.y + pl.height > obs.y) {
            obs.alive = false;
            playerLasers.splice(i, 1);
            spawnParticles(obs.x + obs.width/2, obs.y + obs.height/2, 18, '#4ade80', -5, 5, -5, 3, 0.04);
            spawnParticles(obs.x + obs.width/2, obs.y + obs.height/2, 8, '#fde047', -3, 3, -3, 2, 0.06);
            currentScore += 5;
            setScore(currentScore);
            if (audioCtx.current) {
              const osc2 = audioCtx.current.createOscillator();
              const g2 = audioCtx.current.createGain();
              osc2.connect(g2); g2.connect(audioCtx.current.destination);
              osc2.type = 'square'; osc2.frequency.setValueAtTime(300, audioCtx.current.currentTime);
              osc2.frequency.linearRampToValueAtTime(80, audioCtx.current.currentTime + 0.15);
              g2.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
              g2.gain.linearRampToValueAtTime(0, audioCtx.current.currentTime + 0.18);
              osc2.start(); osc2.stop(audioCtx.current.currentTime + 0.2);
            }
            break;
          }
        }
      }

      // Prune far-off-screen obstacles
      if (obstacles.length > 60) obstacles = obstacles.filter(o => o.x + (o.width || 100) > -150);
      if (particles.length > 200) particles.splice(0, particles.length - 200);

      frameCount++;
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('mousedown', handleMousedown);
      canvas.removeEventListener('mousemove', handleMousemove);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationId);
    };
  }, [gameState, gameKey]);

  const goToLevelSelect = () => {
    initAudio();
    setGameState('LEVEL_SELECT');
  };

  const startLevel = (levelId) => {
    initAudio();
    if (levelId > unlockedLevel) return;
    setCurrentLevel(levelId);
    setScore(0);
    setGameKey(prev => prev + 1);
    setGameState('PLAYING');
  };

  const playAgain = () => {
    setScore(0);
    setGameKey(prev => prev + 1);
    setGameState('PLAYING');
  };

  const nextLevel = () => {
    if (currentLevel < LEVEL_CONFIG.length) {
      setCurrentLevel(currentLevel + 1);
      setScore(0);
      setGameKey(prev => prev + 1);
      setGameState('PLAYING');
    } else {
      setGameState('LEVEL_SELECT');
    }
  };

  const submitScore = async () => {
    if (!user || !token) {
      alert("Please login to save your score.");
      return;
    }
    setSavingScore(true);
    try {
      await axios.post('http://localhost:5001/api/scores/submit', {
        username: user.username,
        score: score
      });
      alert("Score submitted!");
    } catch (err) {
      alert("Error submitting score");
    } finally {
      setSavingScore(false);
    }
  };

  return (
    <div className="game-wrapper">
      <h2 className="title-shadow" style={{fontSize: '3.5rem', marginBottom: '2rem'}}>PolyDash</h2>

      {gameState === 'START_MENU' && (
        <div className="game-menu overlay-menu">
          <div className="menu-box bounce-in">
            <h3>Welcome</h3>
            <p>Collect coins, jump over gaps, and climb platforms!</p>
            <p>Press space to jump.</p>
            <button onClick={goToLevelSelect} className="primary-btn pulse margin-top">Play Now!</button>
          </div>
        </div>
      )}

      {gameState === 'LEVEL_SELECT' && (
        <div className="game-menu overlay-menu level-select-container">
          <div className="menu-box large-box bounce-in">
            <h3>Select Level</h3>
            <div className="level-grid">
              {LEVEL_CONFIG.map(level => {
                const isLocked = level.id > unlockedLevel;
                return (
                  <button 
                    key={level.id} 
                    className={`level-btn ${isLocked ? 'locked' : 'unlocked'}`}
                    onClick={() => startLevel(level.id)}
                    disabled={isLocked}
                  >
                    <span className="level-number">{level.id}</span>
                    {isLocked && <span className="lock-icon">🔒</span>}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setGameState('START_MENU')} className="secondary-btn margin-top">Back to Menu</button>
          </div>
        </div>
      )}
      
      <div className="canvas-container">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400} 
          className={gameState !== 'PLAYING' ? 'blurred-canvas' : ''}
        />
        
        {gameState === 'GAME_OVER' && (
          <div className="game-over-overlay overlay-menu">
            <div className="menu-box bounce-in">
              <h3>Game Over!</h3>
              <p>Your Score: {score} (Level {currentLevel})</p>
              <div className="actions">
                <button onClick={playAgain} className="primary-btn pulse">Try Again</button>
                <button onClick={goToLevelSelect} className="secondary-btn">Level Select</button>
                {user ? (
                  <button onClick={submitScore} disabled={savingScore} className="save-btn action-btn">
                    {savingScore ? 'Saving...' : 'Save Score'}
                  </button>
                ) : (
                  <p className="login-prompt">Login to save your score!</p>
                )}
              </div>
            </div>
          </div>
        )}

        {gameState === 'LEVEL_COMPLETE' && (
          <div className="game-over-overlay overlay-menu success-overlay">
            <div className="menu-box bounce-in">
              <h3 className="success-text">Level {currentLevel} Cleared!</h3>
              <p>Awesome job!</p>
              <div className="actions">
                {currentLevel < LEVEL_CONFIG.length ? (
                  <button onClick={nextLevel} className="primary-btn pulse">Next Level</button>
                ) : (
                  <button onClick={goToLevelSelect} className="primary-btn">Game Completed!</button>
                )}
                <button onClick={goToLevelSelect} className="secondary-btn">Level Select</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Game;
