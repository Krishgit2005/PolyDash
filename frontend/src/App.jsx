import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Game from './components/Game';
import Login from './components/Login';
import Register from './components/Register';
import Leaderboard from './components/Leaderboard';
import './App.css';

function App() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">
          <Link to="/">PolyDash</Link>
        </div>
        <div className="nav-links">
          <Link to="/game">Play</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          {user ? (
            <>
              <span className="user-greeting">Hi, {user.username}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="login-link">Login</Link>
              <Link to="/register" className="register-link">Register</Link>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={
            <div className="home-hero">
              <h1>Welcome to PolyDash</h1>
              <p>The ultimate canvas runner game.</p>
              <Link to="/game" className="cta-btn">Play Now</Link>
            </div>
          } />
          <Route path="/game" element={<Game />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
