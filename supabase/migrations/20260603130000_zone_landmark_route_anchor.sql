-- Zone landmarks should route to their curated representative point (l.lat/l.lng),
-- not the nearest point on the zone polygon (which understates road distance).

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
        CASE WHEN l.kind = 'zone_ref' THEN 'osm-zone' ELSE 'haversine' END,
        now(),
        public.haversine_meters(p.lat, p.lng, l.lat, l.lng),
        CASE WHEN l.kind = 'zone_ref' THEN 'zone_landmark_point' ELSE 'haversine' END,
        COALESCE(NULLIF(BTRIM(l.metadata->>'anchorLabel'), ''), l.name),
        l.lat,
        l.lng
    FROM places AS p
    JOIN local_landmarks AS l ON TRUE
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
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

SELECT public.refresh_place_landmark_metrics(NULL, NULL);
