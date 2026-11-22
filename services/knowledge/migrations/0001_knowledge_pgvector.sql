-- AETHER FORGE — Phase 07 PostgreSQL 16 + pgvector Canonical Migration (ADR-0007)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_sources (
  source_id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  title VARCHAR(300) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  classification VARCHAR(32) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  immutable_object_ref VARCHAR(1024) NOT NULL,
  extraction_version VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('ACTIVE', 'QUARANTINED', 'DELETED')),
  quarantine_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tenant_project
  ON knowledge_sources (tenant_id, project_id, status);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  chunk_id VARCHAR(128) PRIMARY KEY,
  source_id VARCHAR(128) NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
  tenant_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  chunk_index INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  chunk_hash CHAR(64) NOT NULL,
  source_content_hash CHAR(64) NOT NULL,
  location VARCHAR(512) NOT NULL,
  classification VARCHAR(32) NOT NULL,
  extraction_version VARCHAR(64) NOT NULL,
  embedding vector(16) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant_project
  ON knowledge_chunks (tenant_id, project_id);
