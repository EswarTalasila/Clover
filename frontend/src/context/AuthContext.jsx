import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function decodeEmailHint() {
  return localStorage.getItem('email') || null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [email, setEmail] = useState(decodeEmailHint);

  function saveToken(t, userEmail) {
    localStorage.setItem('token', t);
    setToken(t);
    if (userEmail) {
      localStorage.setItem('email', userEmail);
      setEmail(userEmail);
    }
  }

  function clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken(null);
    setEmail(null);
  }

  return (
    <AuthContext.Provider value={{ token, email, saveToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
