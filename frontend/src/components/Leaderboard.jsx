import { useState, useEffect } from 'react';
import axios from 'axios';
import './Leaderboard.css';

function Leaderboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const res = await axios.get('http://localhost:5001/api/scores/top');
        setScores(res.data);
      } catch (err) {
        console.error('Failed to fetch scores', err);
      } finally {
        setLoading(false);
      }
    };
    fetchScores();
  }, []);

  return (
    <div className="leaderboard-container">
      <h2>Top High Scores</h2>
      {loading ? (
        <p>Loading scores...</p>
      ) : (
        <table className="score-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {scores.length > 0 ? (
              scores.map((s, index) => (
                <tr key={s._id}>
                  <td>#{index + 1}</td>
                  <td>{s.username}</td>
                  <td className="score-val">{s.score}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">No scores yet. Be the first to play!</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Leaderboard;
