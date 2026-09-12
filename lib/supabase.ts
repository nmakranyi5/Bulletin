import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://lgmhsorjbffxeljiaigo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbWhzb3JqYmZmeGVsamlhaWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNzAwMTUsImV4cCI6MjEwNDc0NjAxNX0.BkIRmAmX--lNsaII_4tsPRual2AC5mF_l8OkEC2seLo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});