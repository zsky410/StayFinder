# StayFinder Crawl Workspace

Workspace chuẩn bị dữ liệu cho đồ án **StayFinder**. Từ Phase 0, repo này được dùng để:

- khóa dataset v1 cho backend/mobile/RAG
- chuẩn hóa import vào Supabase/Postgres
- giữ crawler và pipeline dữ liệu ở vai trò hỗ trợ cho app/mobile

Web demo cũ đã được loại khỏi repo. Hướng triển khai hiện tại là build lại theo roadmap mới, với **mobile app** là sản phẩm chính.

## Phase 0 Freeze

- Frozen batch v1: `output/danang_accommodations_batch_20260323_082743/`
- Source of truth v1: `all_types_compact_combined.json`
- Archive/debug source: `all_types_raw_combined.json`
- Batch key chính thức: `danang_accommodations_batch_20260323_082743`
- Phase 0 không recrawl, không đổi batch, không merge batch khác vào v1

Tài liệu canonical:

- [CURRENT_STATE.md](./CURRENT_STATE.md): trạng thái Phase 0, coverage dữ liệu, known issues
- [PLAN.md](./PLAN.md): roadmap tổng thể sau khi đã chốt data foundation
- [docs/phase-0-db-import-runbook.md](./docs/phase-0-db-import-runbook.md): runbook migrate/import/verify DB
- [docs/phase-2-rag-runbook.md](./docs/phase-2-rag-runbook.md): runbook build chunk/embed/query cho RAG LangChain

## Repo Map

- `scripts/`: crawler và importer vào Supabase
- `examples/`: input mẫu cho các job crawl
- `output/`: batch crawl local/private, đang gitignore
- `supabase/`: schema baseline và seed data cho DB
- `about.md`: mô tả đề tài và định hướng hệ thống

## Yêu cầu

- Python 3.10+
- `APIFY_TOKEN` nếu cần recrawl
- Credential DB Supabase nếu cần migrate/import remote

## Thiết lập nhanh

### Python

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### Node.js backend (Phase 3)

```bash
npm install
npm run dev
```

Backend mặc định chạy ở `http://localhost:3000`.
Public API không cần auth; admin API cần `Authorization: Bearer <ADMIN_API_TOKEN>` hoặc header `x-admin-token`.

## Script chính

### Crawl demo Google Maps

```bash
.venv/bin/python scripts/apify_google_maps_demo.py
```

### Crawl batch chỗ lưu trú Đà Nẵng

```bash
.venv/bin/python scripts/apify_danang_accommodations_batch.py
```

### Import compact dataset vào Supabase/Postgres

```bash
.venv/bin/python scripts/import_compact_to_supabase.py \
  output/danang_accommodations_batch_20260323_082743/all_types_compact_combined.json \
  --batch-key danang_accommodations_batch_20260323_082743
```

### Build Phase 2 RAG index

```bash
.venv/bin/python scripts/phase2_rag.py chunk \
  --batch-key danang_accommodations_batch_20260323_082743

.venv/bin/python scripts/phase2_rag.py embed \
  --batch-key danang_accommodations_batch_20260323_082743
```

### Chạy Backend Phase 3

```bash
npm run dev
```

Public endpoints v1:

- `GET /health`
- `GET /places`
- `GET /places/:id`
- `GET /places/map`
- `GET /filters/meta`
- `GET /landmarks`
- `POST /chat/query`
- `POST /ai/review-summary`

Admin endpoints v1:

- `GET|POST|PATCH|DELETE /admin/places`
- `GET|POST|PATCH|DELETE /admin/landmarks`
- `GET|POST|PATCH|DELETE /admin/local-context-notes`
- `GET /admin/jobs`
- `GET /admin/jobs/:id`
- `POST /admin/jobs/distance/rebuild`
- `POST /admin/jobs/chunks/rebuild`
- `POST /admin/jobs/embeddings/rebuild`
- `POST /admin/jobs/review-summaries/rebuild`

Ghi chú:

- Chat và AI review summary của backend Phase 3 đang reuse trực tiếp `scripts/phase2_rag.py` để giữ cùng retrieval/generation behavior với Phase 2.
- Endpoint rebuild distance gọi SQL function `refresh_place_landmark_metrics(...)`; endpoint AI jobs gọi lại pipeline Python theo `batchKey` hoặc `placeIds`.
- Ví dụ query nên dùng tiếng Việt có dấu như: `cho tôi gợi ý nơi ở view đẹp ven sông Hàn` hoặc `khách sạn gần Cầu Rồng cho gia đình`.
- Các admin job endpoint mặc định chạy nền và trả về `job_id`; nếu muốn chờ xong ngay trong request thì gửi thêm `{"wait": true}` trong body.

Chi tiết biến môi trường, migrate, và validation có trong [docs/phase-0-db-import-runbook.md](./docs/phase-0-db-import-runbook.md).
Phần RAG chi tiết có trong [docs/phase-2-rag-runbook.md](./docs/phase-2-rag-runbook.md).

## Ghi chú dữ liệu

- `compact` là input chuẩn cho app/backend/mobile/RAG v1.
- `raw` chỉ dùng cho audit, đối chiếu, và enrichment offline; không expose trực tiếp ra API/app.
- `output/` chứa dữ liệu crawl local/private, không nên commit lên GitHub.
- Web demo cũ đã bị gỡ bỏ khỏi repo; không còn frontend legacy nào là nguồn sự thật.

## Trước khi push GitHub

- Giữ `.env`, `auth.json`, và mọi credential DB ở local.
- Chỉ commit source code, migration, docs, config, và ví dụ input cần thiết.
- Nếu từng lỡ commit token hoặc credential ở nơi khác, hãy rotate trước khi public repo.
