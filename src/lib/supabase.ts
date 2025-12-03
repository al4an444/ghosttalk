import { createClient } from '@supabase/supabase-js';

// These should be in environment variables in a real app, but for this demo/setup we might need them.
// Since I don't have the user's Supabase credentials, I will use placeholders.
// The user will need to provide these.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
