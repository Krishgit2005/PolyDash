import { useEffect, useRef, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './Game.css';

function Game() {
  const canvasRef = useRef(null);
  const { user, token } = useContext(AuthContext);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (!gameStarted) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    
    // Simple PolyDash Logic (Placeholder runner game)
    let player = { x: 50, y: 300, size: 30, velocityY: 0, gravity: 0.8, jumpPower: -12, isGrounded: false };
    let obstacles = [];
    let frameCount = 0;
    let currentScore = 0;
    let isGameOver = false;

    const handleKeyDown = (e) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && player.isGrounded) {
        player.velocityY = player.jumpPower;
        player.isGrounded = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const gameLoop = () => {
      if (isGameOver) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Player physics
      player.velocityY += player.gravity;
      player.y += player.velocityY;

      // Ground collision
      if (player.y + player.size >= 350) {
        player.y = 350 - player.size;
        player.velocityY = 0;
        player.isGrounded = true;
      }

      // Draw player (a colored square)
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x, player.y, player.size, player.size);

      // Obstacles
      if (frameCount % 90 === 0) {
        obstacles.push({ x: canvas.width, y: 320, width: 30, height: 30, speed: 5 });
      }

      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= obs.speed;
        
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // Collision detection
        if (
          player.x < obs.x + obs.width &&
          player.x + player.size > obs.x &&
          player.y < obs.y + obs.height &&
          player.y + player.size > obs.y
        ) {
          isGameOver = true;
          setGameOver(true);
          setScore(currentScore);
        }
      }

      // Remove off-screen obstacles & increase score
      if (obstacles.length > 0 && obstacles[0].x + obstacles[0].width < 0) {
        obstacles.shift();
        currentScore += 10;
        setScore(currentScore);
      }

      // Draw ground
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 350, canvas.width, canvas.height - 350);

      // Draw Score
      ctx.fillStyle = '#fff';
      ctx.font = '20px Arial';
      ctx.fillText(`Score: ${currentScore}`, 10, 30);

      frameCount++;
      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationId);
    };
  }, [gameStarted]);

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
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
      <h2>PolyDash</h2>
      {!gameStarted && !gameOver && (
        <div className="game-menu">
          <p>Press space to jump and avoid the red obstacles!</p>
          <button onClick={startGame} className="primary-btn">Start Game</button>
        </div>
      )}
      
      <div className="canvas-container">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400} 
          style={{ border: '2px solid #333', borderRadius: '8px' }}
        />
        {gameOver && (
          <div className="game-over-overlay">
            <h3>Game Over!</h3>
            <p>Your Score: {score}</p>
            <div className="actions">
              <button onClick={startGame}>Play Again</button>
              {user ? (
                <button onClick={submitScore} disabled={savingScore} className="save-btn">
                  {savingScore ? 'Saving...' : 'Save Score'}
                </button>
              ) : (
                <p className="login-prompt">Login to save your score!</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Game;
