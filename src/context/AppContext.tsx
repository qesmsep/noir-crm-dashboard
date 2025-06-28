import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  email?: string;
  [key: string]: any;
}

export interface Reservation {
  [key: string]: any;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  reservations: Reservation[];
  setReservations: (reservations: Reservation[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <AppContext.Provider value={{ user, setUser, reservations, setReservations }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContextProvider');
  return ctx;
}; 