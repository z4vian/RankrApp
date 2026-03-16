import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ysfpyglqbndphhvcqzep.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZnB5Z2xxYm5kcGhodmNxemVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTEwMjUsImV4cCI6MjA4OTI2NzAyNX0.DnXpY0uwY9Bc6AVCB1kbLS1vu-1kp0IFVcl6FkPtAlk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});