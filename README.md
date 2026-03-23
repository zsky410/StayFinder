# StayFinder Crawl Workspace

Crawler và demo web cho dataset chỗ lưu trú tại Đà Nẵng phục vụ đồ án **StayFinder**.

## Thành phần chính

- `scripts/`: script crawl Google Maps qua Apify và script chuẩn bị dataset cho web demo
- `examples/`: input mẫu cho các job crawl
- `output/`: dữ liệu crawl sinh ra cục bộ, đang được gitignore
- `web-demo/`: web demo React + Vite để duyệt dataset đã tối ưu cho frontend
- `about.md`: mô tả đề tài và định hướng hệ thống

## Yêu cầu

- Python 3.10+
- Node.js 18+
- Tài khoản Apify và `APIFY_TOKEN`

## Thiết lập nhanh

### Python

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Sau đó cập nhật `APIFY_TOKEN` thật trong `.env`.

### Web Demo

```bash
cd web-demo
npm install
npm run dev
```

## Script chính

### Crawl demo Google Maps

```bash
python scripts/apify_google_maps_demo.py
```

### Crawl batch chỗ lưu trú Đà Nẵng

```bash
python scripts/apify_danang_accommodations_batch.py
```

### Tạo dataset tối ưu cho web demo

```bash
python scripts/prepare_web_batch_dataset.py
```

## Ghi chú dữ liệu

- `output/` chứa raw và compact dataset theo batch crawl, không nên commit lên GitHub.
- `web-demo/public/data/batch-082743/` đang là dataset tĩnh phục vụ web demo hiện tại.
- Nếu repo bắt đầu quá nặng, nên chuyển dataset lớn sang release asset, object storage, hoặc database thay vì commit trực tiếp.

## Trước khi push GitHub

- Giữ `.env` ở local, không commit secret.
- Chỉ commit source code, config, ví dụ input, và dataset demo thực sự cần cho web chạy.
- Nếu từng lỡ commit token ở nơi khác, nên rotate token trước khi public repo.
