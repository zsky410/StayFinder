# API

Google Maps Scraper có thể được gọi programmatically từ ứng dụng của bạn thông qua Apify API.

Để sử dụng Apify API, bạn cần:

- Một tài khoản Apify
- API token trong phần Integrations settings của Apify Console

Bạn cũng có thể chọn ngôn ngữ phù hợp khi dùng API hoặc client tương ứng.

## Python

Ví dụ Python chính thức với `apify-client`:

```python
from apify_client import ApifyClient

# Initialize the ApifyClient with your Apify API token
# Replace '<YOUR_API_TOKEN>' with your token.
client = ApifyClient("<YOUR_API_TOKEN>")

# Prepare the Actor input
run_input = {
    "searchStringsArray": ["restaurant"],
    "locationQuery": "New York, USA",
    "maxCrawledPlacesPerSearch": 50,
    "language": "en",
    "scrapeSocialMediaProfiles": {
        "facebooks": False,
        "instagrams": False,
        "youtubes": False,
        "tiktoks": False,
        "twitters": False,
    },
    "maximumLeadsEnrichmentRecords": 0,
    "maxImages": 0,
}

# Run the Actor and wait for it to finish
run = client.actor("compass/crawler-google-places").call(run_input=run_input)

# Fetch and print Actor results from the run's dataset (if there are any)
print("Check your data here: https://console.apify.com/storage/datasets/" + run["defaultDatasetId"])
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)

# Want to learn more? Go to:
# https://docs.apify.com/api/client/python/docs/quick-start
```

## Google Maps Scraper API In Python

`apify-client` for Python là thư viện chính thức để dùng Google Maps Scraper API trong Python. Thư viện này cung cấp:

- Convenience functions để gọi Actor và đọc dataset
- Automatic retries khi request lỗi

### Cài đặt

```bash
pip install apify-client
```

## Other API Clients

Ngoài Python, Apify còn cung cấp hoặc hỗ trợ các cách dùng API khác:

- JavaScript
- CLI
- OpenAPI
- HTTP

## Suggested Usage Flow

Quy trình tích hợp điển hình:

1. Tạo `run_input` theo schema của actor.
2. Gọi actor `compass/crawler-google-places`.
3. Chờ run hoàn tất.
4. Lấy `defaultDatasetId`.
5. Đọc kết quả từ dataset để đưa vào pipeline của bạn.

## Notes

- Actor ID: `compass/crawler-google-places`
- Output thường được đọc từ `defaultDatasetId`
- Nếu bạn build tool crawl riêng, đây là điểm tích hợp chính để trigger run và lấy dữ liệu về
