# 1. Tên đồ án
**StayFinder - Xây dựng ứng dụng tìm kiếm chỗ lưu trú tại Đà Nẵng tích hợp Chatbot AI gợi ý thông minh**

---

# 2. Mô tả

## - Tổng quan đề tài:

- **Bối cảnh:**
Đà Nẵng là một trong những thành phố du lịch phát triển nhanh nhất Việt Nam, thu hút hàng triệu lượt khách mỗi năm. Nhu cầu tìm kiếm chỗ lưu trú (khách sạn, homestay, nhà nghỉ) tại đây rất lớn và đa dạng, từ khách đi một mình, cặp đôi, gia đình có trẻ nhỏ, nhóm bạn, đến người đi cùng thú cưng hay khách cần phòng gần sân bay vì chuyến bay đêm.

- **Insight:**
Hiện nay, công cụ phổ biến nhất người dùng dùng để tìm chỗ ở vẫn là Google Maps hoặc các nền tảng như Agoda, Booking.com. Tuy nhiên cả hai đều tồn tại những hạn chế rõ ràng:
  - Google Maps trả về quá nhiều kết quả lẫn lộn, người dùng phải tự đọc hàng trăm review và lọc thủ công
  - Agoda/Booking chỉ cho phép lọc theo tiêu chí cứng, không hiểu nhu cầu phức tạp
  - Không có kiến thức ngữ cảnh địa phương (ví dụ: khu An Thượng, lịch phun lửa Cầu Rồng)

→ Kết quả: người dùng mất nhiều thời gian nhưng vẫn không chắc chắn lựa chọn.

- **Giải pháp:**
Xây dựng hệ thống đa nền tảng đóng vai trò **“cố vấn địa phương” (Local Concierge)**:
  - Người dùng mô tả nhu cầu bằng ngôn ngữ tự nhiên
  - AI hiểu và trả về danh sách phù hợp + lý do cụ thể
  - Có thêm:
    - Bộ lọc theo khu vực, tiện ích, loại hình
    - Bản đồ
    - Tóm tắt review bằng AI
    - Nút hành động (chỉ đường, gọi điện)

- **Công nghệ sử dụng:**
  - Crawl dữ liệu: Python (Google Places API + Playwright)
  - Database: Supabase (PostgreSQL)
  - Vector search: pgvector (embedding + metadata injection)
  - Chatbot: RAG + Claude API (Anthropic)
  - Mobile: React Native (Expo)
  - Web admin: React.js
  - Backend: Node.js + Express
  - Deploy: Railway / Render

---

## - Mục tiêu dự kiến:

- Xây dựng crawler thu thập ≥ 100 địa điểm lưu trú tại Đà Nẵng
- Xây dựng hệ thống RAG:
  - Hiểu truy vấn ngôn ngữ tự nhiên
  - Trả kết quả đúng ngữ cảnh địa phương
  - Hỗ trợ hội thoại đa lượt
- Xây dựng ứng dụng Android đầy đủ tính năng:
  - Danh sách
  - Bộ lọc
  - Bản đồ
  - Chatbot
  - Tóm tắt review AI
- Xây dựng web admin quản lý dữ liệu
- Hoàn thiện báo cáo + demo thực tế

---

## - Kết quả đề tài dự kiến:

- File APK Android với đầy đủ:
  - Danh sách dạng card
  - Bộ lọc
  - Trang chi tiết + AI review
  - Bản đồ
  - Chatbot
  - Nút gọi điện / chỉ đường

- Chatbot AI:
  - Hiểu truy vấn phức tạp
  - Có ngữ cảnh địa phương Đà Nẵng
  - Hội thoại đa lượt

- Dataset ≥ 100 địa điểm:
  - Đã làm sạch
  - Lưu Supabase
  - Có embedding

- Web admin:
  - Quản lý dữ liệu địa điểm

- Backend API:
  - Deploy ổn định
  - Dùng cho mobile + web

- Báo cáo hoàn chỉnh:
  - Bài toán
  - Kiến trúc
  - Database
  - Chức năng
  - Kết quả
  - Hướng phát triển

---

# 3. Nội dung thực hiện

- Phân tích yêu cầu, thiết kế mô hình dữ liệu và wireframe UI/UX

- Thu thập dữ liệu từ Google Maps:
  - Google Places API + Playwright
  - Làm sạch, chuẩn hóa
  - Xuất JSON / Excel

- Xây dựng dữ liệu ngữ cảnh địa phương Đà Nẵng

- Import dữ liệu vào Supabase PostgreSQL:
  - Tạo embedding (metadata injection)
  - Lưu vào pgvector

- Xây dựng Backend REST API (Node.js + Express):
  - CRUD địa điểm
  - Lọc theo khu vực / tiện ích / loại hình
  - Supabase Auth
  - Deploy Railway / Render

- Xây dựng Chatbot AI (RAG):
  - Semantic search với pgvector
  - Claude API
  - Hội thoại đa lượt

- Tính năng AI Review Summarization

- Xây dựng ứng dụng Android (React Native + Expo):
  - Danh sách
  - Bộ lọc
  - Chi tiết
  - Bản đồ
  - Chatbot
  - Gọi điện / chỉ đường
  - Build APK

- Xây dựng Web Admin (React.js):
  - CRUD địa điểm
  - Quản lý khu vực / tiện ích
  - Dashboard

- Kiểm thử, tối ưu, viết báo cáo, chuẩn bị demo