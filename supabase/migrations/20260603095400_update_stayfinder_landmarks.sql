-- Standardize StayFinder landmarks to the final Vietnamese point/zone list.

INSERT INTO local_zones (slug, name, description, geom, metadata)
VALUES
    (
        'son-tra-peninsula-zone',
        'Bán đảo Sơn Trà',
        'Khu vực bán đảo Sơn Trà dùng cho truy vấn theo vùng rộng.',
        '{"type":"Polygon","coordinates":[[[108.2264227,16.0787174],[108.2482085,16.0810042],[108.2639635,16.1009352],[108.2678787,16.0955583],[108.2699197,16.0973506],[108.3386414,16.1556476],[108.2090274,16.1556476],[108.2090274,16.0787174],[108.2264227,16.0787174]]]}',
        '{"source":"curated","center_lat":16.1000,"center_lng":108.2667}'::jsonb
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    geom = EXCLUDED.geom,
    metadata = EXCLUDED.metadata;

INSERT INTO local_landmarks (slug, name, kind, lat, lng, metadata)
VALUES
    ('son-tra-peninsula', 'Bán đảo Sơn Trà', 'zone_ref', 16.1000, 108.2667, '{"zone_slug":"son-tra-peninsula-zone","zone":"Bán đảo Sơn Trà","classification":"zone","source":"curated"}'::jsonb),
    ('son-tra-night-market', 'Chợ đêm Sơn Trà', 'point', 16.0618, 108.2325, '{"zone":"Bờ Đông Sông Hàn (Quận Sơn Trà)","classification":"point","source":"curated"}'::jsonb),
    ('helio-night-market', 'Chợ đêm Helio', 'point', 16.0390, 108.2255, '{"zone":"Khu công viên Đông Nam Đài Tưởng Niệm (Quận Hải Châu)","classification":"point","source":"curated"}'::jsonb),
    ('dragon-bridge', 'Cầu Rồng', 'point', 16.0611, 108.2274, '{"zone":"Trung tâm thành phố / Sông Hàn","classification":"point","source":"curated"}'::jsonb),
    ('da-nang-airport', 'Sân bay Đà Nẵng', 'point', 16.0544, 108.2023, '{"zone":"Quận Hải Châu / Thanh Khê","classification":"point","source":"curated"}'::jsonb),
    ('east-sea-park', 'Công viên Biển Đông', 'point', 16.0664, 108.2471, '{"zone":"Dải bờ biển Võ Nguyên Giáp (Quận Sơn Trà)","classification":"point","source":"curated"}'::jsonb),
    ('con-market', 'Chợ Cồn', 'point', 16.0655, 108.2160, '{"zone":"Trung tâm thành phố (Quận Hải Châu)","classification":"point","source":"curated"}'::jsonb),
    ('han-market', 'Chợ Hàn', 'point', 16.0682, 108.2241, '{"zone":"Trung tâm thành phố / Ven Sông Hàn (Quận Hải Châu)","classification":"point","source":"curated"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    metadata = EXCLUDED.metadata;

DELETE FROM local_landmarks
WHERE slug NOT IN (
    'son-tra-peninsula',
    'son-tra-night-market',
    'helio-night-market',
    'dragon-bridge',
    'da-nang-airport',
    'east-sea-park',
    'con-market',
    'han-market'
);

SELECT public.refresh_place_landmark_metrics(NULL, NULL);
