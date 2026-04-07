import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

// Helper function to decode JWT and check expiration
const isTokenExpired = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const decoded = JSON.parse(atob(parts[1]));
    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiryTime;
  } catch (err) {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => {
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken && !isTokenExpired(storedToken)) {
      return storedToken;
    }
    return null;
  });
  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem('refreshToken');
  });
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('rememberMe') === 'true';
  });
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshQueue, setRefreshQueue] = useState([]);

  // Load user data from localStorage
  useEffect(() => {
    if (accessToken) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (err) {
          setUser(null);
        }
      }
    } else {
      setUser(null);
    }
  }, [accessToken]);

  // Refresh access token
  const refreshAccessToken = async () => {
    if (!refreshToken || isRefreshing) {
      return null;
    }

    setIsRefreshing(true);
    try {
      const res = await axios.post('http://localhost:8000/api/auth/refresh', {
        refreshToken
      });

      const newAccessToken = res.data.accessToken;
      const newRefreshToken = res.data.refreshToken;

      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Process queued requests
      refreshQueue.forEach(callback => callback(newAccessToken));
      setRefreshQueue([]);

      return newAccessToken;
    } catch (err) {
      console.error('Token refresh failed:', err);
      // Refresh failed, logout user
      logout();
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Setup axios interceptors
  useEffect(() => {
    // Add token to Authorization header
    if (accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }

    // Handle 401 responses (expired/invalid token)
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (isRefreshing) {
            // Queue the request
            return new Promise((resolve) => {
              setRefreshQueue(prev => [...prev, (token) => {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                resolve(axios(originalRequest));
              }]);
            });
          }

          const newToken = await refreshAccessToken();
          if (newToken) {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axios(originalRequest);
          } else {
            navigate('/login');
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [accessToken, refreshToken, isRefreshing, refreshQueue, navigate]);

  const login = async (email, password, rememberMeChecked = false) => {
    try {
      const res = await axios.post('http://localhost:8000/api/auth/login', {
        email,
        password,
        rememberMe: rememberMeChecked
      });

      const newAccessToken = res.data.accessToken;
      const newRefreshToken = res.data.refreshToken;

      // Verify tokens are valid
      if (isTokenExpired(newAccessToken)) {
        throw new Error('Token already expired');
      }

      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      setUser(res.data.user);
      setRememberMe(rememberMeChecked);

      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      localStorage.setItem('rememberMe', rememberMeChecked.toString());
      localStorage.setItem('loginTime', Date.now().toString());

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else if (res.data.user.role === 'service_provider') {
        navigate('/doctor');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      // Clear all auth data on failed login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      throw err;
    }
  };

  const register = async (name, email, password, role, specialization) => {
    try {
      await axios.post('http://localhost:8000/api/auth/register', {
        name,
        email,
        password,
        role,
        specialization
      });
      navigate('/login');
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      // Notify backend of logout
      if (refreshToken) {
        await axios.post('http://localhost:8000/api/auth/logout', {
          refreshToken
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setRememberMe(false);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      delete axios.defaults.headers.common['Authorization'];
      navigate('/login');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token: accessToken,
      refreshToken,
      rememberMe,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
