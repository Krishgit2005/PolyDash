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

const LEVEL_CONFIG = [
  { id: 1, targetScore: 100, baseSpeed: 4, obstacleIntervalBase: 110, typeWeights: { box: 1, spike: 0, tall_box: 0, goomba: 0, pipe: 0, coin_arc: 0.5, gap: 0, platform_jump: 0, stairs: 0 } },
  { id: 2, targetScore: 200, baseSpeed: 4.5, obstacleIntervalBase: 100, typeWeights: { box: 0.5, spike: 0.2, tall_box: 0.3, goomba: 0.2, pipe: 0.2, coin_arc: 0.5, gap: 0.2, platform_jump: 0, stairs: 0.2 } },
  { id: 3, targetScore: 350, baseSpeed: 5, obstacleIntervalBase: 95, typeWeights: { box: 0.2, spike: 0.3, tall_box: 0.3, goomba: 0.3, pipe: 0.2, coin_arc: 0.4, gap: 0.3, platform_jump: 0.2, stairs: 0.3 } },
  { id: 4, targetScore: 500, baseSpeed: 5.5, obstacleIntervalBase: 90, typeWeights: { box: 0.2, spike: 0.3, tall_box: 0.2, goomba: 0.3, pipe: 0.3, bullet_bill: 0.1, coin_arc: 0.4, gap: 0.3, platform_jump: 0.3, stairs: 0.3 } },
  { id: 5, targetScore: 650, baseSpeed: 6, obstacleIntervalBase: 85, typeWeights: { box: 0.1, spike: 0.2, tall_box: 0.2, goomba: 0.4, pipe: 0.3, bullet_bill: 0.2, coin_arc: 0.5, gap: 0.4, platform_jump: 0.4, stairs: 0.3 } },
  { id: 6, targetScore: 800, baseSpeed: 6.5, obstacleIntervalBase: 80, typeWeights: { box: 0.2, spike: 0.3, tall_box: 0.1, goomba: 0.4, pipe: 0.3, bullet_bill: 0.3, coin_arc: 0.5, gap: 0.4, platform_jump: 0.4, stairs: 0.3 } },
  { id: 7, targetScore: 1000, baseSpeed: 7, obstacleIntervalBase: 75, typeWeights: { box: 0.2, spike: 0.3, tall_box: 0.2, goomba: 0.4, pipe: 0.4, bullet_bill: 0.4, coin_arc: 0.5, gap: 0.5, platform_jump: 0.4, stairs: 0.4 } },
  { id: 8, targetScore: 1200, baseSpeed: 7.5, obstacleIntervalBase: 70, typeWeights: { box: 0.1, spike: 0.3, tall_box: 0.1, goomba: 0.4, pipe: 0.4, bullet_bill: 0.4, coin_arc: 0.5, gap: 0.5, platform_jump: 0.5, stairs: 0.4 } },
  { id: 9, targetScore: 1500, baseSpeed: 8, obstacleIntervalBase: 65, typeWeights: { box: 0.1, spike: 0.3, tall_box: 0.1, goomba: 0.5, pipe: 0.4, bullet_bill: 0.5, coin_arc: 0.4, gap: 0.5, platform_jump: 0.5, stairs: 0.4 } },
  { id: 10, targetScore: 2000, baseSpeed: 9, obstacleIntervalBase: 60, typeWeights: { box: 0, spike: 0.3, tall_box: 0, goomba: 0.5, pipe: 0.5, bullet_bill: 0.6, coin_arc: 0.5, gap: 0.6, platform_jump: 0.6, stairs: 0.4 } }
];

function getRandomObstacleType(weights, prngVal) {
  let totalWeight = 0;
  for (let key in weights) totalWeight += weights[key];
  let random = prngVal * totalWeight;
  for (let key in weights) {
    if (random < weights[key]) return key;
    random -= weights[key];
  }
  return 'box';
}

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
    
    let player = { 
        x: 100, y: 300, size: 30, 
        velocityY: 0, gravity: 0.6, jumpPower: -12.5,  // floatier physics
        isGrounded: false, rotation: 0 
    };
    let obstacles = [];
    let frameCount = 0;
    let obstacleTimer = 110; 
    let currentScore = 0;
    let bgScrollX = 0;
    
    const config = LEVEL_CONFIG.find(l => l.id === currentLevel) || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
    let isGameOver = false;
    let isLevelComplete = false;

    const seed = cyrb128("polydash_level_" + currentLevel);
    const prng = sfc32(seed[0], seed[1], seed[2], seed[3]);

    const handleKeyDown = (e) => {
      if (['Space', 'ArrowUp'].includes(e.code)) {
        e.preventDefault();
      }
      if ((e.code === 'Space' || e.code === 'ArrowUp') && player.isGrounded) {
        player.velocityY = player.jumpPower;
        player.isGrounded = false;
        playJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    // Handle touch/click jump for mobile support
    const handleTouch = (e) => {
      e.preventDefault();
      if (player.isGrounded) {
        player.velocityY = player.jumpPower;
        player.isGrounded = false;
        playJump();
      }
    };
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('mousedown', handleTouch, { passive: false });

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

    const gameLoop = () => {
      if (isGameOver || isLevelComplete) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Sky
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(0, 0, canvas.width, 350);
      // Sun
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(700, 80, 40, 0, Math.PI*2); ctx.fill();
      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      for(let i=0; i<4; i++) {
        let cx = ((i*250) + bgScrollX*0.1) % (canvas.width + 200);
        if (cx < -100) cx += canvas.width + 300;
        ctx.beginPath();
        ctx.arc(cx, 80 + (i%2)*20, 25, 0, Math.PI*2);
        ctx.arc(cx+25, 70 + (i%2)*20, 35, 0, Math.PI*2);
        ctx.arc(cx+50, 80 + (i%2)*20, 25, 0, Math.PI*2);
        ctx.fill();
      }
      bgScrollX -= (config.baseSpeed * 0.8);
      // Back Hill
      ctx.fillStyle = '#65a30d'; 
      ctx.beginPath(); ctx.moveTo(0, 350);
      for(let x = 0; x <= canvas.width + 10; x += 20) {
        let y = 300 + Math.sin((x - bgScrollX*0.3)*0.008) * 45; ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width + 10, 350); ctx.fill();
      // Front Hill
      ctx.fillStyle = '#84cc16'; 
      ctx.beginPath(); ctx.moveTo(0, 350);
      for(let x = 0; x <= canvas.width + 10; x += 20) {
        let y = 320 + Math.sin((x - bgScrollX*0.6)*0.015) * 25; ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width + 10, 350); ctx.fill();

      let prevY = player.y;

      // Player physics
      player.velocityY += player.gravity;
      player.y += player.velocityY;
      
      if (!player.isGrounded) {
         player.rotation += 8; 
      } else {
         let target = Math.round(player.rotation / 90) * 90;
         if (player.rotation < target) player.rotation += Math.min(8, target - player.rotation);
         else if (player.rotation > target) player.rotation -= Math.min(8, player.rotation - target);
      }

      // Obstacle & Pattern Spawning USING PRNG
      obstacleTimer++;
      let spawnInterval = config.obstacleIntervalBase + (prng() * 20 - 10); 
      
      if (obstacleTimer >= spawnInterval) {
        let type = getRandomObstacleType(config.typeWeights, prng());
        let speed = config.baseSpeed;
        let startX = canvas.width;
        
        if (type === 'stairs') {
            // wider, lower steps for climbing ease
            obstacles.push({ x: startX, y: 320, width: 80, height: 30, type: 'box', speed });
            obstacles.push({ x: startX + 80, y: 290, width: 80, height: 60, type: 'tall_box', speed });
            obstacles.push({ x: startX + 160, y: 260, width: 80, height: 90, type: 'tall_box', speed });
            obstacles.push({ x: startX + 190, y: 220, width: 20, height: 20, type: 'coin', speed, collected: false });
            obstacleTimer = -30;
        } else if (type === 'coin_arc') {
            // Lower arc!
            for(let i=0; i<5; i++) {
                let cy = 300 - Math.sin((i/4)*Math.PI) * 70;
                obstacles.push({ x: startX + i*40, y: cy, width: 20, height: 20, type: 'coin', speed, collected: false });
            }
            obstacleTimer = -40;
        } else if (type === 'gap') {
            obstacles.push({ x: startX, y: 350, width: 140, height: 100, type: 'gap', speed });
            obstacles.push({ x: startX + 60, y: 260, width: 20, height: 20, type: 'coin', speed, collected: false });
            obstacleTimer = -40;
        } else if (type === 'platform_jump') {
            obstacles.push({ x: startX, y: 350, width: 240, height: 100, type: 'gap', speed });
            obstacles.push({ x: startX, y: 280, width: 60, height: 20, type: 'box', speed }); // lowered to 280
            obstacles.push({ x: startX + 90, y: 240, width: 60, height: 20, type: 'box', speed });
            obstacles.push({ x: startX + 180, y: 280, width: 60, height: 20, type: 'box', speed });
            // properly aligned coins
            obstacles.push({ x: startX + 20, y: 250, width: 20, height: 20, type: 'coin', speed, collected: false });
            obstacles.push({ x: startX + 110, y: 210, width: 20, height: 20, type: 'coin', speed, collected: false });
            obstacles.push({ x: startX + 200, y: 250, width: 20, height: 20, type: 'coin', speed, collected: false });
            obstacleTimer = -80;
        } else {
            let width = 30;
            let height = 30;
            let yPos = 350 - height;
            if (type === 'spike') { height = 30; width = 30; yPos = 350 - height; }
            else if (type === 'tall_box') { height = 60; yPos = 350 - height; }
            else if (type === 'pipe') { width = 44; height = 60; yPos = 350 - height; }
            else if (type === 'goomba') { width = 30; height = 30; yPos = 350 - height; speed += 0.5; }
            else if (type === 'bullet_bill') { width = 44; height = 28; yPos = 350 - 90; speed += 3.5; }
            obstacles.push({ x: startX, y: yPos, width, height, type, speed });
        }
        if (obstacleTimer >= 0) obstacleTimer = 0;
      }

      // Draw ground with gaps
      let overGap = false;
      let groundSlices = [{x: 0, w: canvas.width}];
      
      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        if (obs.type === 'gap') {
          // You must be over the gap entirely to fall in
          if (player.x + player.size/2 >= obs.x + 10 && player.x + player.size/2 <= obs.x + obs.width - 10) {
              overGap = true;
          }
          let newSlices = [];
          for (let slice of groundSlices) {
             if (obs.x > slice.x && obs.x < slice.x + slice.w) {
                newSlices.push({x: slice.x, w: obs.x - slice.x});
                let remainX = obs.x + obs.width;
                if (remainX < slice.x + slice.w) {
                    newSlices.push({x: remainX, w: (slice.x + slice.w) - remainX});
                }
             } else if (obs.x <= slice.x && obs.x + obs.width > slice.x) {
                let diff = (obs.x + obs.width) - slice.x;
                newSlices.push({x: slice.x + diff, w: slice.w - diff});
             } else {
                newSlices.push(slice);
             }
          }
          groundSlices = newSlices;
        }
      }

      for (let slice of groundSlices) {
          ctx.fillStyle = '#166534'; 
          ctx.fillRect(slice.x, 350, slice.w, 14);
          ctx.fillStyle = '#4ade80'; 
          ctx.fillRect(slice.x, 350, slice.w, 10);
          let dirtGrad = ctx.createLinearGradient(0, 360, 0, canvas.height);
          dirtGrad.addColorStop(0, '#b45309');
          dirtGrad.addColorStop(1, '#78350f');
          ctx.fillStyle = dirtGrad;
          ctx.fillRect(slice.x, 360, slice.w, canvas.height - 360);
          ctx.fillStyle = '#451a03';
          let detail1X = 100 - ((bgScrollX*-1)%200);
          if (detail1X >= slice.x && detail1X <= slice.x + slice.w) ctx.fillRect(detail1X, 370, 10, 4);
      }

      let isOnBlock = false;

      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= obs.speed;
        
        if (obs.type === 'gap') continue;

        if (obs.type === 'coin') {
          if (obs.collected) continue;
          ctx.save();
          ctx.translate(obs.x + obs.width/2, obs.y + obs.height/2);
          ctx.scale(Math.abs(Math.cos(frameCount * 0.1)), 1);
          ctx.beginPath(); ctx.arc(0, 0, obs.width/2, 0, Math.PI*2);
          ctx.fillStyle = '#fde047'; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#ca8a04'; ctx.stroke();
          ctx.fillStyle = '#ca8a04'; ctx.fillRect(-2, -6, 4, 12);
          ctx.restore();

          if (player.x < obs.x + obs.width && player.x + player.size > obs.x &&
              player.y < obs.y + obs.height && player.y + player.size > obs.y) {
              obs.collected = true;
              currentScore += 10;
              setScore(currentScore);
              playCoin();
              
              if (currentScore >= config.targetScore) {
                  isLevelComplete = true;
                  playWin();
                  if (currentLevel >= unlockedLevel && currentLevel < LEVEL_CONFIG.length) {
                      saveUnlockedLevel(currentLevel + 1);
                  }
                  setGameState('LEVEL_COMPLETE');
              }
          }
          continue;
        }

        if (obs.type === 'spike') {
          let spikeGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height);
          spikeGrad.addColorStop(0, '#f87171'); spikeGrad.addColorStop(1, '#991b1b');
          ctx.fillStyle = spikeGrad; ctx.beginPath();
          ctx.moveTo(obs.x + obs.width / 2, obs.y); ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.lineTo(obs.x, obs.y + obs.height); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#450a0a'; ctx.stroke();
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
          let bbGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height);
          bbGrad.addColorStop(0, '#475569'); bbGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = bbGrad; ctx.beginPath(); ctx.moveTo(obs.x + obs.width, obs.y);
          ctx.lineTo(obs.x + 10, obs.y); ctx.arc(obs.x + 10, obs.y + obs.height/2, obs.height/2, Math.PI*1.5, Math.PI*0.5, true);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#000'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(obs.x + 12, obs.y + 10, 3, 0, Math.PI*2); ctx.fill();
        } else {
          let boxGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height);
          boxGrad.addColorStop(0, '#fcd34d'); boxGrad.addColorStop(1, '#d97706');
          ctx.fillStyle = boxGrad; ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.lineWidth = 2; ctx.strokeStyle = '#78350f'; ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.strokeStyle = 'rgba(120, 53, 15, 0.3)'; ctx.strokeRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);
        }

        let hitBoxX = obs.x; let hitBoxWidth = obs.width; let hitBoxY = obs.y; let hitBoxHeight = obs.height;
        let isSolid = ['box', 'tall_box', 'pipe'].includes(obs.type);

        if (obs.type === 'spike') { hitBoxX += 6; hitBoxWidth -= 12; hitBoxY += 12; hitBoxHeight -= 12; }
        else if (obs.type === 'pipe') { hitBoxX += 4; hitBoxWidth -= 8; }

         if (player.x < hitBoxX + hitBoxWidth && player.x + player.size > hitBoxX &&
            player.y < hitBoxY + hitBoxHeight && player.y + player.size > hitBoxY) {
            
            // Allow larger tolerance (20px) to slide onto platforms given fast movement
            if (isSolid && prevY + player.size <= hitBoxY + Math.max(20, player.velocityY + 2)) {
                player.y = hitBoxY - player.size;
                player.velocityY = 0; player.isGrounded = true; isOnBlock = true;
            } else {
                playHit();
                isGameOver = true; setScore(currentScore); setGameState('GAME_OVER');
            }
        }
        if (isSolid && !isOnBlock && player.x < hitBoxX + hitBoxWidth && player.x + player.size > hitBoxX && Math.abs((player.y + player.size) - hitBoxY) < 2) {
            player.y = hitBoxY - player.size; player.velocityY = 0; player.isGrounded = true; isOnBlock = true;
        }
      }

      if (!isOnBlock) {
         if (!overGap && player.y + player.size >= 350) {
            player.y = 350 - player.size; player.velocityY = 0; player.isGrounded = true;
         } else {
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
      ctx.translate(-(player.x + player.size / 2), -(player.y + player.size / 2));
      let playerGrad = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.size);
      playerGrad.addColorStop(0, '#fef08a'); playerGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = playerGrad; roundRect(ctx, player.x, player.y, player.size, player.size, 6); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#854d0e'; ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(player.x + 20, player.y + 10, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(player.x + 20, player.y + 20, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(player.x + 20.5, player.y + 9.5, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(player.x + 20.5, player.y + 19.5, 1, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      if (frameCount % 60 === 0 && gameState === 'PLAYING') {
          currentScore += 1; setScore(currentScore);
      }

      ctx.fillStyle = '#fff'; ctx.font = '28px "Fredoka One", Arial, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
      ctx.fillText(`Score: ${currentScore} / ${config.targetScore}`, 15, 40);
      ctx.fillText(`Level: ${currentLevel}`, 15, 75);
      ctx.shadowColor = 'transparent';

      if (obstacles.length > 50) obstacles = obstacles.filter(o => o.x + (o.width||100) > -100);

      frameCount++;
      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('mousedown', handleTouch);
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
