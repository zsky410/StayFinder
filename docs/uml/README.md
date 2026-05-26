# PlantUML Diagrams

Các file `.puml` đã được tách sẵn từ báo cáo để tránh lỗi copy từ markdown.

## Render nhanh

```bash
# 1) Cài Graphviz + PlantUML
sudo apt-get update
sudo apt-get install -y graphviz default-jre
curl -L -o plantuml.jar https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar

# 2) Check syntax
java -jar plantuml.jar --check-syntax docs/uml/*.puml

# 3) Xuất SVG
java -jar plantuml.jar -tsvg docs/uml/*.puml
```

## Lỗi hay gặp

- `Cannot run program "/opt/local/bin/dot"`: thiếu Graphviz hoặc sai đường dẫn `dot`.
- `Syntax Error?` khi dán trực tiếp: thường do dán kèm dấu ``` của markdown.
- Font tiếng Việt lỗi: mở file SVG bằng trình duyệt có font Unicode (Noto Sans/Arial/DejaVu).
