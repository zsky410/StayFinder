-- StayFinder Phase 1 foundation:
-- - placeholder local landmarks / zones / context notes
-- - straight-line distance metrics using haversine

ALTER TABLE place_landmark_metrics
    ADD COLUMN IF NOT EXISTS distance_m integer,
    ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'haversine',
    ADD COLUMN IF NOT EXISTS anchor_label text,
    ADD COLUMN IF NOT EXISTS anchor_lat double precision,
    ADD COLUMN IF NOT EXISTS anchor_lng double precision;

ALTER TABLE place_landmark_metrics
    ALTER COLUMN source SET DEFAULT 'haversine';

CREATE INDEX IF NOT EXISTS idx_plm_landmark_distance_m
    ON place_landmark_metrics (landmark_id, distance_m);

CREATE INDEX IF NOT EXISTS idx_plm_place_distance_m
    ON place_landmark_metrics (place_id, distance_m);

CREATE TABLE IF NOT EXISTS local_context_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    subject_kind text NOT NULL CHECK (subject_kind IN ('city', 'zone', 'landmark')),
    subject_slug text,
    content text NOT NULL,
    tags text[] NOT NULL DEFAULT '{}',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_context_notes_subject
    ON local_context_notes (subject_kind, subject_slug);

ALTER TABLE local_context_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'local_context_notes'
          AND policyname = 'local_context_notes_select_all'
    ) THEN
        EXECUTE 'CREATE POLICY "local_context_notes_select_all" ON local_context_notes FOR SELECT USING (true)';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.haversine_meters(
    lat1 double precision,
    lng1 double precision,
    lat2 double precision,
    lng2 double precision
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
        ELSE ROUND(
            6371000 * 2 * ASIN(
                SQRT(
                    POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
                    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
                    POWER(SIN(RADIANS(lng2 - lng1) / 2), 2)
                )
            )
        )::integer
    END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_place_landmark_metrics(
    p_place_ids uuid[] DEFAULT NULL,
    p_landmark_slugs text[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    affected_rows integer := 0;
BEGIN
    INSERT INTO place_landmark_metrics (
        id,
        place_id,
        landmark_id,
        walking_distance_m,
        walking_duration_s,
        driving_distance_m,
        driving_duration_s,
        source,
        computed_at,
        distance_m,
        method,
        anchor_label,
        anchor_lat,
        anchor_lng
    )
    SELECT
        gen_random_uuid(),
        p.id,
        l.id,
        NULL,
        NULL,
        NULL,
        NULL,
        'haversine',
        now(),
        public.haversine_meters(p.lat, p.lng, l.lat, l.lng),
        'haversine',
        COALESCE(NULLIF(BTRIM(l.metadata->>'anchorLabel'), ''), l.name),
        l.lat,
        l.lng
    FROM places AS p
    CROSS JOIN local_landmarks AS l
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND l.kind = 'point'
      AND l.lat IS NOT NULL
      AND l.lng IS NOT NULL
      AND (p_place_ids IS NULL OR p.id = ANY (p_place_ids))
      AND (p_landmark_slugs IS NULL OR l.slug = ANY (p_landmark_slugs))
    ON CONFLICT (place_id, landmark_id) DO UPDATE SET
        walking_distance_m = NULL,
        walking_duration_s = NULL,
        driving_distance_m = NULL,
        driving_duration_s = NULL,
        source = EXCLUDED.source,
        computed_at = EXCLUDED.computed_at,
        distance_m = EXCLUDED.distance_m,
        method = EXCLUDED.method,
        anchor_label = EXCLUDED.anchor_label,
        anchor_lat = EXCLUDED.anchor_lat,
        anchor_lng = EXCLUDED.anchor_lng;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$;

INSERT INTO local_landmarks (slug, name, kind, lat, lng, metadata)
VALUES
    ('dragon-bridge', 'Cầu Rồng', 'point', 16.0615, 108.2278, '{"area":"Hải Châu","phase":"phase1","placeholder":true}'::jsonb),
    ('han-bridge', 'Cầu Sông Hàn', 'point', 16.0719, 108.2244, '{"area":"Hải Châu","phase":"phase1","placeholder":true}'::jsonb),
    ('my-khe-beach', 'Bãi biển Mỹ Khê', 'point', 16.0564, 108.2474, '{"area":"Sơn Trà / Ngũ Hành Sơn","phase":"phase1","placeholder":true,"anchorLabel":"Bãi biển Mỹ Khê"}'::jsonb),
    ('da-nang-airport', 'Sân bay Đà Nẵng', 'point', 16.0439, 108.1995, '{"iata":"DAD","phase":"phase1","placeholder":true}'::jsonb),
    ('han-market', 'Chợ Hàn', 'point', 16.0678, 108.2221, '{"area":"Hải Châu","phase":"phase1","placeholder":true}'::jsonb),
    ('son-tra-peninsula', 'Bán đảo Sơn Trà', 'point', 16.1199, 108.2519, '{"area":"Sơn Trà","phase":"phase1","placeholder":true,"anchorLabel":"Bán đảo Sơn Trà","note":"Representative point only; refine later with real anchors"}'::jsonb),
    ('an-thuong', 'An Thượng', 'point', 16.0504, 108.2467, '{"area":"Ngũ Hành Sơn","phase":"phase1","placeholder":true,"anchorLabel":"An Thượng"}'::jsonb),
    ('marble-mountains', 'Ngũ Hành Sơn', 'point', 16.0037, 108.2641, '{"area":"Ngũ Hành Sơn","phase":"phase1","placeholder":true}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    metadata = EXCLUDED.metadata;

INSERT INTO local_zones (slug, name, description, geom, metadata)
VALUES
    ('hai-chau-center', 'Trung tâm Hải Châu', 'Placeholder zone for central Da Nang around Han River and civic core.', NULL, '{"phase":"phase1","placeholder":true}'::jsonb),
    ('my-khe-strip', 'Dải biển Mỹ Khê', 'Placeholder beachfront zone for stays marketed as close to My Khe.', NULL, '{"phase":"phase1","placeholder":true}'::jsonb),
    ('an-thuong-zone', 'Khu An Thượng', 'Placeholder zone for the An Thuong expat and cafe area.', NULL, '{"phase":"phase1","placeholder":true}'::jsonb),
    ('son-tra-south', 'Khu Sơn Trà', 'Placeholder zone for coastal Son Tra stays with beach access.', NULL, '{"phase":"phase1","placeholder":true}'::jsonb),
    ('airport-corridor', 'Khu vực sân bay Đà Nẵng', 'Placeholder zone for quick-access stays near Da Nang airport.', NULL, '{"phase":"phase1","placeholder":true}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    geom = EXCLUDED.geom,
    metadata = EXCLUDED.metadata;

INSERT INTO local_context_notes (slug, title, subject_kind, subject_slug, content, tags, metadata)
VALUES
    (
        'danang-overview',
        'Da Nang Overview',
        'city',
        'da-nang',
        'Da Nang is best handled as a city with three common stay intents in this demo: beach access, airport convenience, and central riverfront access.',
        ARRAY['city', 'overview', 'stayfinder'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    ),
    (
        'dragon-bridge-weekend',
        'Dragon Bridge Weekend Note',
        'landmark',
        'dragon-bridge',
        'Dragon Bridge is a strong anchor for users who want central nightlife and easy access to the Han River corridor. Treat this as a central-city landmark in recommendations.',
        ARRAY['landmark', 'central', 'weekend'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    ),
    (
        'han-bridge-riverside',
        'Han River Bridge Riverside Note',
        'landmark',
        'han-bridge',
        'Han River Bridge is useful for recommendations that emphasize riverfront access, downtown connectivity, and convenient movement between Hai Chau and Son Tra.',
        ARRAY['landmark', 'riverfront', 'downtown'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    ),
    (
        'my-khe-beach-stays',
        'My Khe Beach Stay Note',
        'landmark',
        'my-khe-beach',
        'My Khe is a primary beach anchor. In v1, a place close to this point can be explained as suitable for beach-oriented stays, but this should be refined later with better shoreline anchors.',
        ARRAY['landmark', 'beach', 'stay'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    ),
    (
        'an-thuong-neighborhood',
        'An Thuong Neighborhood Note',
        'zone',
        'an-thuong-zone',
        'An Thuong is commonly treated as a lively cafe and expat-friendly area. Use it as a lifestyle context signal, not as proof of nightlife quality or safety.',
        ARRAY['zone', 'lifestyle', 'food'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    ),
    (
        'son-tra-scenic-context',
        'Son Tra Scenic Context',
        'landmark',
        'son-tra-peninsula',
        'Son Tra should be treated as a scenic nature anchor. The current representative point is temporary and should later be replaced by multiple access anchors.',
        ARRAY['landmark', 'nature', 'scenic'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    ),
    (
        'airport-convenience-context',
        'Airport Convenience Context',
        'zone',
        'airport-corridor',
        'Airport proximity is useful for overnight arrivals, short stays, and early departures. Recommendations should mention convenience rather than tourist experience.',
        ARRAY['zone', 'airport', 'convenience'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    ),
    (
        'marble-mountains-visit-context',
        'Marble Mountains Visit Context',
        'landmark',
        'marble-mountains',
        'Marble Mountains can be used as a cultural and sightseeing anchor for users who prefer the south-east side of the city and day-trip convenience.',
        ARRAY['landmark', 'sightseeing', 'culture'],
        '{"phase":"phase1","placeholder":true}'::jsonb
    )
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    subject_kind = EXCLUDED.subject_kind,
    subject_slug = EXCLUDED.subject_slug,
    content = EXCLUDED.content,
    tags = EXCLUDED.tags,
    metadata = EXCLUDED.metadata;
