-- Replace placeholder landmarks/zones with verified real-world data
-- and compute point-to-point / point-to-zone geodesic distances.

CREATE OR REPLACE FUNCTION public.geojson_polygon_rings(p_geom jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE jsonb_typeof(p_geom)
        WHEN 'object' THEN
            CASE p_geom->>'type'
                WHEN 'Polygon' THEN COALESCE(p_geom->'coordinates', '[]'::jsonb)
                WHEN 'MultiPolygon' THEN COALESCE((p_geom->'coordinates'->0), '[]'::jsonb)
                ELSE '[]'::jsonb
            END
        ELSE '[]'::jsonb
    END;
$$;

CREATE OR REPLACE FUNCTION public.point_in_geojson_polygon(
    p_lat double precision,
    p_lng double precision,
    p_geom jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    outer_ring jsonb;
    point_count integer;
    idx integer;
    jdx integer;
    xi double precision;
    yi double precision;
    xj double precision;
    yj double precision;
    intersects boolean := false;
    x double precision := p_lng;
    y double precision := p_lat;
BEGIN
    outer_ring := public.geojson_polygon_rings(p_geom)->0;
    point_count := COALESCE(jsonb_array_length(outer_ring), 0);
    IF point_count < 3 THEN
        RETURN false;
    END IF;

    jdx := point_count - 1;
    FOR idx IN 0..point_count - 1 LOOP
        xi := (outer_ring->idx->>0)::double precision;
        yi := (outer_ring->idx->>1)::double precision;
        xj := (outer_ring->jdx->>0)::double precision;
        yj := (outer_ring->jdx->>1)::double precision;

        IF ((yi > y) <> (yj > y))
           AND (x < ((xj - xi) * (y - yi) / NULLIF(yj - yi, 0) + xi)) THEN
            intersects := NOT intersects;
        END IF;
        jdx := idx;
    END LOOP;

    RETURN intersects;
END;
$$;

CREATE OR REPLACE FUNCTION public.distance_point_to_segment_m(
    p_lat double precision,
    p_lng double precision,
    a_lat double precision,
    a_lng double precision,
    b_lat double precision,
    b_lng double precision
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    lat_scale double precision := 111320.0;
    lng_scale double precision := COS(RADIANS((a_lat + b_lat + p_lat) / 3.0)) * 111320.0;
    px double precision := p_lng * lng_scale;
    py double precision := p_lat * lat_scale;
    ax double precision := a_lng * lng_scale;
    ay double precision := a_lat * lat_scale;
    bx double precision := b_lng * lng_scale;
    byy double precision := b_lat * lat_scale;
    dx double precision := bx - ax;
    dy double precision := byy - ay;
    t double precision;
    cx double precision;
    cy double precision;
BEGIN
    IF dx = 0 AND dy = 0 THEN
        RETURN public.haversine_meters(p_lat, p_lng, a_lat, a_lng);
    END IF;

    t := ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t := GREATEST(0, LEAST(1, t));
    cx := ax + t * dx;
    cy := ay + t * dy;

    RETURN ROUND(SQRT(POWER(px - cx, 2) + POWER(py - cy, 2)))::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.geojson_polygon_anchor(
    p_lat double precision,
    p_lng double precision,
    p_geom jsonb
)
RETURNS TABLE (
    anchor_lat double precision,
    anchor_lng double precision,
    distance_m integer
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    outer_ring jsonb;
    point_count integer;
    idx integer;
    next_idx integer;
    a_lng double precision;
    a_lat double precision;
    b_lng double precision;
    b_lat double precision;
    segment_distance integer;
    best_distance integer := NULL;
BEGIN
    IF public.point_in_geojson_polygon(p_lat, p_lng, p_geom) THEN
        RETURN QUERY SELECT p_lat, p_lng, 0;
        RETURN;
    END IF;

    outer_ring := public.geojson_polygon_rings(p_geom)->0;
    point_count := COALESCE(jsonb_array_length(outer_ring), 0);
    IF point_count < 2 THEN
        RETURN;
    END IF;

    FOR idx IN 0..point_count - 2 LOOP
        next_idx := idx + 1;
        a_lng := (outer_ring->idx->>0)::double precision;
        a_lat := (outer_ring->idx->>1)::double precision;
        b_lng := (outer_ring->next_idx->>0)::double precision;
        b_lat := (outer_ring->next_idx->>1)::double precision;

        segment_distance := public.distance_point_to_segment_m(
            p_lat,
            p_lng,
            a_lat,
            a_lng,
            b_lat,
            b_lng
        );

        IF best_distance IS NULL OR segment_distance < best_distance THEN
            best_distance := segment_distance;
            anchor_lat := (a_lat + b_lat) / 2.0;
            anchor_lng := (a_lng + b_lng) / 2.0;
            distance_m := segment_distance;
        END IF;
    END LOOP;

    RETURN NEXT;
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
        CASE WHEN l.kind = 'zone_ref' THEN 'osm-zone' ELSE 'haversine' END,
        now(),
        CASE
            WHEN l.kind = 'zone_ref' THEN zone_anchor.distance_m
            ELSE public.haversine_meters(p.lat, p.lng, l.lat, l.lng)
        END,
        CASE
            WHEN l.kind = 'zone_ref' THEN 'point_to_zone_geodesic'
            ELSE 'haversine'
        END,
        CASE
            WHEN l.kind = 'zone_ref' THEN z.name
            ELSE COALESCE(NULLIF(BTRIM(l.metadata->>'anchorLabel'), ''), l.name)
        END,
        CASE WHEN l.kind = 'zone_ref' THEN zone_anchor.anchor_lat ELSE l.lat END,
        CASE WHEN l.kind = 'zone_ref' THEN zone_anchor.anchor_lng ELSE l.lng END
    FROM places AS p
    JOIN local_landmarks AS l ON TRUE
    LEFT JOIN local_zones AS z
      ON l.kind = 'zone_ref'
     AND z.slug = COALESCE(NULLIF(BTRIM(l.metadata->>'zone_slug'), ''), l.slug)
    LEFT JOIN LATERAL public.geojson_polygon_anchor(p.lat, p.lng, z.geom) AS zone_anchor
      ON l.kind = 'zone_ref'
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND (
        (l.kind = 'point' AND l.lat IS NOT NULL AND l.lng IS NOT NULL)
        OR (l.kind = 'zone_ref' AND z.geom IS NOT NULL)
      )
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

DELETE FROM local_context_notes
WHERE COALESCE((metadata->>'placeholder')::boolean, false) = true;

DELETE FROM local_zones
WHERE slug IN ('airport-corridor', 'hai-chau-center');

INSERT INTO local_zones (slug, name, description, geom, metadata)
VALUES
    (
        'my-khe-strip',
        'My Khe Beach Strip',
        'OSM beach extent for Bãi biển Mỹ Khê used for point-to-zone distance.',
        '{"type":"Polygon","coordinates":[[[108.2492911,16.0488328],[108.2634873,16.1023869],[108.2459831,16.1023869],[108.2459831,16.0488328],[108.2492911,16.0488328]]]}',
        '{"source":"osm:relation","osm_id":19000664,"placeholder":false}'::jsonb
    ),
    (
        'an-thuong-zone',
        'An Thuong Area',
        'Derived polygon covering the named An Thuong street grid near My An beach area.',
        '{"type":"Polygon","coordinates":[[[108.2397841,16.0527901],[108.2421516,16.0527901],[108.2427480,16.0468775],[108.2420744,16.0468010],[108.2397841,16.0483940],[108.2397841,16.0527901]]]}',
        '{"source":"osm:derived-from-street-grid","placeholder":false}'::jsonb
    ),
    (
        'son-tra-south',
        'Son Tra Area',
        'OSM administrative area extent for Phường Sơn Trà as currently available public boundary backing Son Tra area distance.',
        '{"type":"Polygon","coordinates":[[[108.2264227,16.0787174],[108.2482085,16.0810042],[108.2639635,16.1009352],[108.2678787,16.0955583],[108.2699197,16.0973506],[108.3386414,16.1556476],[108.2090274,16.1556476],[108.2090274,16.0787174],[108.2264227,16.0787174]]]}',
        '{"source":"osm:relation","osm_id":13996982,"placeholder":false,"note":"Administrative Son Tra ward boundary used as available real public zone geometry"}'::jsonb
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    geom = EXCLUDED.geom,
    metadata = EXCLUDED.metadata;

INSERT INTO local_landmarks (slug, name, kind, lat, lng, metadata)
VALUES
    ('dragon-bridge', 'Dragon Bridge (Cầu Rồng)', 'point', 16.0611682, 108.2278968, '{"source":"osm:nominatim","osm_type":"way","osm_id":694831926,"area":"Phường An Hải","placeholder":false}'::jsonb),
    ('han-bridge', 'Han River Bridge (Cầu Sông Hàn)', 'point', 16.0721398, 108.2268106, '{"source":"osm:nominatim","osm_type":"node","osm_id":7276380289,"area":"Phường An Hải","placeholder":false}'::jsonb),
    ('han-market', 'Han Market (Chợ Hàn)', 'point', 16.0683555, 108.2244297, '{"source":"osm:nominatim","osm_type":"way","osm_id":204885903,"area":"Phường Hải Châu","placeholder":false}'::jsonb),
    ('da-nang-airport', 'Da Nang International Airport (DAD)', 'point', 16.0425792, 108.1971613, '{"source":"osm:nominatim","osm_type":"way","osm_id":217476265,"iata":"DAD","placeholder":false}'::jsonb),
    ('marble-mountains', 'Marble Mountains (Ngũ Hành Sơn)', 'point', 16.0040200, 108.2627745, '{"source":"osm:nominatim","osm_type":"relation","osm_id":8552348,"area":"Phường Ngũ Hành Sơn","placeholder":false}'::jsonb),
    ('my-khe-beach', 'My Khe Beach (Bãi biển Mỹ Khê)', 'zone_ref', 16.0756383, 108.2468740, '{"source":"osm:nominatim+overpass","osm_type":"relation","osm_id":19000664,"zone_slug":"my-khe-strip","placeholder":false}'::jsonb),
    ('an-thuong', 'An Thuong (An Thượng)', 'zone_ref', 16.0498000, 108.2413000, '{"source":"osm:derived","zone_slug":"an-thuong-zone","placeholder":false,"note":"Derived from named An Thuong street grid in OSM"}'::jsonb),
    ('son-tra-peninsula', 'Son Tra Peninsula (Bán đảo Sơn Trà)', 'zone_ref', 16.1021731, 108.2485821, '{"source":"osm:nominatim+overpass","osm_type":"relation","osm_id":13996982,"zone_slug":"son-tra-south","placeholder":false}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    metadata = EXCLUDED.metadata;
