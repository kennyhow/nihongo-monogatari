import { createClient } from '@supabase/supabase-js';

// These should be set in your .env file with the VITE_ prefix
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. Cloud sync will be disabled.');
}

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Check if the user is authenticated
 */
export const getSession = async () => {
  if (!supabase) {
    return null;
  }
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    return null;
  }
  return session;
};

/**
 * Sign in with email and password
 */
export const signIn = async (email, password) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  return await supabase.auth.signInWithPassword({ email, password });
};

/**
 * Sign up with email and password
 */
export const signUp = async (email, password) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  return await supabase.auth.signUp({ email, password });
};

/**
 * Sign out
 */
export const signOut = async () => {
  if (!supabase) {
    return;
  }
  return await supabase.auth.signOut();
};
