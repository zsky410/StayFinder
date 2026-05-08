# StayFinder Current State

Tài liệu này là **nguồn sự thật chính thức của Phase 0** cho toàn team.  
Mọi backend/mobile/RAG work sau Phase 0 phải bám theo các quyết định ở đây.

## 0. Phase 0 Status

- Trạng thái: **complete**
- Dataset freeze: **done**
- Remote schema migrate: **done**
- Remote import vào Supabase: **done**
- Count-level validation: **passed**

## 1. Frozen Inputs

- Batch v1 đang khóa: `output/danang_accommodations_batch_20260323_082743/`
- Ngày crawl batch: `2026-03-23`
- Batch key chính thức: `danang_accommodations_batch_20260323_082743`
- Source of truth v1 cho app/backend/mobile/RAG:
  - `output/danang_accommodations_batch_20260323_082743/all_types_compact_combined.json`
- Archive/debug source:
  - `output/danang_accommodations_batch_20260323_082743/all_types_raw_combined.json`
- Trạng thái freeze được chốt ngày: `2026-05-08`

## 2. Vì Sao Chọn `compact`

`compact` được chọn làm input chuẩn cho v1 vì:

- giữ đủ `1646` place như `raw`
- nhỏ hơn đáng kể:
  - `compact`: `28.07 MB`
  - `raw`: `44.96 MB`
- có đủ field cho list/detail/filter/gallery/review sample/RAG v1
- đã được rút gọn review và ảnh về mức phù hợp cho app/backend
- tránh phụ thuộc vào reviewer personal data vốn chỉ nằm trong `raw`

`raw` vẫn được giữ để:

- audit đối chiếu sau này
- backfill/enrichment offline
- điều tra lỗi crawl nếu cần

## 3. Hồ Sơ Dataset V1

### Quy mô

- Tổng số place: `1646`
- Không có item nào thiếu `placeId`/fallback key

### Phân bố theo loại hình

| Type slug | Count |
| --- | ---: |
| `homestay` | 194 |
| `hotel` | 192 |
| `nha-nghi` | 185 |
| `can-ho-dich-vu` | 179 |
| `nha-tro` | 173 |
| `villa` | 173 |
| `nha-khach` | 169 |
| `hostel` | 143 |
| `resort` | 141 |
| `can-ho` | 97 |

### Độ phủ field chính trong `compact`

| Field | Coverage |
| --- | ---: |
| `location` | `1646/1646` (`100.0%`) |
| `imageUrl` | `1639/1646` (`99.6%`) |
| `galleryImages` | `1639/1646` (`99.6%`) |
| `reviews` | `1637/1646` (`99.5%`) |
| `phone` | `1309/1646` (`79.5%`) |
| `additionalInfo` | `625/1646` (`38.0%`) |
| `website` | `463/1646` (`28.1%`) |
| `price` | `402/1646` (`24.4%`) |
| `openingHours` | `119/1646` (`7.2%`) |
| `hotelDescription` | `81/1646` (`4.9%`) |

## 4. Data Contract V1

### Field được coi là tin cậy cho v1

- `placeId`, `title`, `categoryName`, `categories`
- `address`, `neighborhood`, `city`, `state`, `countryCode`
- `location.lat`, `location.lng`
- `totalScore`, `reviewsCount`
- `imageUrl`, `galleryImages`
- `phone`, `website`
- `openingHours`, `additionalInfo`
- `reviews`

### Field không đủ coverage để làm feature chính

- `price`
- `hotelDescription`
- mọi reviewer personal field chỉ có trong `raw`

### Quy tắc dùng dữ liệu

- App/backend/mobile/RAG v1 chỉ đọc từ DB được import từ `compact`
- `raw` không được expose trực tiếp ra API/app
- Nếu cần enrich từ `raw`, phải làm offline/internal và không đổi API contract v1
- `raw_payload` trong DB Phase 0 sẽ phản ánh đúng payload của file import (`compact`)

## 5. Known Issues

- `output/danang_accommodations_batch_20260323_082743/can-ho_compact.json` đang thiếu ở local output
- Vấn đề trên **không chặn import**, vì `all_types_compact_combined.json` vẫn đầy đủ `1646` place
- Web demo legacy đã được gỡ khỏi repo; mọi phase sau chỉ bám vào DB và roadmap mới
- Landmark, zone, và local context note của Phase 1 hiện đang là **placeholder/fake seed** để unblock backend/mobile; cần refine lại bằng dữ liệu thật sau
- `distance_m` trong `place_landmark_metrics` hiện là **đường chim bay (haversine)**, không phải khoảng cách di chuyển thực tế

## 6. DB Readiness

### Thành phần đã có trong repo

- Baseline schema: `supabase/migrations/20260328120000_initial_schema.sql`
- Seed landmarks: `supabase/migrations/20260328120001_seed_local_landmarks.sql`
- Importer: `scripts/import_compact_to_supabase.py`
- Runbook: `docs/phase-0-db-import-runbook.md`
- Validation SQL: `docs/phase-0-import-validation.sql`
- Phase 1 migration: `supabase/migrations/20260508093000_phase1_landmarks_haversine.sql`
- Phase 1 validation SQL: `docs/phase-1-validation.sql`

### Trạng thái thực thi Phase 0 trên workstation này

- Đã xác nhận file `compact` và `raw` đọc được
- Đã xác nhận `compact` có đúng `1646` items
- Đã xác nhận CLI Supabase có sẵn
- Đã link đúng remote project Supabase
- Đã push baseline schema và seed landmarks lên remote DB
- Đã import toàn bộ `compact` dataset lên remote DB
- Đã verify count-level integrity sau import

### Kết quả validate remote DB

- `crawl_batches.row_count`: `1646`
- `places`: `1646`
- `distinct place_id`: `1646`
- `place_images`: `18419`
- `reviews`: `12000`
- `amenities`: `112`
- `place_amenities`: `4313`
- `places_with_amenities`: `622`
- `local_landmarks`: `8`

## 7. Governance

- Không recrawl, không đổi batch, không merge batch khác vào v1 trong Phase 0
- Không ai được tự ý đổi source từ `compact` sang `raw` khi chưa có quyết định phase mới
- Mọi feature Phase 1+ phải bám theo batch key `danang_accommodations_batch_20260323_082743`
- Mọi tài liệu mới về data foundation phải coi file này là điểm tham chiếu đầu tiên

## 8. Phase 1 Foundation Status

- Phase 1 trạng thái: **implemented**
- Local landmarks hiện có: `8`
- Local zones hiện có: `5`
- Local context notes hiện có: `8`
- Metric method hiện dùng: `haversine`
- `place_landmark_metrics`: `13168`
- `places_with_metrics`: `1646`
- `landmarks_with_metrics`: `8`

### Landmark placeholder hiện tại

- `dragon-bridge`
- `han-bridge`
- `my-khe-beach`
- `da-nang-airport`
- `han-market`
- `son-tra-peninsula`
- `an-thuong`
- `marble-mountains`

## 9. Phase 2 Foundation Status

- Phase 2 trạng thái trong repo: **implemented**
- LangChain pipeline script: `scripts/phase2_rag.py`
- Shared DB helper: `scripts/db_env.py`
- Phase 2 support migration: `supabase/migrations/20260508143000_phase2_rag_support.sql`
- Phase 2 runbook: `docs/phase-2-rag-runbook.md`
- Phase 2 validation SQL: `docs/phase-2-validation.sql`
- Embedding model mặc định: `text-embedding-3-small` (`1536` dimensions)
- Generation provider mặc định cho prototype: `openai_compatible`
- Generation model mặc định cho prototype: `gpt-5.5`
- Remote schema note:
  - migration `20260508143000_phase2_rag_support.sql` đã được apply lên remote DB
  - migration history đã được repair thành `applied`
- Trạng thái remote data hiện tại:
  - `ai_place_chunks`: `3957`
  - `chunks_with_embeddings`: `3957`
  - `places_with_chunks`: `1646`
  - `ai_review_summaries`: `1`
  - query mẫu `khach san gan cau rong cho gia dinh` đã chạy thành công với structured filter + semantic retrieval + generated answer
