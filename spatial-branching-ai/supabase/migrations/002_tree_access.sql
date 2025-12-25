-- Migration: 002_tree_access.sql
-- Description: Tracks which users have accessed which trees to enable personalized "Shared with me" lists.
-- tree_access table
CREATE TABLE IF NOT EXISTS tree_access (
    tree_id UUID REFERENCES trees(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    -- Ephemeral browser ID for now
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tree_id, user_id)
);
-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_tree_access_user_id ON tree_access(user_id);
-- Enable RLS
ALTER TABLE tree_access ENABLE ROW LEVEL SECURITY;
-- Permissive policies for now (similar to other tables)
CREATE POLICY "Allow all operations on tree_access" ON tree_access FOR ALL USING (true);