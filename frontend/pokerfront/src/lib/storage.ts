import Cookies from 'js-cookie';

export const storage = {
  set: (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    if (typeof value === 'object') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.setItem(key, value);
    }
  },

  get: (key: string) => {
    if (typeof window === 'undefined') return null;
    const value = localStorage.getItem(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },

  remove: (key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.clear();
    Cookies.remove('token');
  },
};

export const userStorage = {
  getUserId: () => storage.get('user_id') as number | null,
  getUsername: () => storage.get('username') as string | null,
  getEmail: () => storage.get('email') as string | null,
  getBalance: () => storage.get('account_balance') as number | null,
  getDisplayName: () => storage.get('display_name') as string | null,
  getAvatarUrl: () => storage.get('avatar_url') as string | null,
  getToken: () => Cookies.get('token') || null,
  
  set: (key: string, value: any) => {
    storage.set(key, value);
  },
  
  get: (key: string) => {
    return storage.get(key);
  },
  
  setUser: (user: any) => {
    if (user.id) storage.set('user_id', user.id);
    if (user.username) storage.set('username', user.username);
    if (user.email) storage.set('email', user.email);
    if (user.account_balance !== undefined) storage.set('account_balance', user.account_balance);
    if (user.display_name) storage.set('display_name', user.display_name);
    if (user.avatar_url) storage.set('avatar_url', user.avatar_url);
    if (user.token) {
      // Save token to both cookies and localStorage for reliability
      Cookies.set('token', user.token, { expires: 7 });
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', user.token);
      }
    }
  },
  
  clearUser: () => {
    storage.clear();
  },
};

