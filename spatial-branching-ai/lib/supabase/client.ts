import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create Supabase client (only if credentials are configured)
export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Type definitions for database tables
export interface DbTree {
    id: string;
    owner_id: string | null;
    name: string;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface DbNode {
    id: string;
    tree_id: string;
    parent_id: string | null;
    position_x: number;
    position_y: number;
    content_type: 'text' | 'image' | 'video';
    data: {
        role: 'user' | 'assistant' | 'system';
        content: string;
        branchContext?: string;
    };
    model_config: {
        model?: string;
        temperature?: number;
    };
    created_at: string;
    updated_at: string;
}

export interface DbEdge {
    id: string;
    tree_id: string;
    source_id: string;
    target_id: string;
    created_at: string;
}

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
    return supabase !== null;
};
