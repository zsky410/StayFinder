const APARTMENT_TERMS = [
  "căn hộ",
  "apartment",
  "căn hộ nghỉ dưỡng cho thuê",
  "căn hộ nghỉ mát",
  "căn hộ được phục vụ",
  "đại lý cho thuê căn hộ",
  "công ty cho thuê căn hộ ngắn hạn",
  "tòa nhà với các căn hộ đã được hoàn thiện",
  "khu liên hợp căn hộ",
];

const GUESTHOUSE_TERMS = [
  "nhà trọ",
  "nhà khách",
  "nhà nghỉ",
  "nhà nghỉ trượt tuyết",
  "trạm nghỉ",
  "phòng cho thuê",
  "hostel",
  "motel",
];

const RESORT_TERMS = [
  "resort",
  "retreat",
  "khách sạn nghỉ dưỡng",
  "nhà nghỉ dưỡng",
  "trung tâm nghỉ dưỡng yoga",
  "trung tâm an dưỡng",
];

const VIETNAMESE_WEEKDAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function compactText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

export function parsePriceValue(value) {
  if (!value) return null;
  const match = String(value).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

export function normalizeAccommodationType(item) {
  const labels = [item.categoryName, ...(item.categories || []), item.title]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const source = labels.join(" | ");

  if (source.includes("homestay") || source.includes("lưu trú nhà dân")) {
    return "Homestay";
  }

  if (source.includes("biệt thự") || source.includes("villa")) {
    return "Villa";
  }

  if (APARTMENT_TERMS.some((term) => source.includes(term))) {
    return "Căn hộ";
  }

  if (RESORT_TERMS.some((term) => source.includes(term))) {
    return "Resort";
  }

  if (GUESTHOUSE_TERMS.some((term) => source.includes(term))) {
    return "Nhà nghỉ";
  }

  return "Khách sạn";
}

export function extractAmenities(item) {
  if (Array.isArray(item?.amenities)) {
    return uniqueValues(item.amenities).slice(0, 6);
  }

  const additionalInfo = item.additionalInfo || {};
  const buckets = Object.values(additionalInfo).flatMap((entry) =>
    Array.isArray(entry) ? entry : []
  );

  const enabled = buckets.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    return Object.entries(entry)
      .filter(([, value]) => value === true)
      .map(([name]) => name);
  });

  return [...new Set(enabled)].slice(0, 6);
}

function findBestOffer(hotelAds) {
  const offers = (hotelAds || [])
    .map((offer) => ({
      ...offer,
      parsedPrice: parsePriceValue(offer.price),
    }))
    .sort((left, right) => {
      if (left.parsedPrice == null) return 1;
      if (right.parsedPrice == null) return -1;
      return left.parsedPrice - right.parsedPrice;
    });

  return offers[0] || null;
}

function selectReviewText(review) {
  return compactText(review?.textTranslated || review?.text || "");
}

function buildOpeningHoursMeta(openingHours) {
  const weekly = (openingHours || [])
    .filter((entry) => entry?.day && entry?.hours)
    .map((entry) => ({
      day: entry.day,
      hours: compactText(entry.hours),
    }));

  if (!weekly.length) {
    return {
      hasData: false,
      todayDay: null,
      todayHours: null,
      primaryLabel: "Chưa có dữ liệu",
      isAllDay: false,
      openTime: null,
      closeTime: null,
      weekly,
    };
  }

  const todayLabel = VIETNAMESE_WEEKDAYS[new Date().getDay()];
  const todayEntry = weekly.find((entry) => entry.day === todayLabel) || weekly[0];
  const isAllDay = /mở cửa cả ngày/i.test(todayEntry.hours);
  const match = todayEntry.hours.match(
    /(\d{1,2}:\d{2})\s*(?:to|-|–|—)\s*(\d{1,2}:\d{2})/i
  );

  return {
    hasData: true,
    todayDay: todayEntry.day,
    todayHours: todayEntry.hours,
    primaryLabel: isAllDay
      ? "Mở cửa 24/7"
      : match
        ? `${match[1]} - ${match[2]}`
        : todayEntry.hours,
    isAllDay,
    openTime: match?.[1] || null,
    closeTime: match?.[2] || null,
    weekly,
  };
}

export function formatReviewScore(review) {
  if (review?.stars != null) return `${review.stars}/5`;
  if (review?.rating) return review.rating;
  return "N/A";
}

export function formatCompactPrice(price, fallback = "Chưa có giá") {
  return price || fallback;
}

export function formatReviewsCount(value) {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

export function shorten(value, limit = 180) {
  const text = compactText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

export function normalizePlace(item) {
  const bestOffer = item.bestOffer || findBestOffer(item.hotelAds);
  const galleryImages = uniqueValues([...(item.galleryImages || []), item.coverImage, item.imageUrl]);
  const reviewSource = Array.isArray(item.reviewList) ? item.reviewList : item.reviews || [];
  const reviewList = reviewSource
    .map((review) => ({
      ...review,
      reviewImageUrls: uniqueValues(review.reviewImageUrls || []),
      displayText: selectReviewText(review),
    }))
    .filter((review) => review.displayText || review.reviewImageUrls.length);
  const featuredReview = reviewList.find((review) => review.displayText) || reviewList[0];
  const primaryPrice = item.price || item.displayPrice || bestOffer?.price || null;
  const typeNormalized = item.typeNormalized || normalizeAccommodationType(item);
  const openingMeta = item.openingMeta || buildOpeningHoursMeta(item.openingHours);
  const amenities = extractAmenities(item);
  const reviewImageCount =
    item.reviewImageCount ??
    reviewList.reduce((sum, review) => sum + (review.reviewImageUrls?.length || 0), 0);

  return {
    ...item,
    amenities,
    bestOffer,
    coverImage: item.coverImage || galleryImages[0] || null,
    galleryImages,
    galleryCount: item.galleryCount ?? galleryImages.length,
    displayPrice: item.displayPrice || formatCompactPrice(primaryPrice),
    priceValue: item.priceValue ?? parsePriceValue(primaryPrice),
    displayAddress: item.displayAddress || item.neighborhood || item.address || item.city || "Chưa rõ",
    displayDescription:
      item.displayDescription ||
      shorten(item.hotelDescription || item.description || featuredReview?.displayText || ""),
    featuredReview,
    reviewList,
    reviewImageCount,
    openingMeta,
    typeNormalized,
  };
}
