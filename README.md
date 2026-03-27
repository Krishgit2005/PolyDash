# PolyDash 

PolyDash is a full-stack Web Platformer / Endless Runner created using the **MERN** stack (MongoDB, Express, React, Node.js) and HTML5 Canvas.

## 🌟 Key Features
- **Deterministic Level Design**: Levels utilize a seeded Pseudo-Random Number Generator (PRNG). This guarantees that Level 1 plays the exact same way every single time, giving players the ability to build muscle memory and master the courses!
- **Zero-Dependency Synthesized Audio**: Built to be lean and performant, all sound effects (jumping, coin collection, damage, and level complete) are generated programmatically via the native browser `AudioContext`.
- **Complex Platforming**: Advanced hitbox logic handles solid collisions, climbing staircases, jumping over floor gaps, and dynamic enemy obstacles (Goombas, Bullet Bills).
- **Beautiful Farm Visuals**: The game runs smoothly and looks vibrant with fully canvas-drawn parallax backgrounds (hills, sun, clouds) and global custom premium web-fonts (`Fredoka One`).
- **Global Leaderboard & Auth**: Secure your high scores with MongoDB / Express backend user authentication (Sign Up / Login) using JWTs.

## 🛠 Tech Stack
- **Frontend**: React, React Router, Canvas API, Axios, Vanilla CSS
- **Backend**: Node.js, Express, MongoDB, Mongoose, JSON Web Tokens (JWT), bcrypt

## 🚀 Getting Started

To run PolyDash locally on your machine, you need both the frontend and backend servers running simultaneously.

### 1. Backend Server Setup
Navigate into the `backend` directory, install dependencies, and start the local Node instance:
```bash
cd backend
npm install
npm start
```
*Note: Ensure your MongoDB instance is running, or create a `.env` file with your `MONGO_URI`.*

### 2. Frontend Development Server Setup
Open a new terminal window, navigate to the `frontend` directory, install the packages, and run Vite:
```bash
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:5173` in your browser and start playing!

## 🎮 How to Play
- Press **Space** or **Up Arrow** on your keyboard (or tap the screen on touch devices) to jump!
- Avoid spikes and enemies by jumping over them or jumping on floating platforms.
- Collect **Yellow Coins** to raise your score toward the level target.
- Reach the target score to clear the level and unlock the next one!
