import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

const avatarImage = require("../../assets/home/avatar.jpg");
const heroImage = require("../../assets/home/hero.jpg");

const quickFilters = [
  {
    label: "Khách sạn",
    icon: "bed-king-outline" as const,
    selected: true,
  },
  {
    label: "Homestay",
    icon: "home-city-outline" as const,
    selected: false,
  },
  {
    label: "Nhà nghỉ",
    icon: "bed-outline" as const,
    selected: false,
  },
];

const featuredPlaces = [
  {
    id: "demo-bien-xanh",
    title: "Homestay Biển Xanh",
    location: "Sơn Trà, Đà Nẵng",
    price: "450.000đ",
    rating: "4.8",
    image: require("../../assets/home/featured-beach.jpg"),
  },
  {
    id: "demo-son-tra-villa",
    title: "Villa Sơn Trà",
    location: "Sơn Trà, Đà Nẵng",
    price: "1.200.000đ",
    rating: "4.9",
    image: require("../../assets/home/featured-villa.jpg"),
  },
];

const nearbyPlaces = [
  {
    id: "demo-azure-boutique",
    title: "Azure Boutique Hotel",
    distance: "Cách 1.2km",
    price: "650.000đ",
    rating: "4.7",
    image: require("../../assets/home/nearby-hotel.jpg"),
  },
  {
    id: "demo-mykhe-sunrise",
    title: "MyKhe Sunrise Homestay",
    distance: "Cách 2.5km",
    price: "350.000đ",
    rating: "4.9",
    image: require("../../assets/home/nearby-homestay.jpg"),
  },
];

function SectionHeader({ title, actionLabel }: { title: string; actionLabel?: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
      <Text selectable style={{ color: theme.colors.ink, fontSize: 18, fontWeight: "800" }}>
        {title}
      </Text>
      {actionLabel ? (
        <Text selectable style={{ color: theme.colors.accent, fontSize: 14, fontWeight: "800" }}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

function SearchBar() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.chipBorder,
        borderRadius: 20,
        borderWidth: 1,
        boxShadow: "0 10px 24px rgba(20, 27, 52, 0.05)",
        flexDirection: "row",
        overflow: "hidden",
        paddingLeft: 18,
      }}
    >
      <Pressable
        onPress={() => router.push("/results")}
        style={{
          alignItems: "center",
          flex: 1,
          flexDirection: "row",
          gap: 14,
          minHeight: 62,
        }}
      >
        <Feather color={theme.colors.muted} name="search" size={24} />
        <Text selectable style={{ color: "#C2C7DA", fontSize: 17, fontWeight: "500" }}>
          Bạn muốn đến đâu?
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/filter-sheet")}
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          minHeight: 62,
          opacity: pressed ? 0.65 : 1,
          paddingHorizontal: 18,
        })}
      >
        <Feather color={theme.colors.muted} name="sliders" size={22} />
      </Pressable>
    </View>
  );
}

function QuickFilterChip({
  label,
  icon,
  selected,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  selected: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.push("/results")}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? "#F7F9FF" : theme.colors.chipBackground,
        borderColor: selected ? theme.colors.accent : "transparent",
        borderRadius: 14,
        borderWidth: 1.5,
        flex: 1,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        minHeight: 48,
        opacity: pressed ? 0.8 : 1,
        paddingHorizontal: 12,
      })}
    >
      <MaterialCommunityIcons color={selected ? theme.colors.accent : theme.colors.ink} name={icon} size={18} />
      <Text
        selectable
        style={{
          color: selected ? theme.colors.accent : theme.colors.ink,
          fontSize: 15,
          fontWeight: selected ? "700" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FeaturedCard({
  width,
  title,
  location,
  price,
  rating,
  image,
  placeId,
}: {
  width: number;
  title: string;
  location: string;
  price: string;
  rating: string;
  image: ImageSourcePropType;
  placeId: string;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/place/[place-id]", params: { "place-id": placeId } })}
      style={({ pressed }) => ({
        borderRadius: 22,
        borderCurve: "continuous",
        marginRight: 14,
        opacity: pressed ? 0.92 : 1,
        paddingBottom: 8,
        width,
      })}
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 22,
          borderCurve: "continuous",
          boxShadow: "0 12px 28px rgba(20, 27, 52, 0.10)",
        }}
      >
        <View style={{ borderRadius: 22, borderCurve: "continuous", overflow: "hidden" }}>
          <View>
            <Image source={image} style={{ height: 186, width: "100%" }} />
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                borderCurve: "continuous",
                flexDirection: "row",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                position: "absolute",
                right: 12,
                top: 12,
              }}
            >
              <Feather color={theme.colors.sun} name="star" size={14} />
              <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "700" }}>
                {rating}
              </Text>
            </View>
          </View>

          <View style={{ gap: 7, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 12 }}>
            <Text selectable numberOfLines={2} style={{ color: theme.colors.ink, fontSize: 17, fontWeight: "800" }}>
              {title}
            </Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <Feather color={theme.colors.muted} name="map-pin" size={15} />
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
                {location}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 2 }}>
              <Text selectable style={{ color: theme.colors.sun, fontSize: 18, fontWeight: "800" }}>
                {price}
              </Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "500" }}>
                /đêm
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function NearbyCard({
  title,
  distance,
  price,
  rating,
  image,
  placeId,
}: {
  title: string;
  distance: string;
  price: string;
  rating: string;
  image: ImageSourcePropType;
  placeId: string;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/place/[place-id]", params: { "place-id": placeId } })}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        borderCurve: "continuous",
        flexDirection: "row",
        gap: 14,
        opacity: pressed ? 0.94 : 1,
        overflow: "hidden",
        padding: 10,
        boxShadow: "0 12px 28px rgba(20, 27, 52, 0.08)",
      })}
    >
      <Image
        source={image}
        style={{
          borderRadius: 14,
          height: 104,
          width: 104,
        }}
      />

      <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
        <View style={{ alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }}>
          <Text
            selectable
            numberOfLines={2}
            style={{ color: theme.colors.ink, flex: 1, fontSize: 18, fontWeight: "800", lineHeight: 23 }}
          >
            {title}
          </Text>
          <View
            style={{
              alignItems: "center",
              backgroundColor: "#FFF5EB",
              borderRadius: 10,
              borderCurve: "continuous",
              flexDirection: "row",
              gap: 5,
              marginLeft: 12,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            <Feather color={theme.colors.sun} name="star" size={12} />
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "700" }}>
              {rating}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <Feather color={theme.colors.muted} name="map" size={14} />
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
            {distance}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 2 }}>
          <Text selectable style={{ color: theme.colors.sun, fontSize: 18, fontWeight: "800" }}>
            {price}
          </Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "500" }}>
            /đêm
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeTabRoute() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const featuredCardWidth = Math.min(width * 0.62, 250);

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 20,
          paddingBottom: 140,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 18),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <Image source={avatarImage} style={{ borderRadius: 24, height: 48, width: 48 }} />
            <Text selectable style={{ color: theme.colors.accent, fontSize: 25, fontWeight: "800" }}>
              StayFinder VN
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/chat")}
            style={({ pressed }) => ({
              alignItems: "center",
              height: 42,
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
              width: 42,
            })}
          >
            <Feather color={theme.colors.ink} name="bell" size={24} />
            <View
              style={{
                backgroundColor: theme.colors.coral,
                borderColor: theme.colors.surface,
                borderRadius: 999,
                borderWidth: 2,
                height: 12,
                position: "absolute",
                right: 5,
                top: 5,
                width: 12,
              }}
            />
          </Pressable>
        </View>

        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 15, fontWeight: "800", letterSpacing: 0.8 }}>
            TÌM KIẾM
          </Text>
          <SearchBar />
        </View>

        <Pressable
          onPress={() => router.push("/results")}
          style={({ pressed }) => ({
            borderRadius: 24,
            borderCurve: "continuous",
            overflow: "hidden",
            opacity: pressed ? 0.95 : 1,
            boxShadow: "0 14px 30px rgba(20, 27, 52, 0.14)",
          })}
        >
          <ImageBackground source={heroImage} style={{ height: 238, justifyContent: "flex-end" }}>
            <View
              style={{
                backgroundColor: "rgba(16, 24, 48, 0.18)",
                bottom: 0,
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            />
            <View style={{ gap: 8, padding: 22 }}>
              <Text
                selectable
                style={{
                  color: "#FFFFFF",
                  fontSize: 23,
                  fontWeight: "800",
                  lineHeight: 34,
                  maxWidth: 240,
                  textShadowColor: "rgba(0, 0, 0, 0.28)",
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 4,
                }}
              >
                Tìm chỗ lưu trú{"\n"}tại Đà Nẵng
              </Text>
            </View>
          </ImageBackground>
        </Pressable>

        <View style={{ gap: 14 }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 15, fontWeight: "800", letterSpacing: 0.8 }}>
            BỘ LỌC NHANH
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {quickFilters.map((item) => (
              <QuickFilterChip icon={item.icon} key={item.label} label={item.label} selected={item.selected} />
            ))}
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Pressable onPress={() => router.push("/results")}>
            <SectionHeader actionLabel="XEM TẤT CẢ" title="Nổi bật" />
          </Pressable>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 10, paddingLeft: 2, paddingRight: 18, paddingTop: 2 }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {featuredPlaces.map((place) => (
              <FeaturedCard
                image={place.image}
                key={place.id}
                location={place.location}
                placeId={place.id}
                price={place.price}
                rating={place.rating}
                title={place.title}
                width={featuredCardWidth}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: 14 }}>
          <SectionHeader title="Gần bạn" />
          <View style={{ gap: 16 }}>
            {nearbyPlaces.map((place) => (
              <NearbyCard
                distance={place.distance}
                image={place.image}
                key={place.id}
                placeId={place.id}
                price={place.price}
                rating={place.rating}
                title={place.title}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
