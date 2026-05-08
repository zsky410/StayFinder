# Phase 0 DB Import Runbook

Runbook này chuẩn hóa việc migrate schema, import dataset freeze v1, và verify DB cho StayFinder Phase 0.

## 1. Frozen Inputs

- Batch key: `danang_accommodations_batch_20260323_082743`
- Import source:
  - `output/danang_accommodations_batch_20260323_082743/all_types_compact_combined.json`
- Archive only:
  - `output/danang_accommodations_batch_20260323_082743/all_types_raw_combined.json`

## 2. Preconditions

### File phải tồn tại

- `supabase/migrations/20260328120000_initial_schema.sql`
- `supabase/migrations/20260328120001_seed_local_landmarks.sql`
- `scripts/import_compact_to_supabase.py`
- `output/danang_accommodations_batch_20260323_082743/all_types_compact_combined.json`

### Credential DB

Chọn **một** trong hai cách:

#### Cách A — Importer dùng connection string hoặc `PG*`

Thiết lập một trong các nhóm biến sau:

- `DATABASE_URL` hoặc `SUPABASE_DB_URL`
- hoặc `PGHOST` + `PGPASSWORD`

Biến bổ sung nếu cần:

- `PGPORT`
- `PGUSER`
- `PGDATABASE`
- `PGSSLMODE=require`

#### Cách B — Supabase CLI đẩy migration remote

Thiết lập:

- `SUPABASE_DB_PASSWORD`

Repo này đã có Supabase CLI và linked project metadata, nhưng trên workstation hiện tại chưa có password DB nên `supabase db push` chưa thể chạy remote ngay.

## 3. Migrate Schema

### Option 1 — Supabase CLI

```bash
supabase db push
```

### Option 2 — `psql`

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260328120000_initial_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/20260328120001_seed_local_landmarks.sql
```

## 4. Import Frozen Dataset

```bash
.venv/bin/python scripts/import_compact_to_supabase.py \
  output/danang_accommodations_batch_20260323_082743/all_types_compact_combined.json \
  --batch-key danang_accommodations_batch_20260323_082743
```

### Ghi chú

- Importer là idempotent theo `places.place_id`
- `place_images`, `reviews`, `place_amenities` sẽ được replace theo từng place khi re-import
- `raw_payload` trong Phase 0 sẽ lưu payload của `compact`, không phải `raw`

## 5. Verify Sau Import

Chạy file SQL sau để xác minh:

- `docs/phase-0-import-validation.sql`

Ví dụ:

```bash
psql "$DATABASE_URL" -f docs/phase-0-import-validation.sql
```

Kỳ vọng tối thiểu:

- có đúng 1 row trong `crawl_batches` với batch key đã chốt
- `places` có `1646` row sau import
- không có duplicate `place_id`
- `place_images`, `reviews`, `amenities`, `place_amenities` đều có dữ liệu

## 6. Re-import Policy

- Được phép re-import cùng batch để sửa dữ liệu hoặc xác minh idempotency
- Không đổi batch key nếu vẫn là cùng source v1
- Không đổi source từ `compact` sang `raw` trong Phase 0

## 7. Không Thuộc Phase 0

- migration mới cho distance engine
- pipeline embedding / RAG
- API/backend mới
- mobile app
- public endpoint từ `raw`
