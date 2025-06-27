import React, { createContext, useState, useContext, useEffect } from "react";
import { supabase } from "../pages/api/supabaseClient";

const AppContext = createContext(null);

export function AppContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
    });
    // Listen for login/logout
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

export const useAppContext = () => useContext(AppContext); 