-- StayFinder / codex-crawl: core schema (PLAN.md §1)
-- Requires: Postgres 15+ (Supabase default). Run via Supabase CLI or psql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ---------------------------------------------------------------------------
-- Batches (one row per import run)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crawl_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_key text NOT NULL UNIQUE,
    source_path text,
    notes text,
    row_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Places (idempotent key: google place_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS places (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid REFERENCES crawl_batches (id) ON DELETE SET NULL,
    place_id text NOT NULL UNIQUE,
    type_slug text NOT NULL,
    type_label text,
    crawl_category_labels text[] NOT NULL DEFAULT '{}',
    title text,
    description text,
    category_name text,
    address text,
    neighborhood text,
    district text,
    street text,
    city text,
    postal_code text,
    state text,
    country_code text,
    phone text,
    website text,
    lat double precision,
    lng double precision,
    rating numeric(4, 2),
    reviews_count integer,
    reviews_distribution jsonb,
    images_count integer,
    price_text text,
    hotel_stars integer,
    hotel_description text,
    check_in_date text,
    check_out_date text,
    scraped_at timestamptz,
    url text,
    search_page_url text,
    search_string text,
    language text,
    rank integer,
    is_advertisement boolean,
    image_url text,
    plus_code text,
    popular_times_live_text text,
    opening_hours jsonb,
    hotel_ads jsonb,
    additional_info jsonb,
    categories text[],
    crawl_search_terms text[],
    has_phone boolean NOT NULL GENERATED ALWAYS AS (phone IS NOT NULL AND btrim(phone) <> '') STORED,
    has_website boolean NOT NULL GENERATED ALWAYS AS (website IS NOT NULL AND btrim(website) <> '') STORED,
    raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_places_type_slug ON places (type_slug);
CREATE INDEX IF NOT EXISTS idx_places_district ON places (district);
CREATE INDEX IF NOT EXISTS idx_places_neighborhood ON places (neighborhood);
CREATE INDEX IF NOT EXISTS idx_places_rating ON places (rating);
CREATE INDEX IF NOT EXISTS idx_places_reviews_count ON places (reviews_count);
CREATE INDEX IF NOT EXISTS idx_places_lat_lng ON places (lat, lng);

CREATE OR REPLACE FUNCTION set_places_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_places_updated_at ON places;
CREATE TRIGGER trg_places_updated_at
    BEFORE UPDATE ON places
    FOR EACH ROW EXECUTE PROCEDURE set_places_updated_at();

-- ---------------------------------------------------------------------------
-- Images (normalized URLs; gallery from crawl)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS place_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    image_url text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_place_images_place ON place_images (place_id);

-- ---------------------------------------------------------------------------
-- Reviews (sample from compact crawl)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    source_review_id text,
    stars integer,
    review_text text,
    text_translated text,
    publish_at text,
    published_at timestamptz,
    likes_count integer,
    review_origin text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews (place_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_place_source
    ON reviews (place_id, source_review_id)
    WHERE source_review_id IS NOT NULL AND btrim(source_review_id) <> '';

-- ---------------------------------------------------------------------------
-- Amenities (dimension + M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amenities (
    id serial PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    label text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS place_amenities (
    place_id uuid NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    amenity_id integer NOT NULL REFERENCES amenities (id) ON DELETE CASCADE,
    PRIMARY KEY (place_id, amenity_id)
);

-- ---------------------------------------------------------------------------
-- Local context (curated; metrics filled by OSRM job later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS local_landmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'point' CHECK (kind IN ('point', 'zone_ref')),
    lat double precision,
    lng double precision,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS local_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    -- GeoJSON polygon or multipolygon for future map use
    geom jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS place_landmark_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    landmark_id uuid NOT NULL REFERENCES local_landmarks (id) ON DELETE CASCADE,
    walking_distance_m integer,
    walking_duration_s integer,
    driving_distance_m integer,
    driving_duration_s integer,
    source text NOT NULL DEFAULT 'osrm',
    computed_at timestamptz,
    UNIQUE (place_id, landmark_id)
);

CREATE INDEX IF NOT EXISTS idx_plm_place ON place_landmark_metrics (place_id);
CREATE INDEX IF NOT EXISTS idx_plm_landmark ON place_landmark_metrics (landmark_id);

-- ---------------------------------------------------------------------------
-- AI / RAG (embeddings optional until pipeline runs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_place_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    chunk_index integer NOT NULL DEFAULT 0,
    content text NOT NULL,
    content_md5 text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (place_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_place ON ai_place_chunks (place_id);

-- ---------------------------------------------------------------------------
-- Row level security: public read for demo API (service role bypasses RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE crawl_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_landmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_landmark_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_place_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crawl_batches_select_all" ON crawl_batches FOR SELECT USING (true);
CREATE POLICY "places_select_all" ON places FOR SELECT USING (true);
CREATE POLICY "place_images_select_all" ON place_images FOR SELECT USING (true);
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT USING (true);
CREATE POLICY "amenities_select_all" ON amenities FOR SELECT USING (true);
CREATE POLICY "place_amenities_select_all" ON place_amenities FOR SELECT USING (true);
CREATE POLICY "local_landmarks_select_all" ON local_landmarks FOR SELECT USING (true);
CREATE POLICY "local_zones_select_all" ON local_zones FOR SELECT USING (true);
CREATE POLICY "place_landmark_metrics_select_all" ON place_landmark_metrics FOR SELECT USING (true);
CREATE POLICY "ai_place_chunks_select_all" ON ai_place_chunks FOR SELECT USING (true);
