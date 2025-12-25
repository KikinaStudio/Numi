-- Spatial Branching AI - Access Control Schema
-- Run this migration in your Supabase SQL editor
-- 1. Create tree_members table
CREATE TABLE IF NOT EXISTS tree_members (
    tree_id UUID REFERENCES trees(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    -- Storing the client-side generated ID (or auth.users ID later)
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tree_id, user_id)
);
-- 2. Index for fast lookups by user (for the "My Trees" list)
CREATE INDEX IF NOT EXISTS idx_tree_members_user_id ON tree_members(user_id);
-- 3. RLS Policies
ALTER TABLE tree_members ENABLE ROW LEVEL SECURITY;
-- Allow reading memberships (permissive for now, can be tightened)
CREATE POLICY "Allow public read access" ON tree_members FOR
SELECT USING (true);
-- Allow inserting (joining a tree)
CREATE POLICY "Allow public insert access" ON tree_members FOR
INSERT WITH CHECK (true);
-- Allow updating (updating last_accessed_at)
CREATE POLICY "Allow public update access" ON tree_members FOR
UPDATE USING (true);