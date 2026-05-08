-- StayFinder Phase 2 RAG support:
-- - vector index for ai_place_chunks retrieval
-- - cached AI review summaries

CREATE INDEX IF NOT EXISTS idx_ai_place_chunks_metadata_gin
    ON ai_place_chunks USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_ai_place_chunks_embedding_cosine
    ON ai_place_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS ai_review_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL UNIQUE REFERENCES places (id) ON DELETE CASCADE,
    summary_text text NOT NULL,
    bullets jsonb NOT NULL DEFAULT '[]'::jsonb,
    model text,
    prompt_version text,
    source_review_count integer NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_review_summaries_place
    ON ai_review_summaries (place_id);

CREATE OR REPLACE FUNCTION set_ai_review_summaries_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_review_summaries_updated_at ON ai_review_summaries;
CREATE TRIGGER trg_ai_review_summaries_updated_at
    BEFORE UPDATE ON ai_review_summaries
    FOR EACH ROW EXECUTE PROCEDURE set_ai_review_summaries_updated_at();

ALTER TABLE ai_review_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ai_review_summaries'
          AND policyname = 'ai_review_summaries_select_all'
    ) THEN
        EXECUTE 'CREATE POLICY "ai_review_summaries_select_all" ON ai_review_summaries FOR SELECT USING (true)';
    END IF;
END;
$$;
