-- Extensión pgvector para la BD efímera de Playwright E2E.
-- También se garantiza en postgres.Connect (ensureAiKnowledgeSchema).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
