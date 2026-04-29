import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  currentUser: User | null;
  users: User[];
  isLocked: boolean;
  inputDigits: string;
  biometricAvailable: boolean;
  biometricRegistered: boolean;
  
  // Actions
  initAuth: () => Promise<void>;
  addDigit: (digit: string) => void;
  removeDigit: () => void;
  clearInput: () => void;
  setLocked: (locked: boolean) => void;
  login: (userId: string, passcode: string) => Promise<boolean>;
  logout: () => void;
  lock: () => void;
  unlock: () => void;
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'passcodeHash'>, passcode: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  resetUserPasscode: (userId: string, newPasscode: string) => Promise<void>;
  setBiometricRegistered: (registered: boolean) => void;
}

export async function hashPasscode(passcode: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(passcode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_PERMISSIONS = {
  admin: { canSell: true, canEditPrice: true, canViewReports: true, canManageInventory: true, canManageUsers: true, canAccessSettings: true, canViewDashboard: true },
  pharmacist: { canSell: true, canEditPrice: false, canViewReports: true, canManageInventory: true, canManageUsers: false, canAccessSettings: true, canViewDashboard: true },
  cashier: { canSell: true, canEditPrice: false, canViewReports: false, canManageInventory: false, canManageUsers: false, canAccessSettings: false, canViewDashboard: false }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: JSON.parse(localStorage.getItem('pharma_current_user') || 'null'),
  users: JSON.parse(localStorage.getItem('pharma_users') || '[]'),
  isLocked: true,
  inputDigits: '',
  biometricAvailable: false,
  biometricRegistered: localStorage.getItem('pharma_biometric_registered') === '1',

  initAuth: async () => {
    // Platform biometric checks
    const supported = !!(
      window.PublicKeyCredential && 
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
    
    // Seed default admin if empty
    let storedUsers = [...get().users];
    if (storedUsers.length === 0) {
      const defaultAdminPasscodeHash = await hashPasscode("000000");
      const defaultAdmin: User = {
        id: 'admin-1',
        name: 'Admin',
        role: 'admin',
        passcodeHash: defaultAdminPasscodeHash,
        isActive: true,
        permissions: DEFAULT_PERMISSIONS.admin,
        createdAt: new Date().toISOString()
      };
      storedUsers = [defaultAdmin];
      localStorage.setItem('pharma_users', JSON.stringify(storedUsers));
    }

    set({ biometricAvailable: supported, users: storedUsers });
  },

  addDigit: (digit) => {
    const current = get().inputDigits;
    if (current.length < 6) {
      set({ inputDigits: current + digit });
    }
  },

  removeDigit: () => {
    const current = get().inputDigits;
    if (current.length > 0) {
      set({ inputDigits: current.slice(0, -1) });
    }
  },

  clearInput: () => {
    set({ inputDigits: '' });
  },

  setLocked: (locked) => {
    set({ isLocked: locked, inputDigits: '' });
  },

  login: async (userId, passcode) => {
    const user = get().users.find(u => u.id === userId && u.isActive);
    if (!user) return false;
    const hashed = await hashPasscode(passcode);
    if (hashed === user.passcodeHash) {
      set({ currentUser: user, isLocked: false, inputDigits: '' });
      localStorage.setItem('pharma_current_user', JSON.stringify(user));
      return true;
    }
    return false;
  },

  logout: () => {
    set({ currentUser: null, isLocked: true });
    localStorage.removeItem('pharma_current_user');
  },

  lock: () => {
    set({ isLocked: true });
  },

  unlock: () => {
    set({ isLocked: false });
  },

  addUser: async (userFields, passcode) => {
    const hashed = await hashPasscode(passcode);
    const newUser: User = {
      ...userFields,
      id: crypto.randomUUID(),
      passcodeHash: hashed,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    const updatedUsers = [...get().users, newUser];
    localStorage.setItem('pharma_users', JSON.stringify(updatedUsers));
    set({ users: updatedUsers });
  },

  updateUser: (userId, updates) => {
    const updatedUsers = get().users.map(u => u.id === userId ? { ...u, ...updates } : u);
    localStorage.setItem('pharma_users', JSON.stringify(updatedUsers));
    set({ users: updatedUsers });

    if (get().currentUser?.id === userId) {
      const updatedCurrent = { ...get().currentUser!, ...updates };
      set({ currentUser: updatedCurrent });
      localStorage.setItem('pharma_current_user', JSON.stringify(updatedCurrent));
    }
  },

  deleteUser: (userId) => {
    const userToDelete = get().users.find(u => u.id === userId);
    if (!userToDelete || userToDelete.role === 'admin') return; 
    const updatedUsers = get().users.filter(u => u.id !== userId);
    localStorage.setItem('pharma_users', JSON.stringify(updatedUsers));
    set({ users: updatedUsers });
  },

  resetUserPasscode: async (userId, newPasscode) => {
    const hashed = await hashPasscode(newPasscode);
    const updatedUsers = get().users.map(u => u.id === userId ? { ...u, passcodeHash: hashed } : u);
    localStorage.setItem('pharma_users', JSON.stringify(updatedUsers));
    set({ users: updatedUsers });
  },

  setBiometricRegistered: (registered) => {
    if (registered) {
      localStorage.setItem('pharma_biometric_registered', '1');
    } else {
      localStorage.removeItem('pharma_biometric_registered');
      localStorage.removeItem('pharma_webauthn_credential_id');
    }
    set({ biometricRegistered: registered });
  }
}));

export const hasPermission = (user: User | null, permission: keyof User['permissions']): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions && user.permissions[permission] !== undefined) {
    return user.permissions[permission] === true;
  }
  const defaults = DEFAULT_PERMISSIONS[user.role];
  return defaults ? (defaults as any)[permission] === true : false;
};
