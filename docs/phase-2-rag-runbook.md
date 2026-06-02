# Phase 2 RAG Runbook

Runbook này chuẩn hóa cách build chỉ mục RAG LangChain cho StayFinder sau khi Phase 0 và Phase 1 đã xong.

## 1. Scope của Phase 2

Phase 2 trong repo hiện tại gồm:

- build `ai_place_chunks` từ DB đã import, tách theo nhiều `chunk_kind`
- split chunk bằng `RecursiveCharacterTextSplitter`
- embed bằng `text-embedding-3-small` (`1536` dimensions)
- query prototype với:
  - structured intent parsing
  - structured DB filtering
  - semantic retrieval trên `ai_place_chunks`
  - local context injection
- cache `ai_review_summaries`

## 2. Preconditions

### DB

- Remote Supabase đã có:
  - Phase 0 schema
  - Phase 1 landmarks/context
  - migration `20260508143000_phase2_rag_support.sql`

### Python deps

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### Environment

Thiết lập tối thiểu:

- `DATABASE_URL` hoặc `SUPABASE_DB_URL`
- hoặc `PGHOST` + `PGPASSWORD` + `PGUSER` + `PGDATABASE`

Cho embedding:

- `OPENAI_API_KEY`
- hoặc `RAG_EMBED_API_KEY`

Cho generate answer / review summary:

- mặc định repo hiện support `openai_compatible`
- nếu dùng local gateway như `http://127.0.0.1:39647/v1`:
  - `RAG_CHAT_PROVIDER=openai_compatible`
  - `RAG_CHAT_API_KEY=agt_codex_your_local_gateway_key`
  - `RAG_CHAT_BASE_URL=http://127.0.0.1:39647/v1`
  - `RAG_CHAT_MODEL=gpt-5.5`
- nếu muốn dùng Anthropic trực tiếp:
  - `RAG_CHAT_PROVIDER=anthropic`
  - `ANTHROPIC_API_KEY=...`

Biến tùy chọn:

- `RAG_EMBED_MODEL=text-embedding-3-small`
- `RAG_EMBED_BASE_URL=...`
- `RAG_CHAT_MODEL=gpt-5.5`

## 3. Build chunk index

### Build toàn batch v1

```bash
.venv/bin/python scripts/phase2_rag.py chunk \
  --batch-key danang_accommodations_batch_20260323_082743
```

### Dry run

```bash
.venv/bin/python scripts/phase2_rag.py chunk \
  --batch-key danang_accommodations_batch_20260323_082743 \
  --dry-run
```

### Build cho 1 place cụ thể

```bash
.venv/bin/python scripts/phase2_rag.py chunk \
  --place-id ChIJbeO3ddMZQjERzeIxy-6JpYc
```

## 4. Embed chunks

```bash
.venv/bin/python scripts/phase2_rag.py embed \
  --batch-key danang_accommodations_batch_20260323_082743
```

Re-embed toàn bộ:

```bash
.venv/bin/python scripts/phase2_rag.py embed \
  --batch-key danang_accommodations_batch_20260323_082743 \
  --refresh
```

## 5. Validate index

Chạy validation JSON trực tiếp từ pipeline:

```bash
.venv/bin/python scripts/phase2_rag.py validate \
  --batch-key danang_accommodations_batch_20260323_082743
```

Kỳ vọng production cho batch v1:

- `healthy: true`
- `places_without_chunks: 0`
- `chunks_missing_embeddings: 0`
- `chunks_with_stale_hash: 0`
- có `idx_ai_place_chunks_embedding_cosine`
- `chunk_kinds` có nhiều nhóm, tối thiểu gồm `place_profile`; dữ liệu đầy đủ thường có thêm `amenity_profile`, `landmark_proximity`, `review_snippets`, `local_context`

Nếu chỉ muốn audit mà không fail job/CI:

```bash
.venv/bin/python scripts/phase2_rag.py validate \
  --batch-key danang_accommodations_batch_20260323_082743 \
  --allow-unhealthy
```

## 6. Query prototype

### JSON output

```bash
.venv/bin/python scripts/phase2_rag.py query \
  "khách sạn gần cầu rồng cho gia đình" \
  --json
```

### Có generate answer bằng provider đang cấu hình

```bash
.venv/bin/python scripts/phase2_rag.py query \
  "homestay gần biển có wifi" \
  --generate
```

Mặc định nếu không đổi env, lệnh trên sẽ dùng `openai_compatible` + `gpt-5.4`.

Ghi chú:

- Nếu không có `OPENAI_API_KEY` hoặc `RAG_EMBED_API_KEY`, semantic retrieval sẽ không chạy.
- Nếu chat provider là local OpenAI-compatible API, script sẽ dùng `RAG_CHAT_BASE_URL` + `RAG_CHAT_API_KEY`.
- Nếu endpoint chat của bạn **không có** `/embeddings`, bạn vẫn cần một provider embeddings riêng cho bước `embed`.

## 7. AI review summary

### Heuristic fallback

```bash
.venv/bin/python scripts/phase2_rag.py review-summary \
  --place-id ChIJbeO3ddMZQjERzeIxy-6JpYc
```

### LLM-based summary theo provider cấu hình

```bash
.venv/bin/python scripts/phase2_rag.py review-summary \
  --place-id ChIJbeO3ddMZQjERzeIxy-6JpYc \
  --use-llm \
  --refresh
```

Ghi chú:

- Cờ chính là `--use-llm`; `--use-claude` vẫn được giữ lại để tương thích lệnh cũ.
- Khi bật cờ này, script sẽ dùng chat provider đang cấu hình (`openai_compatible` hoặc `anthropic`) thay vì heuristic fallback.

## 8. SQL validation

Chạy:

```bash
psql "$DATABASE_URL" -f docs/phase-2-validation.sql
```

Hoặc copy query từ file vào Supabase SQL Editor.

Kỳ vọng sau khi build + embed:

- `ai_place_chunks` có dữ liệu
- `chunks_with_embeddings` > `0`
- `places_with_chunks` gần bằng `1646`
- `ai_review_summaries` tăng dần khi generate summary

## 9. Rebuild chuẩn sau khi đổi chunk logic

Khi code chunking thay đổi, cần rebuild theo thứ tự:

```bash
.venv/bin/python scripts/phase2_rag.py chunk \
  --batch-key danang_accommodations_batch_20260323_082743

.venv/bin/python scripts/phase2_rag.py embed \
  --batch-key danang_accommodations_batch_20260323_082743

.venv/bin/python scripts/phase2_rag.py validate \
  --batch-key danang_accommodations_batch_20260323_082743
```

`chunk` sẽ xóa và ghi lại chunks của place được chọn, nên embedding cũ của các place đó không còn. Luôn chạy `embed` sau khi rebuild chunk.

## 10. Không thuộc Phase 2

- mobile UI
- backend Express API
- admin CRUD
- chat history đa lượt
- production prompt orchestration
