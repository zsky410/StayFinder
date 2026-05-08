import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import { Animated, Image, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/brand-header";
import { theme } from "@/constants/theme";
import { savedPlacesDemo } from "@/data/demo-stays";

const DELETE_ACTION_WIDTH = 132;
const CARD_HEIGHT = 142;

type SavedPlace = (typeof savedPlacesDemo)[number];

function SwipeableSavedCard({
  item,
  onDelete,
}: {
  item: SavedPlace;
  onDelete: (id: string) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffsetRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);

  const snapTo = (toValue: number) => {
    currentOffsetRef.current = toValue;
    setIsOpen(toValue !== 0);

    Animated.spring(translateX, {
      bounciness: 0,
      speed: 20,
      toValue,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 6,
        onPanResponderGrant: () => {
          translateX.stopAnimation((value) => {
            currentOffsetRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.max(
            -DELETE_ACTION_WIDTH,
            Math.min(0, currentOffsetRef.current + gestureState.dx)
          );

          translateX.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextValue = Math.max(
            -DELETE_ACTION_WIDTH,
            Math.min(0, currentOffsetRef.current + gestureState.dx)
          );

          const shouldOpen =
            nextValue < DELETE_ACTION_WIDTH * -0.42 || gestureState.vx < -0.45;

          snapTo(shouldOpen ? -DELETE_ACTION_WIDTH : 0);
        },
        onPanResponderTerminate: () => {
          snapTo(isOpen ? -DELETE_ACTION_WIDTH : 0);
        },
      }),
    [isOpen, translateX]
  );

  return (
    <View style={{ height: CARD_HEIGHT, position: "relative" }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#CF1D1D",
          borderBottomRightRadius: 28,
          borderTopRightRadius: 28,
          bottom: 0,
          justifyContent: "center",
          position: "absolute",
          right: 0,
          top: 0,
          width: DELETE_ACTION_WIDTH,
        }}
      >
        <Pressable
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.82 : 1,
            paddingHorizontal: 20,
            paddingVertical: 14,
          })}
        >
          <MaterialCommunityIcons color="#FFFFFF" name="trash-can-outline" size={28} />
          <Text
            selectable
            style={{
              color: "#FFFFFF",
              fontSize: 18,
              fontWeight: "600",
              marginTop: 8,
            }}
          >
            Xoá
          </Text>
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX }],
        }}
      >
        <Pressable
          onPress={() => {
            if (isOpen) {
              snapTo(0);
              return;
            }

            router.push({
              params: { "place-id": item.detailId },
              pathname: "/place/[place-id]",
            });
          }}
          style={({ pressed }) => ({
            backgroundColor: "#FFFFFF",
            borderRadius: 28,
            borderCurve: "continuous",
            flexDirection: "row",
            height: CARD_HEIGHT,
            opacity: pressed ? 0.94 : 1,
            overflow: "hidden",
            boxShadow: "0 14px 34px rgba(20, 27, 52, 0.10)",
          })}
        >
          <View style={{ height: CARD_HEIGHT, position: "relative", width: 126 }}>
            <Image
              source={item.image}
              style={{
                height: CARD_HEIGHT,
                width: 126,
              }}
            />

            {item.rating ? (
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.96)",
                  borderRadius: 999,
                  borderCurve: "continuous",
                  flexDirection: "row",
                  gap: 6,
                  left: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  position: "absolute",
                  top: 14,
                }}
              >
                <Feather color={theme.colors.sun} name="star" size={14} />
                <Text selectable style={{ color: theme.colors.ink, fontSize: 13, fontWeight: "600" }}>
                  {item.rating}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ flex: 1, gap: 10, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 18 }}>
            <Text
              selectable
              numberOfLines={2}
              style={{
                color: theme.colors.ink,
                fontSize: 18,
                fontWeight: "700",
                lineHeight: 24,
              }}
            >
              {item.title}
            </Text>

            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Feather color={theme.colors.muted} name="map-pin" size={16} />
              <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, flex: 1, fontSize: 13, fontWeight: "500" }}>
                {item.location}
              </Text>
            </View>

            <View style={{ gap: item.oldPrice ? 4 : 0 }}>
              {item.oldPrice ? (
                <Text
                  selectable
                  style={{
                    color: "#7D8498",
                    fontSize: 14,
                    fontWeight: "500",
                    textDecorationLine: "line-through",
                  }}
                >
                  {item.oldPrice}
                </Text>
              ) : null}

              <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 4 }}>
                <Text selectable style={{ color: theme.colors.sun, fontSize: 20, fontWeight: "700" }}>
                  {item.price}
                </Text>
                <Text selectable style={{ color: theme.colors.ink, fontSize: 14, fontWeight: "500" }}>
                  /đêm
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function SavedTabRoute() {
  const insets = useSafeAreaInsets();
  const [savedItems, setSavedItems] = useState<SavedPlace[]>(() => [...savedPlacesDemo]);

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 20,
          paddingBottom: Math.max(insets.bottom + 120, 138),
          paddingHorizontal: 18,
          paddingTop: Math.max(insets.top + 10, 22),
        }}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader bellColor={theme.colors.accent} bellSize={28} logoHeight={44} logoWidth={188} />

        <View style={{ gap: 8, paddingTop: 18 }}>
          <Text selectable style={{ color: theme.colors.ink, fontSize: 31, fontWeight: "700", lineHeight: 38 }}>
            {`Địa điểm đã lưu (${savedItems.length})`}
          </Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 16 }}>
            Quản lý những nơi bạn yêu thích
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          {savedItems.map((item) => (
            <SwipeableSavedCard
              key={item.id}
              item={item}
              onDelete={(id) => {
                setSavedItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== id));
              }}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
