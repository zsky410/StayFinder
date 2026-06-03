# StayFinder Admin (React + Vite)

Web admin gọn nhẹ để demo: CRUD địa điểm / landmarks / context notes và dashboard chỉ số,
dùng trực tiếp các endpoint `/admin/*` của StayFinder backend.

## Yêu cầu

- Node.js >= 18
- Backend StayFinder đang chạy (mặc định `http://localhost:3001`)
- Backend phải có `ADMIN_API_TOKEN` trong `.env` (các endpoint `/admin/*` yêu cầu header `x-admin-token`)

> Đã thêm sẵn `ADMIN_API_TOKEN=stayfinder-admin-demo-2026` và `CORS_ORIGIN=http://localhost:5174`
> vào file `.env` của backend. Khởi động lại backend để áp dụng.

## Chạy

```bash
cd admin
npm install
npm run dev
```

Mở `http://localhost:5174`, nhập admin token (`stayfinder-admin-demo-2026`) để đăng nhập.

### Trỏ tới backend khác

Tạo file `admin/.env`:

```
VITE_API_BASE_URL=http://localhost:3001
```

## Tính năng

- **Dashboard**: tổng số địa điểm, landmarks, tiện ích, context notes, khoảng rating;
  biểu đồ cột theo khu vực / loại hình / tiện ích / landmark; bảng admin jobs gần đây.
- **Địa điểm**: tìm kiếm, phân trang, tạo / sửa / xoá (kèm tiện ích & gallery).
- **Landmarks**: CRUD mốc địa lý (slug, name, kind, toạ độ, metadata JSON).
- **Context notes**: CRUD ghi chú ngữ cảnh dùng cho RAG.

## Build production

```bash
npm run build
npm run preview
```

## Lưu ý bảo mật

Admin token lưu ở `localStorage` của trình duyệt và gửi qua header `x-admin-token`.
Token demo chỉ dùng nội bộ — đổi `ADMIN_API_TOKEN` trước khi đưa ra môi trường thật.
