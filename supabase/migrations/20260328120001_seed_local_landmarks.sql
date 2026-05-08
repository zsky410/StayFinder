-- Curated landmarks for Đà Nẵng (PLAN.md §2). Coordinates are approximate centroids / access points.
INSERT INTO local_landmarks (slug, name, kind, lat, lng, metadata)
VALUES
    ('dragon-bridge', 'Dragon Bridge (Cầu Rồng)', 'point', 16.0615, 108.2278, '{"area":"Hải Châu"}'::jsonb),
    ('my-khe-beach', 'My Khe Beach (Bãi biển Mỹ Khê)', 'point', 16.0564, 108.2474, '{"note":"Beach strip — use zones for large area"}'::jsonb),
    ('da-nang-airport', 'Da Nang International Airport (DAD)', 'point', 16.0439, 108.1995, '{"iata":"DAD"}'::jsonb),
    ('han-market', 'Han Market (Chợ Hàn)', 'point', 16.0678, 108.2221, '{}'::jsonb),
    ('son-tra-peninsula', 'Son Tra Peninsula (Bán đảo Sơn Trà)', 'point', 16.1199, 108.2519, '{"note":"Large area — point is illustrative"}'::jsonb),
    ('an-thuong', 'An Thuong (An Thượng)', 'point', 16.0504, 108.2467, '{"area":"Ngũ Hành Sơn"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    metadata = EXCLUDED.metadata;
