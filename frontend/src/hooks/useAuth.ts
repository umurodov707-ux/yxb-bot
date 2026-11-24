import { useState, useEffect, createContext, useContext } from 'react';
import { getMe } from '../api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  refetch: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMe();
      setUser(res.data);
    } catch (e: unknown) {
      const ax = e as { response?: { status: number; data?: { detail?: string } } };
      const detail = ax.response?.data?.detail;
      if (detail === 'user_not_registered') {
        setUser(null);
        setError('not_registered');
      } else if (detail === 'pending_approval') {
        setUser(null);
        setError('pending');
      } else if (detail === 'registration_rejected') {
        setUser(null);
        setError('rejected');
      } else {
        setUser(null);
        setError('auth_error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMe(); }, []);

  return { user, loading, error, refetch: fetchMe };
}
