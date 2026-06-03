export const sharedAssets = {
  avatar: require("../assets/home/avatar.jpg"),
  homeHero: require("../assets/home/hero.jpg"),
  detailHero: require("../assets/results/detail-hero.jpg"),
  oceanVilla: require("../assets/results/ocean-villa.jpg"),
  sunriseBoutique: require("../assets/results/sunrise-boutique.jpg"),
  coralStudio: require("../assets/results/coral-studio.jpg"),
  nearbyHotel: require("../assets/home/nearby-hotel.jpg"),
  nearbyHomestay: require("../assets/home/nearby-homestay.jpg"),
} as const;

export const resultFilters = {
  zones: ["Mỹ Khê", "An Thượng", "Ngũ Hành Sơn", "Hải Châu", "Sơn Trà"],
  types: ["Khách sạn", "Homestay", "Căn hộ"],
  amenities: [
    { label: "WiFi miễn phí", checked: false },
    { label: "Hồ bơi", checked: true },
    { label: "Bãi đỗ xe", checked: false },
    { label: "Cho phép thú cưng", checked: false },
  ],
} as const;

export const resultCards = [
  {
    id: "demo-result",
    title: "Demo result placeholder",
    location: "Dữ liệu thật từ API",
    oldPrice: null,
    price: null,
    rating: null,
    badge: { label: "Demo", tone: "blue" as const },
    chips: [],
    image: sharedAssets.homeHero,
  },
] as const;

export const aiChatDemo = {
  headerTitle: "AI Tư vấn Đà Nẵng",
  statusText: "Đang hoạt động",
  timestamp: "Hôm nay, 09:41 AM",
  messages: [
    {
      id: "user-1",
      role: "user" as const,
      text: "Mình cần tìm một homestay yên tĩnh gần biển, cho phép mang theo thú cưng và tiện đi xem cầu Rồng phun lửa.",
    },
    {
      id: "assistant-1",
      role: "assistant" as const,
      text: "Nhập câu hỏi của bạn để AI trả lời dựa trên dữ liệu thật từ database.",
    },
  ],
  suggestions: [
    {
      id: "demo-result",
      detailId: "demo-result" as const,
      title: "Demo place",
      area: "Đang chờ API",
      rating: "0.0",
      priceShort: "-",
      image: sharedAssets.homeHero,
    },
  ],
} as const;

export const savedPlacesDemo = [
  {
    id: "saved-demo",
    detailId: "demo-result" as const,
    title: "Saved demo",
    location: "Dữ liệu thật từ API",
    oldPrice: null,
    price: null,
    rating: null,
    image: sharedAssets.homeHero,
  },
] as const;

export const detailByPlaceId = {
  demo: {
    id: "demo",
    title: "Demo detail",
    distance: "Dữ liệu thật từ API",
    mapLabel: "Bản đồ",
    price: "-",
    rating: "-",
    reviewsCount: "-",
    photoCount: "-",
    heroImage: sharedAssets.detailHero,
    tags: [],
    summary: {
      positiveTitle: "Dữ liệu demo",
      positiveText: "Detail thật sẽ đến từ GET /places/:id.",
      cautionTitle: "Dữ liệu demo",
      cautionText: "Các place cũ trong file này đã được dọn để tránh route giả.",
    },
    amenities: [],
    locationDescription: "Màn này chỉ giữ placeholder, không còn dẫn sang place giả.",
  },
} as const;

export type DetailPlaceId = keyof typeof detailByPlaceId;
