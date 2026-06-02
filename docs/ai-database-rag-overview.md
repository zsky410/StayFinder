# StayFinder - AI, Database, Crawl Data và RAG Chat

Tài liệu này mô tả chi tiết cách StayFinder thu thập dữ liệu địa điểm từ Apify, chuẩn hóa và lưu trữ vào PostgreSQL/Supabase, sau đó dùng dữ liệu đó để xây dựng tính năng tìm kiếm, xem chi tiết, AI Review Summary và AI Chat dựa trên RAG.

## 1. Tổng Quan Hệ Thống

StayFinder là ứng dụng mobile tìm chỗ ở tại Đà Nẵng. Hệ thống không chỉ hiển thị danh sách khách sạn/homestay/resort, mà còn bổ sung lớp AI để người dùng có thể hỏi bằng ngôn ngữ tự nhiên như:

- "Khách sạn gần Cầu Rồng có wifi cho gia đình"
- "Homestay gần biển Mỹ Khê, yên tĩnh"
- "Chỗ nào hợp đi công tác gần sân bay?"
- "Tóm tắt review của chỗ này giúp tôi"

Để trả lời được các câu hỏi này, hệ thống gồm 4 lớp chính:

1. **Mobile App**: giao diện người dùng, gồm Home, Results, Place Detail, Saved, Chat AI.
2. **Backend API**: Node.js + Express, cung cấp REST API cho mobile.
3. **Database**: Supabase PostgreSQL + extension `pgvector`, lưu dữ liệu place, review, tiện ích, landmark, chunks và embeddings.
4. **AI/RAG Pipeline**: Python + LangChain, chịu trách nhiệm build chunks, tạo embeddings, semantic search và sinh câu trả lời AI.

Luồng tổng quát:

```text
Apify Google Maps Scraper
        |
        v
Raw JSON + Compact JSON
        |
        v
Import vào Supabase/Postgres
        |
        v
Build RAG chunks từ places/reviews/amenities/landmarks
        |
        v
Embed chunks thành vector 1536 chiều
        |
        v
Mobile gọi /chat/query
        |
        v
RAG tìm dữ liệu liên quan + LLM sinh câu trả lời
```

## 2. Các Tính Năng Chính

### 2.1. Tìm Kiếm Và Lọc Chỗ Ở

Người dùng có thể tìm chỗ ở theo:

- Từ khóa tự do: tên, khu vực, địa chỉ, loại hình.
- Loại hình: khách sạn, homestay, hostel, resort, villa, căn hộ, nhà nghỉ.
- Khu vực: quận, neighborhood.
- Tiện ích: wifi, bãi đỗ xe, phù hợp trẻ em, spa, gym, đưa đón sân bay.
- Landmark: Cầu Rồng, biển Mỹ Khê, sân bay Đà Nẵng, chợ Hàn, Cầu Sông Hàn, An Thượng, Sơn Trà, Ngũ Hành Sơn.
- Rating tối thiểu.
- Khoảng cách tối đa tới landmark.

Backend xử lý qua endpoint:

```http
GET /places
```

Kết quả trả về là `PlaceSummary`, gồm các trường quan trọng:

- `place_id`
- `title`
- `type_slug`
- `address`
- `rating`
- `reviews_count`
- `cover_image`
- `amenities_preview`
- `nearest_landmarks`
- `requested_landmark_distance_m`

### 2.2. Xem Chi Tiết Địa Điểm

Màn Place Detail gọi:

```http
GET /places/:id
```

Backend trả về:

- Thông tin cơ bản: tên, loại hình, địa chỉ, rating, số review.
- Gallery ảnh.
- Điện thoại, website, opening hours.
- Tiện ích.
- Review mẫu.
- Khoảng cách tới landmark.
- AI review summary nếu đã có cache.

### 2.3. AI Chat Tư Vấn Lưu Trú

Mobile gọi:

```http
POST /chat/query
```

Payload:

```json
{
  "query": "khách sạn gần Cầu Rồng có wifi cho gia đình",
  "generate": true
}
```

Response gồm:

- `answer`: câu trả lời tiếng Việt do AI sinh.
- `applied_filters`: các filter mà hệ thống hiểu được từ câu hỏi.
- `recommended_places`: danh sách place thật trong DB.
- `local_context_used`: ghi chú địa phương nếu có dùng.
- `follow_up_prompts`: gợi ý câu hỏi tiếp theo.
- `meta.semantic_matches`: chunks đã được semantic retrieval tìm ra.

### 2.4. AI Review Summary

Màn chi tiết có thể gọi:

```http
POST /ai/review-summary
```

Tính năng này đọc review của một place, sinh tóm tắt ngắn bằng AI hoặc heuristic fallback, sau đó cache vào bảng `ai_review_summaries`.

Mục đích:

- Người dùng không phải đọc nhiều review dài.
- Tóm nhanh điểm được khen, điểm cần cân nhắc và tiện ích nổi bật.
- Giảm chi phí LLM nhờ cache theo từng place.

## 3. User Flow

### 3.1. Flow Tìm Kiếm Thông Thường

```text
User mở app
  -> Home
  -> nhập từ khóa hoặc bấm quick chip
  -> Results
  -> backend GET /places
  -> DB filter places + amenities + landmarks
  -> trả danh sách place
  -> user bấm một place
  -> Detail
  -> backend GET /places/:id
  -> hiển thị gallery, amenities, review, landmark metrics
```

Ví dụ:

1. User nhập "gần biển Mỹ Khê".
2. Mobile chuyển sang Results với query/filter tương ứng.
3. Backend tìm places có metric gần `my-khe-beach`.
4. Results hiển thị card có khoảng cách tới biển.

### 3.2. Flow Chat AI

```text
User mở tab Chat
  -> nhập câu hỏi tự nhiên
  -> Mobile POST /chat/query
  -> Backend spawn scripts/phase2_rag.py query --json --generate
  -> RAG parse intent
  -> RAG structured retrieval bằng SQL
  -> RAG semantic retrieval bằng pgvector
  -> RAG build context
  -> LLM sinh answer
  -> Backend map place_id thành recommended_places
  -> Mobile render answer + place cards
```

Ví dụ câu hỏi:

```text
khách sạn gần Cầu Rồng có wifi cho gia đình
```

RAG parser hiểu thành:

- `type_slugs`: `hotel`
- `landmark_slugs`: `dragon-bridge`
- `amenity_labels`: `Wi-Fi miễn phí`, `Phù hợp với trẻ em`
- `max_distance_m`: mặc định `3000` nếu user nói "gần"

Sau đó hệ thống không để LLM tự đoán. Nó lấy dữ liệu thật từ DB, rồi mới đưa context đó cho LLM trả lời.

### 3.3. Flow Crawl Và Import Dữ Liệu

```text
Developer chạy crawler
  -> scripts/apify_danang_accommodations_batch.py
  -> gọi Apify Actor compass/crawler-google-places
  -> lấy raw dataset theo từng loại hình lưu trú
  -> lọc Đà Nẵng, rating, category, duplicate
  -> xuất raw JSON và compact JSON
  -> combine/dedupe toàn batch
  -> import compact vào Supabase
  -> build distance metrics
  -> build chunks
  -> embed chunks
  -> validate RAG index
```

## 4. Crawl Data Place Từ Apify

### 4.1. Công Cụ Crawl

Script chính:

```bash
.venv/bin/python scripts/apify_danang_accommodations_batch.py
```

Script dùng Apify Actor:

```text
compass/crawler-google-places
```

Actor này crawl dữ liệu Google Maps theo search term và location.

### 4.2. Các Loại Hình Được Crawl

Crawler định nghĩa nhiều crawl plan, mỗi plan có:

- `slug`: mã loại hình.
- `label`: nhãn hiển thị.
- `search_terms`: từ khóa tìm kiếm trên Google Maps.
- `category_filters`: category kỳ vọng.

Các nhóm chính:

| Slug | Ý nghĩa | Search terms ví dụ |
|---|---|---|
| `hotel` | Khách sạn | `khách sạn`, `hotel` |
| `homestay` | Homestay | `homestay`, `lưu trú nhà dân` |
| `hostel` | Hostel/ký túc xá | `hostel`, `dormitory` |
| `nha-nghi` | Nhà nghỉ | `nhà nghỉ`, `motel` |
| `nha-khach` | Nhà khách | `nhà khách`, `guest house` |
| `resort` | Resort | `resort`, `khu nghỉ dưỡng` |
| `villa` | Villa | `villa`, `biệt thự` |
| `can-ho` | Căn hộ | `căn hộ`, `apartment` |
| `can-ho-dich-vu` | Căn hộ dịch vụ | `serviced apartment`, `aparthotel` |
| `nha-tro` | Nhà trọ | `nhà trọ` |

### 4.3. Cấu Hình Crawl

Các cấu hình quan trọng trong crawler:

- `countryCode = vn`
- `language = vi`
- `maxCrawledPlacesPerSearch`: giới hạn số place mỗi search.
- `placeMinimumStars = twoAndHalf`
- `skipClosedPlaces = true`
- `scrapePlaceDetailPage = true`
- `maxReviews`: số review lấy mỗi place.
- `reviewsSort = mostRelevant`
- `scrapeReviewsPersonalData = false`
- `maxImages`: số ảnh lấy mỗi place.
- `scrapeImageAuthors = false`
- Không scrape social media/contact enrichment để giảm dữ liệu nhạy cảm và chi phí.

### 4.4. Lọc Và Làm Sạch Dữ Liệu Crawl

Không phải item nào Apify trả về cũng được giữ. Crawler lọc theo các tiêu chí:

1. **Phải thuộc Đà Nẵng**
   - Kiểm tra text trong address/city/state/neighborhood.
   - Kiểm tra tọa độ nằm trong bounding box Đà Nẵng:
     - latitude khoảng `15.955` đến `16.165`
     - longitude khoảng `108.095` đến `108.33`

2. **Phải đạt rating tối thiểu**
   - Mặc định `2.5`.

3. **Phải giống loại hình lưu trú**
   - Dựa vào `categoryName`, `hotelStars`, `categories`.
   - So với danh sách token như hotel, khách sạn, homestay, resort, villa, apartment...

4. **Dedupe**
   - Ưu tiên key là `placeId`.
   - Nếu thiếu `placeId`, fallback sang `url`.
   - Nếu vẫn thiếu, dùng `title|address`.

### 4.5. Raw JSON Và Compact JSON

Sau khi crawl, hệ thống lưu hai dạng dữ liệu:

| File | Mục đích |
|---|---|
| `*_raw.json` | Lưu gần đầy đủ output Apify cho audit/debug/offline enrichment |
| `*_compact.json` | Dữ liệu đã rút gọn, an toàn hơn, dùng cho app/backend/RAG |
| `all_types_raw_combined.json` | Gộp raw toàn batch |
| `all_types_compact_combined.json` | Source of truth cho import DB |

Trong project hiện tại:

```text
Batch key: danang_accommodations_batch_20260323_082743
Source of truth: all_types_compact_combined.json
```

`raw` không expose trực tiếp ra app/API. `compact` là dữ liệu chính dùng để import, build backend và build RAG.

### 4.6. Compact Item Gồm Gì?

Mỗi compact place gồm các nhóm dữ liệu:

- Thông tin định danh:
  - `placeId`
  - `title`
  - `url`
  - `searchPageUrl`
  - `searchString`

- Phân loại:
  - `crawlCategorySlug`
  - `crawlCategoryLabel`
  - `crawlCategoryLabels`
  - `categoryName`
  - `categories`

- Địa chỉ và tọa độ:
  - `address`
  - `neighborhood`
  - `street`
  - `city`
  - `state`
  - `countryCode`
  - `location.lat`
  - `location.lng`

- Chất lượng/độ phổ biến:
  - `totalScore`
  - `reviewsCount`
  - `reviewsDistribution`

- Liên hệ và mô tả:
  - `phone`
  - `website`
  - `description`
  - `hotelDescription`

- Media:
  - `imageUrl`
  - `imageUrls`
  - `galleryImages`
  - `imagesCount`

- Review mẫu:
  - `reviews[].text`
  - `reviews[].textTranslated`
  - `reviews[].stars`
  - `reviews[].likesCount`
  - `reviews[].publishedAtDate`
  - `reviews[].reviewOrigin`

- Thông tin khách sạn:
  - `hotelStars`
  - `checkInDate`
  - `checkOutDate`
  - `hotelAds`
  - `openingHours`
  - `additionalInfo`

## 5. Import Và Lưu Trữ Database

### 5.1. Script Import

Script import chính:

```bash
.venv/bin/python scripts/import_compact_to_supabase.py \
  output/danang_accommodations_batch_20260323_082743/all_types_compact_combined.json \
  --batch-key danang_accommodations_batch_20260323_082743
```

Script đọc compact JSON và ghi vào Supabase/Postgres.

### 5.2. Nguyên Tắc Idempotent

Import được thiết kế idempotent:

- Bảng `places` upsert theo `places.place_id`.
- Nếu import lại cùng batch, không tạo duplicate place.
- Các bảng con như `place_images`, `reviews`, `place_amenities` được xóa và ghi lại cho place đó.
- Bảng `crawl_batches` lưu batch key và số lượng record.

Điều này giúp pipeline có thể chạy lại khi cần mà không làm hỏng DB.

### 5.3. Các Bảng Chính

#### `crawl_batches`

Lưu thông tin mỗi lần crawl/import:

- `id`
- `batch_key`
- `source_path`
- `row_count`
- `created_at`

Mỗi `places` record trỏ về một `crawl_batches`.

#### `places`

Bảng trung tâm của hệ thống. Mỗi row là một địa điểm lưu trú.

Nhóm field chính:

- Identity:
  - `id`
  - `place_id`
  - `batch_id`

- Classification:
  - `type_slug`
  - `type_label`
  - `crawl_category_labels`
  - `category_name`
  - `categories`

- Display:
  - `title`
  - `description`
  - `hotel_description`
  - `image_url`
  - `price_text`

- Address:
  - `address`
  - `neighborhood`
  - `district`
  - `street`
  - `city`
  - `state`
  - `country_code`

- Coordinates:
  - `lat`
  - `lng`

- Quality:
  - `rating`
  - `reviews_count`
  - `reviews_distribution`

- Contact:
  - `phone`
  - `website`
  - generated columns `has_phone`, `has_website`

- Raw audit:
  - `raw_payload`

#### `place_images`

Lưu gallery ảnh của mỗi place:

- `place_id`
- `image_url`
- `sort_order`

#### `reviews`

Lưu review mẫu đã được compact:

- `place_id`
- `source_review_id`
- `stars`
- `review_text`
- `text_translated`
- `publish_at`
- `published_at`
- `likes_count`
- `review_origin`
- `payload`

Review dùng cho:

- Place Detail.
- AI Review Summary.
- RAG chunk loại `review_snippets`.

#### `amenities` Và `place_amenities`

`amenities` là bảng dimension:

- `id`
- `slug`
- `label`

`place_amenities` là bảng nối nhiều-nhiều giữa place và amenity.

Dữ liệu amenity được trích từ `additionalInfo` của Apify compact item.

#### `local_landmarks`

Lưu các mốc địa phương quan trọng:

- Cầu Rồng
- Cầu Sông Hàn
- biển Mỹ Khê
- sân bay Đà Nẵng
- chợ Hàn
- Ngũ Hành Sơn
- An Thượng
- Sơn Trà

#### `place_landmark_metrics`

Lưu khoảng cách từ mỗi place tới landmark:

- `place_id`
- `landmark_id`
- `distance_m`
- `walking_distance_m`
- `driving_distance_m`
- `anchor_label`
- `anchor_lat`
- `anchor_lng`
- `computed_at`

Trong app, field này giúp hiển thị:

- "Gần Cầu Rồng 450 m"
- "Cách biển Mỹ Khê 1.2 km"
- sort theo khoảng cách khi user filter theo landmark.

#### `local_context_notes`

Lưu kiến thức địa phương được kiểm soát thủ công:

- khu vực nào hợp đi biển
- khu nào hợp nightlife
- landmark nào nên dùng làm mốc tìm kiếm

RAG có thể inject các note này vào context nếu câu hỏi liên quan.

#### `ai_place_chunks`

Bảng quan trọng nhất cho RAG:

- `place_id`
- `chunk_index`
- `content`
- `content_md5`
- `metadata`
- `embedding vector(1536)`

Mỗi row là một đoạn text ngắn đã được chuẩn hóa từ dữ liệu lớn. Những chunk này được embed thành vector để semantic search.

#### `ai_review_summaries`

Cache tóm tắt review AI theo từng place:

- `place_id`
- `summary_text`
- `bullets`
- `model`
- `prompt_version`
- `source_review_count`
- `metadata`
- `created_at`
- `updated_at`

## 6. Embedding Trong Project Là Gì?

### 6.1. Khái Niệm

Embedding là cách biến một đoạn text thành một vector số. Trong project này, mỗi đoạn mô tả place/review/amenity/landmark được biến thành vector `1536` chiều.

Ví dụ đơn giản:

```text
"khách sạn gần Cầu Rồng có wifi cho gia đình"
        |
        v
[0.012, -0.031, 0.084, ..., 0.006]  # vector 1536 chiều
```

Hai đoạn text có ý nghĩa gần nhau thì vector của chúng nằm gần nhau trong không gian vector.

### 6.2. Mục Đích Của Embedding

Embedding giúp hệ thống tìm kiếm theo ngữ nghĩa, không chỉ tìm exact keyword.

Ví dụ user hỏi:

```text
"chỗ ở hợp đi với trẻ nhỏ gần trung tâm"
```

Trong DB có thể không có đúng cụm từ này, nhưng chunks chứa:

- `Phù hợp với trẻ em`
- `family-friendly`
- `near Dragon Bridge`
- `central-riverfront`

Semantic search có thể tìm ra các chunk liên quan vì ý nghĩa gần nhau.

### 6.3. Embedding Cái Gì?

Hiện tại RAG index đã được rebuild theo nhiều `chunk_kind`:

| Chunk kind | Nội dung được embed | Mục đích |
|---|---|---|
| `place_profile` | Tên, loại hình, địa chỉ, rating, mô tả, giá, phone/website, tags | Hiểu tổng quan place |
| `amenity_profile` | Danh sách tiện ích, tag phù hợp gia đình/spa/gym/beach | Tìm theo nhu cầu tiện ích |
| `landmark_proximity` | Khoảng cách tới landmark, anchor | Tìm gần Cầu Rồng, biển, sân bay |
| `review_snippets` | Review text nổi bật, sao, likes | Tìm theo trải nghiệm thực tế của khách |
| `local_context` | Ghi chú địa phương liên quan | Bổ sung kiến thức khu vực |

Tại thời điểm validation gần nhất:

- `places_total`: `1646`
- `chunks_total`: `8187`
- `chunks_with_embeddings`: `8187`
- `chunks_missing_embeddings`: `0`
- vector index: `idx_ai_place_chunks_embedding_cosine`
- metadata index: `idx_ai_place_chunks_metadata_gin`

Phân bố chunk:

| Chunk kind | Số chunk |
|---|---:|
| `review_snippets` | `3219` |
| `place_profile` | `1676` |
| `amenity_profile` | `1646` |
| `landmark_proximity` | `1646` |

### 6.4. Embed Bằng Model Nào?

Mặc định:

```text
text-embedding-3-small
```

Số chiều:

```text
1536
```

Schema DB:

```sql
embedding vector(1536)
```

Lý do dùng 1536 chiều:

- Tương thích tốt với `text-embedding-3-small`.
- Đủ tốt cho semantic retrieval.
- Chi phí thấp hơn model lớn.
- Phù hợp project đồ án và dataset 1646 places.

## 7. RAG Chat Hoạt Động Như Thế Nào?

RAG là viết tắt của **Retrieval-Augmented Generation**. Nghĩa là trước khi cho LLM trả lời, hệ thống đi tìm dữ liệu thật liên quan trong database, rồi đưa dữ liệu đó vào prompt.

Không dùng RAG:

```text
User hỏi -> LLM tự trả lời theo kiến thức chung -> dễ bịa
```

Có RAG:

```text
User hỏi -> tìm dữ liệu thật trong DB -> đưa context cho LLM -> LLM trả lời dựa trên context
```

### 7.1. Pipeline RAG Trong StayFinder

Pipeline gồm 3 giai đoạn:

#### Giai đoạn 1: Index

Chạy offline hoặc admin job:

```bash
.venv/bin/python scripts/phase2_rag.py chunk \
  --batch-key danang_accommodations_batch_20260323_082743

.venv/bin/python scripts/phase2_rag.py embed \
  --batch-key danang_accommodations_batch_20260323_082743

.venv/bin/python scripts/phase2_rag.py validate \
  --batch-key danang_accommodations_batch_20260323_082743
```

Luồng:

```text
DB places/reviews/amenities/landmarks
  -> build text chunks
  -> split bằng RecursiveCharacterTextSplitter
  -> embed bằng OpenAIEmbeddings
  -> lưu vào ai_place_chunks
```

#### Giai đoạn 2: Retrieve

Khi user hỏi:

```text
"homestay gần biển có wifi"
```

RAG:

1. Parse intent.
2. Embed câu hỏi user thành query vector.
3. SQL filter places nếu có filter rõ ràng.
4. Vector search trong `ai_place_chunks`.
5. Lấy top-k chunks liên quan nhất.

Vector search dùng cosine distance qua pgvector:

```sql
c.embedding <=> query_vector
```

#### Giai đoạn 3: Generate

RAG build context:

- câu hỏi user
- structured intent
- candidate places từ SQL
- retrieved chunk excerpts từ vector search
- local context notes nếu có

Sau đó gọi LLM với system prompt có ràng buộc:

- trả lời tiếng Việt nếu user không yêu cầu ngôn ngữ khác
- chỉ trả lời từ context được cung cấp
- không bịa giá, tiện ích, chính sách, an toàn, thời gian di chuyển
- nếu thiếu dữ liệu thì nói không thể xác nhận
- không nói các từ nội bộ như database, RAG, embeddings, backend

### 7.2. Structured Retrieval Và Semantic Retrieval

StayFinder dùng hybrid retrieval, tức là kết hợp hai cách tìm:

#### Structured Retrieval

Dùng SQL filter khi câu hỏi có tiêu chí rõ:

- loại hình: `hotel`, `homestay`, `villa`
- landmark: `dragon-bridge`, `my-khe-beach`
- tiện ích: `Wi-Fi miễn phí`, `Phù hợp với trẻ em`
- rating tối thiểu
- khoảng cách tối đa

Ưu điểm:

- Chính xác.
- Không phụ thuộc vào LLM.
- Dễ kiểm soát.

Ví dụ:

```text
"khách sạn gần Cầu Rồng có wifi"
```

SQL có thể lọc:

- `p.type_slug = hotel`
- có amenity `Wi-Fi miễn phí`
- có metric tới `dragon-bridge`
- khoảng cách <= `3000m`

#### Semantic Retrieval

Dùng vector search khi câu hỏi mang ý nghĩa mềm hơn:

- "view đẹp"
- "hợp gia đình"
- "gần trung tâm"
- "được khách khen sạch sẽ"
- "đi công tác tiện"

Semantic retrieval tìm trong `ai_place_chunks`, đặc biệt hữu ích với `review_snippets` và `place_profile`.

### 7.3. Vì Sao Cần RAG Với Data Lớn?

Dataset có:

- 1646 places.
- Hàng nghìn chunks.
- Review, amenities, landmark metrics, descriptions.

Không thể nhét toàn bộ DB vào một prompt LLM vì:

- Quá dài.
- Tốn chi phí.
- Chậm.
- LLM dễ nhiễu và bịa.

RAG giải quyết bằng cách chỉ lấy phần liên quan nhất:

```text
1646 places + 8187 chunks
        |
        v
top 5-12 candidate places/chunks liên quan
        |
        v
LLM trả lời dựa trên context nhỏ nhưng đúng trọng tâm
```

### 7.4. Endpoint Chat AI Trong Backend

Backend route:

```http
POST /chat/query
```

Backend thực hiện:

1. Validate body có `query`.
2. Gọi Python script:

```bash
scripts/phase2_rag.py query "<query>" --json --generate
```

3. Parse JSON từ script.
4. Xác định có nên recommend places không.
5. Lấy chi tiết `recommended_places` từ DB.
6. Build fallback answer nếu LLM không trả lời.
7. Trả response cho mobile.

### 7.5. Ví Dụ Query RAG Thật

Input:

```text
khách sạn gần Cầu Rồng có wifi cho gia đình
```

Intent parser nhận diện:

```json
{
  "type_slugs": ["hotel"],
  "landmark_slugs": ["dragon-bridge"],
  "amenity_labels": ["Wi-Fi miễn phí", "Phù hợp với trẻ em"],
  "max_distance_m": 3000
}
```

RAG sau đó:

- SQL lấy khách sạn thỏa filter.
- Vector search tìm chunks có ý nghĩa gần câu hỏi.
- Trả về places thật như `Dang's Hotel`, `OYO 553 Truong Giang Hotel`, `Rainbow`.
- Nếu `--generate` bật, LLM sinh câu trả lời tự nhiên cho user.

## 8. AI Review Summary

AI Review Summary khác với Chat AI.

| Tính năng | Chat AI | AI Review Summary |
|---|---|---|
| Input | Câu hỏi tự nhiên của user | Một place cụ thể |
| Retrieval | SQL + vector search nhiều place | Review của một place |
| Output | Tư vấn + recommended places | Tóm tắt review |
| Cache | Không cache answer chat | Có cache trong `ai_review_summaries` |

Luồng:

```text
User bấm tạo AI summary
  -> POST /ai/review-summary
  -> Backend kiểm tra cache
  -> Nếu có cache: trả ngay
  -> Nếu chưa có: gọi phase2_rag.py review-summary
  -> Script đọc reviews của place
  -> LLM/heuristic sinh summary_text + bullets
  -> Upsert vào ai_review_summaries
  -> Mobile hiển thị
```

Heuristic fallback được dùng khi không muốn gọi LLM. LLM mode dùng provider cấu hình qua:

- `RAG_CHAT_PROVIDER`
- `RAG_CHAT_MODEL`
- `RAG_CHAT_BASE_URL`
- `RAG_CHAT_API_KEY`

## 9. Database Và AI Liên Quan Nhau Như Thế Nào?

Database không chỉ lưu dữ liệu để hiển thị UI. Nó còn là knowledge base cho AI.

| Bảng | Dùng cho UI | Dùng cho AI |
|---|---|---|
| `places` | list/detail | chunk `place_profile`, SQL filters |
| `reviews` | review sample | chunk `review_snippets`, AI summary |
| `amenities` | filter/detail | intent amenity, chunk `amenity_profile` |
| `place_amenities` | filter/detail | structured retrieval |
| `local_landmarks` | filter/map | intent landmark |
| `place_landmark_metrics` | distance/sort | structured retrieval, chunk `landmark_proximity` |
| `local_context_notes` | admin/local knowledge | RAG context |
| `ai_place_chunks` | không hiển thị trực tiếp | semantic retrieval |
| `ai_review_summaries` | detail AI block | cache AI summary |

Điểm quan trọng: LLM không tự đọc database. Backend/RAG script mới là lớp lấy dữ liệu đúng, sau đó truyền context cho LLM.

## 10. Admin Jobs Và Vận Hành AI

Backend có admin endpoints để chạy lại pipeline:

```http
POST /admin/jobs/chunks/rebuild
POST /admin/jobs/embeddings/rebuild
POST /admin/jobs/review-summaries/rebuild
POST /admin/jobs/distance/rebuild
```

Mục đích:

- Khi data place thay đổi, rebuild chunks.
- Khi chunk thay đổi, embed lại.
- Khi landmark thay đổi, rebuild distance.
- Khi muốn có AI summary sẵn, pregenerate review summaries.

Lệnh CLI tương ứng:

```bash
.venv/bin/python scripts/phase2_rag.py chunk --batch-key <batch_key>
.venv/bin/python scripts/phase2_rag.py embed --batch-key <batch_key>
.venv/bin/python scripts/phase2_rag.py validate --batch-key <batch_key>
```

## 11. Validation Chất Lượng RAG Index

Lệnh validation:

```bash
.venv/bin/python scripts/phase2_rag.py validate \
  --batch-key danang_accommodations_batch_20260323_082743
```

Validation kiểm:

- Có places không.
- Mỗi place có chunks không.
- Có chunk nào thiếu embedding không.
- Có chunk nào hash content bị stale không.
- Vector index có tồn tại không.
- Metadata index có tồn tại không.
- Phân bố `chunk_kind`.

Kỳ vọng production:

```json
{
  "healthy": true,
  "places_without_chunks": 0,
  "chunks_missing_embeddings": 0,
  "chunks_with_stale_hash": 0
}
```

## 12. Những Ràng Buộc Chống AI Bịa Đặt

StayFinder kiểm soát AI bằng nhiều lớp:

1. **Không cho LLM tự tìm dữ liệu**
   - LLM chỉ nhận context từ RAG.

2. **Structured filters trước**
   - Các tiêu chí như type, amenity, landmark, distance được xử lý bằng SQL.

3. **Prompt ràng buộc**
   - Không bịa giá, tiện ích, chính sách, an toàn, thời gian di chuyển.
   - Nếu thiếu dữ liệu thì nói không thể xác nhận.

4. **Recommended places lấy từ DB**
   - Backend map place IDs thành `recommended_places`.
   - Mobile hiển thị card thật, không hiển thị place do LLM tự nghĩ ra.

5. **Validation index**
   - Kiểm tra chunk coverage và embedding coverage.

## 13. Giới Hạn Hiện Tại Và Hướng Mở Rộng

### 13.1. Giới Hạn

- Dataset hiện tập trung Đà Nẵng.
- AI Chat hiện tối ưu cho tư vấn lưu trú, không phải trợ lý du lịch tổng quát.
- Review summaries mới sinh theo nhu cầu hoặc pregenerate, không bắt buộc có đủ toàn bộ.
- Backend hiện gọi Python RAG script theo request; phù hợp demo/đồ án, nhưng production lớn hơn có thể tách RAG thành service riêng.

### 13.2. Hướng Mở Rộng

- Tạo evaluation set 30-50 prompt để đo retrieval quality.
- Thêm reranking theo rating, distance, review_count và vector score.
- Tách RAG thành service FastAPI chạy thường trú.
- Pregenerate AI review summaries cho top places.
- Thêm conversation memory ngắn hạn cho Chat AI.
- Hỗ trợ multi-city bằng batch/key/city scope.
- Thêm dashboard data quality cho admin.

## 14. Tóm Tắt Ngắn Gọn

StayFinder dùng Apify để crawl dữ liệu Google Maps về chỗ ở tại Đà Nẵng. Dữ liệu raw được giữ để audit, còn compact JSON là nguồn chính để import vào Supabase/Postgres. Database lưu places, ảnh, reviews, amenities, landmarks, khoảng cách và các bảng AI.

AI trong project không hoạt động bằng cách để LLM tự biết tất cả. Hệ thống build `ai_place_chunks` từ dữ liệu thật, embed mỗi chunk thành vector 1536 chiều, lưu vào pgvector. Khi user chat, RAG parse intent, lọc SQL, tìm semantic chunks bằng vector search, build context nhỏ và đúng trọng tâm, rồi mới gọi LLM để trả lời. Vì vậy AI Chat có thể trả lời từ data lớn 1646 places và 8187 chunks mà không cần nhét toàn bộ database vào prompt.

Điểm cốt lõi:

```text
Crawl data thật -> chuẩn hóa DB -> build chunks -> embeddings -> RAG retrieval -> LLM answer có căn cứ
```
