-- Spatial Branching AI - Initial Schema
-- Run this migration in your Supabase SQL editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trees table (conversation workspaces)
CREATE TABLE IF NOT EXISTS trees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID, -- Will be linked to auth.users when auth is implemented
  name TEXT NOT NULL DEFAULT 'Untitled Tree',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nodes table (conversation nodes with recursive structure)
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID REFERENCES trees(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'video')),
  data JSONB NOT NULL DEFAULT '{}',
  -- data schema: { role: 'user'|'assistant', content: string, branchContext?: string }
  model_config JSONB DEFAULT '{}',
  -- model_config schema: { model?: string, temperature?: number }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edges table (explicit relationships for React Flow visualization)
CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID REFERENCES trees(id) ON DELETE CASCADE,
  source_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_nodes_tree_id ON nodes(tree_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_edges_tree_id ON edges(tree_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trees_updated_at ON trees;
CREATE TRIGGER trees_updated_at 
  BEFORE UPDATE ON trees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS nodes_updated_at ON nodes;
CREATE TRIGGER nodes_updated_at 
  BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) - Prepared for future auth implementation
-- These policies are permissive for now; tighten when auth is added

ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies (replace with auth-based policies later)
CREATE POLICY "Allow all operations on trees" ON trees FOR ALL USING (true);
CREATE POLICY "Allow all operations on nodes" ON nodes FOR ALL USING (true);
CREATE POLICY "Allow all operations on edges" ON edges FOR ALL USING (true);
