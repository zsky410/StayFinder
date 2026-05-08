-- StayFinder Phase 0 validation
-- Expected batch key: danang_accommodations_batch_20260323_082743

SELECT batch_key, row_count, created_at
FROM crawl_batches
WHERE batch_key = 'danang_accommodations_batch_20260323_082743';

SELECT
    COUNT(*) AS total_places,
    COUNT(DISTINCT place_id) AS distinct_place_ids
FROM places;

SELECT type_slug, COUNT(*) AS place_count
FROM places
GROUP BY type_slug
ORDER BY type_slug;

SELECT
    COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS places_with_coordinates,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL AND btrim(image_url) <> '') AS places_with_cover_image,
    COUNT(*) FILTER (WHERE reviews_count IS NOT NULL) AS places_with_reviews_count,
    COUNT(*) FILTER (WHERE phone IS NOT NULL AND btrim(phone) <> '') AS places_with_phone,
    COUNT(*) FILTER (WHERE website IS NOT NULL AND btrim(website) <> '') AS places_with_website
FROM places;

SELECT COUNT(*) AS place_images_count FROM place_images;
SELECT COUNT(*) AS reviews_count FROM reviews;
SELECT COUNT(*) AS amenities_count FROM amenities;
SELECT COUNT(*) AS place_amenities_count FROM place_amenities;
SELECT COUNT(*) AS local_landmarks_count FROM local_landmarks;

SELECT
    p.place_id,
    p.title,
    p.type_slug,
    p.rating,
    p.reviews_count,
    p.lat,
    p.lng,
    p.image_url
FROM places AS p
ORDER BY RANDOM()
LIMIT 10;

SELECT
    p.place_id,
    p.title,
    COUNT(pi.id) AS gallery_count
FROM places AS p
JOIN place_images AS pi ON pi.place_id = p.id
GROUP BY p.id, p.place_id, p.title
ORDER BY gallery_count DESC, p.title
LIMIT 10;

SELECT
    p.place_id,
    p.title,
    COUNT(r.id) AS review_rows
FROM places AS p
JOIN reviews AS r ON r.place_id = p.id
GROUP BY p.id, p.place_id, p.title
ORDER BY review_rows DESC, p.title
LIMIT 10;

SELECT
    p.place_id,
    p.title,
    COUNT(pa.amenity_id) AS amenity_count
FROM places AS p
JOIN place_amenities AS pa ON pa.place_id = p.id
GROUP BY p.id, p.place_id, p.title
ORDER BY amenity_count DESC, p.title
LIMIT 10;
