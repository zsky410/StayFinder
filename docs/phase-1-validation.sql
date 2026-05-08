-- StayFinder Phase 1 validation

SELECT COUNT(*) AS local_landmarks_count FROM local_landmarks;
SELECT COUNT(*) AS local_zones_count FROM local_zones;
SELECT COUNT(*) AS local_context_notes_count FROM local_context_notes;

SELECT
    COUNT(*) AS metrics_count,
    COUNT(DISTINCT place_id) AS places_with_metrics,
    COUNT(DISTINCT landmark_id) AS landmarks_with_metrics
FROM place_landmark_metrics;

SELECT
    l.slug,
    l.name,
    COUNT(m.place_id) AS place_count,
    MIN(m.distance_m) AS min_distance_m,
    MAX(m.distance_m) AS max_distance_m
FROM local_landmarks AS l
LEFT JOIN place_landmark_metrics AS m ON m.landmark_id = l.id
GROUP BY l.id, l.slug, l.name
ORDER BY l.slug;

SELECT
    p.place_id,
    p.title,
    l.slug AS landmark_slug,
    m.distance_m,
    m.method,
    m.anchor_label
FROM place_landmark_metrics AS m
JOIN places AS p ON p.id = m.place_id
JOIN local_landmarks AS l ON l.id = m.landmark_id
ORDER BY RANDOM()
LIMIT 20;
