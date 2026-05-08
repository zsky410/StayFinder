-- Phase 2 validation queries

SELECT COUNT(*)::bigint AS ai_place_chunks
FROM public.ai_place_chunks;

SELECT
    COUNT(*)::bigint AS chunks_total,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL)::bigint AS chunks_with_embeddings,
    COUNT(DISTINCT place_id)::bigint AS places_with_chunks
FROM public.ai_place_chunks;

SELECT
    metadata->>'chunk_kind' AS chunk_kind,
    COUNT(*)::bigint AS row_count
FROM public.ai_place_chunks
GROUP BY metadata->>'chunk_kind'
ORDER BY row_count DESC;

SELECT
    p.place_id,
    p.title,
    COUNT(c.id)::bigint AS chunk_count
FROM public.places p
LEFT JOIN public.ai_place_chunks c ON c.place_id = p.id
GROUP BY p.id, p.place_id, p.title
ORDER BY chunk_count DESC, p.title ASC
LIMIT 20;

SELECT COUNT(*)::bigint AS ai_review_summaries
FROM public.ai_review_summaries;

SELECT
    ars.model,
    COUNT(*)::bigint AS row_count
FROM public.ai_review_summaries ars
GROUP BY ars.model
ORDER BY row_count DESC, ars.model;
