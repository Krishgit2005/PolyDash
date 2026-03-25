import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Basic decoding of token to get username if needed,
      // here we just stored username in localStorage as well to keep it simple.
      const storedUser = localStorage.getItem('username');
      if (storedUser) setUser({ username: storedUser });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    }
  }, [token]);

  const login = async (username, password) => {
    try {
      const res = await axios.post('http://localhost:5001/api/auth/login', { username, password });
      setToken(res.data.token);
      localStorage.setItem('username', res.data.username);
      setUser({ username: res.data.username });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  };

  const register = async (username, password) => {
    try {
      await axios.post('http://localhost:5001/api/auth/register', { username, password });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
