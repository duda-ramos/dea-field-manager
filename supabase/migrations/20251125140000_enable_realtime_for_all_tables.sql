-- Enable realtime for all core tables
-- This migration adds all core tables to the supabase_realtime publication
-- so that clients can subscribe to real-time changes

-- Add projects table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- Add installations table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.installations;

-- Add contacts table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

-- Add supplier_proposals (budgets) table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_proposals;

-- Add item_versions table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_versions;

-- Add files table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;

-- Verify the tables are in the publication
-- Run this query to check: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
