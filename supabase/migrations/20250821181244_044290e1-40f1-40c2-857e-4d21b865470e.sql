-- Add performance indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_installations_updated_at ON installations(updated_at);
CREATE INDEX IF NOT EXISTS idx_installations_project_updated ON installations(project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_installations_user_updated ON installations(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at);
CREATE INDEX IF NOT EXISTS idx_contacts_project_updated ON contacts(project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contacts_user_updated ON contacts(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_budgets_updated_at ON budgets(updated_at);
CREATE INDEX IF NOT EXISTS idx_budgets_project_updated ON budgets(project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_budgets_user_updated ON budgets(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_item_versions_updated_at ON item_versions(updated_at);
CREATE INDEX IF NOT EXISTS idx_item_versions_installation_updated ON item_versions(installation_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_item_versions_user_updated ON item_versions(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_files_updated_at ON files(updated_at);
CREATE INDEX IF NOT EXISTS idx_files_project_updated ON files(project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_files_installation_updated ON files(installation_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_files_user_updated ON files(user_id, updated_at);

-- Add indexes for storage path queries
CREATE INDEX IF NOT EXISTS idx_files_storage_path ON files(storage_path) WHERE storage_path IS NOT NULL;