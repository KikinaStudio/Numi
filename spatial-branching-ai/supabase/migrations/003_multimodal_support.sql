-- Spatial Branching AI - Multi-modal Support
-- Run this in your Supabase SQL Editor
-- 1. Ensure the nodes table is ready for multi-modal data
-- (Note: 001_initial_schema already has data JSONB and content_type)
-- We add an index on content_type for faster filtering/analytics
CREATE INDEX IF NOT EXISTS idx_nodes_content_type ON nodes(content_type);
-- 2. Storage Policies for 'files' bucket
-- Note: You MUST create the bucket 'files' in the Storage UI first!
-- These policies allow public access for simplicity in this Alpha.
-- Allow public to see files
CREATE POLICY "Public Access" ON storage.objects FOR
SELECT USING (bucket_id = 'files');
-- Allow public to upload files
CREATE POLICY "Public Upload" ON storage.objects FOR
INSERT WITH CHECK (bucket_id = 'files');
-- Allow public to delete their own files (or all for now)
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'files');