# PlantUML cho báo cáo StayFinder

Các sơ đồ đã chuyển từ Mermaid sang PlantUML để dùng với [PlantUML Online](https://www.plantuml.com/plantuml/uml/), VS Code extension, hoặc `java -jar plantuml.jar`.

## Danh sách file

| File | Mô tả (Hình trong báo cáo) |
|------|----------------------------|
| `fig01-usecase-overview.puml` | Hình 1 – Use case tổng quát |
| `fig02-system-context.puml` | Hình 2 – Kiến trúc tổng thể |
| `fig03-container.puml` | Hình 3 – Container |
| `fig04-mobile-architecture.puml` | Hình 4 – Kiến trúc Mobile |
| `fig05-backend-rag.puml` | Hình 5 – Backend API + RAG |
| `fig06-erd.puml` | Hình 6 – ERD |
| `fig07-class-domain.puml` | Hình 7 – Class diagram domain |
| `fig08-activity-data-pipeline.puml` | Hình 8 – Activity pipeline dữ liệu |
| `fig09-activity-search-detail.puml` | Hình 9 – Activity tìm kiếm & chi tiết |
| `fig10-rag-query-flow.puml` | Hình 10 – Luồng Chat AI / RAG query |
| `fig11-seq-get-places.puml` | Hình 11 – Sequence GET /places |
| `fig12-seq-get-place-detail.puml` | Hình 12 – Sequence GET /places/:id |
| `fig13-seq-chat-query.puml` | Hình 13 – Sequence POST /chat/query |
| `fig14-seq-review-summary.puml` | Hình 14 – Sequence POST /ai/review-summary |
| `fig15-state-ai-summary-cache.puml` | Hình 15 – State cache AI summary |
| `fig16-deployment.puml` | Hình 16 – Triển khai |

Nội dung từng file trùng với các khối `` ```plantuml `` trong `BAO_CAO_STAYFINDER.md` (Chương 2).

## Render nhanh

```bash
cd /home/zsky/mydata/Projects/codex-crawl
java -jar plantuml.jar -tsvg docs/bao-cao-plantuml/*.puml
```
