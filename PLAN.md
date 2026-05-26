# StayFinder PRD / Execution Plan V2

Đây là **master roadmap** cho toàn bộ sản phẩm sau khi đã chốt data foundation.

- Mọi quyết định hiện tại về dataset, batch key, data contract, và governance của Phase 0 phải bám theo [CURRENT_STATE.md](./CURRENT_STATE.md).
- Mọi bước migrate/import/verify DB phải bám theo [docs/phase-0-db-import-runbook.md](./docs/phase-0-db-import-runbook.md).

## Tóm tắt
StayFinder sẽ được triển khai theo hướng **full-stack cho đồ án**, nhưng lấy **mobile app làm sản phẩm chính**, **admin ở mức tối giản**, và **AI/RAG là năng lực cốt lõi**.  
Nguồn dữ liệu vận hành v1 sẽ là `all_types_compact_combined.json`; file `raw` chỉ giữ làm nguồn đối chiếu, audit, và enrichment offline.  
Tính năng khoảng cách sẽ dùng **đường chim bay theo tọa độ** đã precompute, không dùng OSRM ở giai đoạn này.  
Chatbot v1 chỉ phục vụ **gợi ý lưu trú + local context Đà Nẵng**, không mở rộng thành trợ lý du lịch tổng quát.

## Phạm vi sản phẩm và thứ tự triển khai
### Phase 0 — Freeze nền tảng dữ liệu
- Chốt `all_types_compact_combined.json` là source of truth cho app/backend v1.
- Giữ `all_types_raw_combined.json` ở local/private storage để debug, recrawl đối chiếu, và enrich nội dung AI khi cần.
- Import toàn bộ dataset vào Supabase/Postgres; dữ liệu phải idempotent theo `place_id`.
- Không expose reviewer personal data từ `raw` ra API hoặc app.
- Viết tài liệu trạng thái hiện tại: batch đang dùng, độ phủ dữ liệu, field mạnh/yếu, giới hạn dataset.
- Trạng thái canonical của Phase 0 được lưu riêng trong `CURRENT_STATE.md`; không dùng bất kỳ frontend legacy nào làm nguồn sự thật.

### Phase 1 — Knowledge base + local context + distance engine
- Hoàn thiện dữ liệu địa danh Đà Nẵng phục vụ app và RAG:
  - `dragon-bridge`
  - `han-bridge`
  - `my-khe-beach`
  - `da-nang-airport`
  - `han-market`
  - `marble-mountains`
  - `an-thuong`
  - `son-tra`
- Với landmark dạng điểm, dùng 1 tọa độ chuẩn.
- Với khu vực lớn như Sơn Trà hoặc An Thượng, dùng nhiều anchor point hoặc zone metadata; metric hiển thị cho user lấy **khoảng cách nhỏ nhất hợp lệ**.
- Precompute khoảng cách đường chim bay từ mỗi chỗ ở tới từng landmark và lưu DB để backend/app chỉ đọc, không tính runtime mỗi lần.
- Chuẩn hóa local context facts để RAG dùng được:
  - mô tả khu vực
  - insight “phố Tây”, “gần biển”, “gần trung tâm”, “gần sân bay”
  - lưu ý mang tính địa phương, nhưng chỉ giữ fact có thể kiểm chứng

### Phase 2 — AI/RAG trước, nhưng dựa trên data foundation
- Xây pipeline chunking cho `ai_place_chunks` từ:
  - title, type, address/neighborhood, rating, review count
  - amenities chính
  - review highlights / negatives từ `compact`
  - landmark distances đã precompute
  - local context facts của Đà Nẵng
- Prototype hiện tại chốt mặc định theo implementation trong repo: generate qua `openai_compatible` với model `gpt-5.4`; embeddings dùng loại **1536-dim** để khớp schema hiện có.
- `anthropic` vẫn là đường cấu hình tùy chọn khi cần, nhưng không còn là mặc định của prototype này.
- Retrieval flow v1:
  - parse intent
  - áp structured filters trước
  - vector retrieval sau
  - inject local context cuối
  - generate answer kèm danh sách place được đề xuất
- Chatbot v1 chỉ trả lời các nhóm câu hỏi:
  - gợi ý chỗ ở theo nhu cầu
  - so sánh vài lựa chọn
  - giải thích vì sao phù hợp
  - gần landmark nào, khoảng cách bao nhiêu
  - khu vực nào hợp với nhu cầu người dùng
- Không cho chatbot tự suy diễn khoảng cách, giá, hoặc tiện ích khi DB không có dữ liệu.
- AI review summary v1 sinh theo place, cache kết quả, và hiển thị ở màn detail.

### Phase 3 — Backend API cho mobile và admin
- Xây Node.js + Express làm BFF cho toàn hệ thống.
- Public API v1:
  - `GET /places`
  - `GET /places/:id`
  - `GET /places/map`
  - `GET /filters/meta`
  - `GET /landmarks`
  - `POST /chat/query`
  - `POST /ai/review-summary`
- Admin API v1:
  - CRUD tối thiểu cho places, landmarks, local context notes
  - endpoint re-run distance/AI jobs theo batch hoặc theo place
- Hợp đồng dữ liệu tối thiểu:
  - `place summary`: `id, place_id, title, type_slug, address, neighborhood, lat, lng, rating, reviews_count, cover_image, amenities_preview, nearest_landmarks`
  - `place detail`: thêm `gallery, phone, website, opening_hours, reviews_sample, landmark_metrics, ai_review_summary`
  - `landmark metric`: `landmark_slug, landmark_name, distance_m, method, anchor_label`
  - `chat response`: `answer, applied_filters, recommended_places[], local_context_used[], follow_up_prompts[]`
- User app không cần login; chỉ admin dùng auth.
- Saved/Recent trên mobile lưu local, không đồng bộ cloud ở giai đoạn này.

### Phase 4 — Mobile app là deliverable chính
- Build Expo app Android-first, nhưng codebase vẫn giữ khả năng cross-platform.
- Flow v1 bắt buộc:
  - Splash
  - Home/Search
  - Results List
  - Filter Sheet
  - Map View
  - Place Detail
  - AI Review Summary
  - Chatbot
  - Saved/Recent local
- Home:
  - ô nhập ngôn ngữ tự nhiên
  - quick chips như “gần biển”, “gần sân bay”, “gia đình”, “giá ổn”
  - thẻ landmark nổi bật
- Results:
  - list card
  - filter theo loại hình, khu vực, rating, tiện ích, gần landmark
  - sort theo rating, reviews, distance
- Detail:
  - gallery
  - thông tin cơ bản
  - tiện ích
  - review sample
  - AI summary
  - khoảng cách tới landmark
  - CTA gọi điện và mở Google Maps
- Map:
  - marker list sync với card list
  - focus theo landmark hoặc result set
- Chatbot:
  - gợi ý prompt sẵn
  - trả về rec cards có thể bấm vào detail
  - follow-up prompts cho hội thoại ngắn
- Không làm booking/payment, chat voice, social login, hay navigation turn-by-turn trong app.

### Phase 5 — Web admin tối giản + hardening
- Admin chỉ cần đủ cho demo vận hành:
  - dashboard tổng quan
  - places list
  - place editor cơ bản
  - landmarks management
  - data quality screen
- Dashboard nên có:
  - tổng số places
  - phân bố theo loại hình
  - thiếu phone / website / price / image
  - batch import gần nhất
  - độ phủ landmark metrics
- Data quality nên chỉ ra:
  - thiếu tọa độ
  - thiếu ảnh
  - ít review
  - thiếu contact
  - duplicate candidate

## Test plan và tiêu chí nghiệm thu
- Import:
  - import lại cùng batch không tạo duplicate
  - toàn bộ 1646 place vào DB thành công
  - review, images, amenities gắn đúng place
- Distance:
  - mỗi place có metric cho toàn bộ landmark bắt buộc
  - khoảng cách với 5 mẫu kiểm tra tay sai số trong ngưỡng chấp nhận được
  - landmark dạng zone/đa anchor luôn trả về 1 kết quả ổn định
- RAG:
  - vượt qua bộ 20–30 prompt kiểm thử liên quan đến lưu trú và local context
  - không bịa khoảng cách, tiện ích, hay contact
  - câu trả lời luôn map được về place thật trong DB
- API:
  - search/filter/sort đúng
  - detail trả đủ gallery, reviews sample, landmark metrics, AI blocks
  - chat trả `recommended_places` dùng được ngay cho mobile
- Mobile:
  - flow Home -> Results -> Detail -> Map -> Chat không đứt
  - empty/loading/error states rõ ràng
  - APK demo chạy ổn trên Android
- Admin:
  - chỉnh landmark/local context xong có thể phản ánh lại qua pipeline tính khoảng cách hoặc AI jobs

## Giả định và mặc định đã chốt
- Nguồn dữ liệu v1: `compact`; `raw` không dùng trực tiếp cho API/app.
- Chatbot scope: **lưu trú + local context**, không phải concierge tổng quát.
- User app: **không login**; admin có auth riêng.
- Khoảng cách: **đường chim bay theo tọa độ**, precompute và lưu DB.
- Admin: **tối giản**, đủ cho quản trị demo đồ án.
- Mobile là deliverable chính; web demo cũ đã được loại khỏi repo để tránh lệch hướng triển khai.
- Tên landmark “cầu sông hàng” được chuẩn hóa thành **Cầu Sông Hàn**.
