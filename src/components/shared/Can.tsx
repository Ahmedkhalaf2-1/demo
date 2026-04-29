import React from 'react';
import { useAuthStore, hasPermission } from '../../store/useAuthStore';
import type { User } from '../../types';

interface CanProps {
  permission: keyof User['permissions'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const { currentUser } = useAuthStore();
  
  if (hasPermission(currentUser, permission)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
};
