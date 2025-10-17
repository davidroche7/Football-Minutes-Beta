import { AUTH_USERS, SESSION_STORAGE_KEY, type StoredUser } from '../config/users';

export interface AuthSession {
  username: string;
  token: string;
  issuedAt: string;
}

const textEncoder = new TextEncoder();

const hexToUint8Array = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bufferToHex = (buffer: ArrayBuffer | Uint8Array) => {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const deriveHashBrowser = async (
  password: string,
  user: StoredUser
) => {
  const salt = hexToUint8Array(user.saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: user.iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bufferToHex(derivedBits);
};

const deriveHashNode = async (
  password: string,
  user: StoredUser
) => {
  const { pbkdf2Sync } = await import('node:crypto');
  const salt = Buffer.from(user.saltHex, 'hex');
  const hash = pbkdf2Sync(password, salt, user.iterations, 32, 'sha256');
  return hash.toString('hex');
};

const deriveHash = async (password: string, user: StoredUser) => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return deriveHashBrowser(password, user);
  }
  return deriveHashNode(password, user);
};

const createSessionToken = async () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
  }
  const { randomBytes } = await import('node:crypto');
  return randomBytes(32).toString('base64');
};

export async function verifyCredentials(
  username: string,
  password: string
): Promise<AuthSession | null> {
  const user = AUTH_USERS.find((candidate) => candidate.username === username);
  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return null;
  }

  const derivedHex = await deriveHash(password, user);
  if (derivedHex !== user.hashHex) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return null;
  }

  return {
    username: user.username,
    token: await createSessionToken(),
    issuedAt: new Date().toISOString(),
  };
}

export const loadStoredSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const storeSession = (session: AuthSession | null) => {
  if (typeof window === 'undefined') return;
  if (session) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
};

export const clearSession = () => storeSession(null);
