# Phase 2 RAG Runbook

Runbook này chuẩn hóa cách build chỉ mục RAG LangChain cho StayFinder sau khi Phase 0 và Phase 1 đã xong.

## 1. Scope của Phase 2

Phase 2 trong repo hiện tại gồm:

- build `ai_place_chunks` từ DB đã import
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
  - `RAG_CHAT_API_KEY=...`
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

## 5. Query prototype

### JSON output

```bash
.venv/bin/python scripts/phase2_rag.py query \
  "khách sạn gần cầu rồng cho gia đình" \
  --json
```

### Có generate answer bằng Claude

```bash
.venv/bin/python scripts/phase2_rag.py query \
  "homestay gần biển có wifi" \
  --generate
```

Ghi chú:

- Nếu không có `OPENAI_API_KEY` hoặc `RAG_EMBED_API_KEY`, semantic retrieval sẽ không chạy.
- Nếu chat provider là local OpenAI-compatible API, script sẽ dùng `RAG_CHAT_BASE_URL` + `RAG_CHAT_API_KEY`.
- Nếu endpoint chat của bạn **không có** `/embeddings`, bạn vẫn cần một provider embeddings riêng cho bước `embed`.

## 6. AI review summary

### Heuristic fallback

```bash
.venv/bin/python scripts/phase2_rag.py review-summary \
  --place-id ChIJbeO3ddMZQjERzeIxy-6JpYc
```

### Claude-based summary

```bash
.venv/bin/python scripts/phase2_rag.py review-summary \
  --place-id ChIJbeO3ddMZQjERzeIxy-6JpYc \
  --use-claude \
  --refresh
```

## 7. Validation

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

## 8. Không thuộc Phase 2

- mobile UI
- backend Express API
- admin CRUD
- chat history đa lượt
- production prompt orchestration
