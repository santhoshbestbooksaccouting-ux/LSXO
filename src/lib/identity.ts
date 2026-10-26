import { AuthenticatedAccount, AuthorizedUsername, PlayerIdentity } from '../types/game';

export const SHARED_ROOM_ID = 'room_ithal_sanu';
export const SHARED_ROOM_PASSCODE = 'ithal_sanu_private_2026';

export const AUTHORIZED_ACCOUNTS: Record<
  AuthorizedUsername,
  { password: string; account: AuthenticatedAccount }
> = {
  Ithal: {
    password: 'Ithal7',
    account: {
      username: 'Ithal',
      displayName: 'Ithal',
      id: 'user_ithal',
      defaultSlot: 'p1',
      defaultSymbol: 'X',
    },
  },
  Sanu: {
    password: 'Sanu9',
    account: {
      username: 'Sanu',
      displayName: 'Sanu',
      id: 'user_sanu',
      defaultSlot: 'p2',
      defaultSymbol: 'O',
    },
  },
};

const SESSION_KEY = 'duoxo_authenticated_user';

export function authenticateUser(
  usernameInput: string,
  passwordInput: string
): { success: boolean; account?: AuthenticatedAccount; error?: string } {
  const trimmedUser = usernameInput.trim();
  const trimmedPass = passwordInput.trim();

  // Match case-insensitively for user convenience, but exact match for password
  const matchedKey = (Object.keys(AUTHORIZED_ACCOUNTS) as AuthorizedUsername[]).find(
    (key) => key.toLowerCase() === trimmedUser.toLowerCase()
  );

  if (!matchedKey) {
    return {
      success: false,
      error: 'Invalid username. Only authorized accounts (Ithal or Sanu) can play.',
    };
  }

  const userConfig = AUTHORIZED_ACCOUNTS[matchedKey];
  if (userConfig.password !== trimmedPass) {
    return {
      success: false,
      error: 'Incorrect password for this account.',
    };
  }

  return {
    success: true,
    account: userConfig.account,
  };
}

export function getStoredSession(): AuthenticatedAccount | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL override ?user=Ithal or ?user=Sanu
  try {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    if (userParam) {
      const match = (Object.keys(AUTHORIZED_ACCOUNTS) as AuthorizedUsername[]).find(
        (k) => k.toLowerCase() === userParam.toLowerCase()
      );
      if (match) {
        return AUTHORIZED_ACCOUNTS[match].account;
      }
    }
  } catch {
    // ignore
  }

  // 2. Check tab-scoped sessionStorage first (allows 2 tabs in same browser)
  try {
    const sessionVal = sessionStorage.getItem(SESSION_KEY);
    if (sessionVal) {
      const parsed = JSON.parse(sessionVal) as AuthenticatedAccount;
      if (parsed && (parsed.username === 'Ithal' || parsed.username === 'Sanu')) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // 3. Check persistent localStorage
  try {
    const localVal = localStorage.getItem(SESSION_KEY);
    if (localVal) {
      const parsed = JSON.parse(localVal) as AuthenticatedAccount;
      if (parsed && (parsed.username === 'Ithal' || parsed.username === 'Sanu')) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function saveSession(account: AuthenticatedAccount): void {
  if (typeof window !== 'undefined') {
    const str = JSON.stringify(account);
    try {
      sessionStorage.setItem(SESSION_KEY, str);
      localStorage.setItem(SESSION_KEY, str);
    } catch {
      // ignore
    }
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete('user');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }
}

export function getOrCreatePlayerIdentity(): PlayerIdentity {
  const session = getStoredSession();
  if (session) {
    return {
      id: session.id,
      name: session.displayName,
    };
  }
  return { id: 'anon', name: 'Player' };
}
