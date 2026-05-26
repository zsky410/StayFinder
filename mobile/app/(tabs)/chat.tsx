import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafeImage } from "@/components/safe-image";
import { theme } from "@/constants/theme";
import { fetchChatQuery, type PlaceSummary } from "@/lib/stayfinder";
import { formatPriceText, formatRating, getImageSource } from "@/lib/stayfinder-ui";

const fallbackImage = require("../../assets/results/detail-hero.jpg");
const headerTitle = "AI Tư vấn Đà Nẵng";
const statusText = "Đang kết nối RAG";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  recommendedPlaces?: PlaceSummary[];
};

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    text: "Chào bạn, mình là StayFinder AI. Bạn có thể hỏi về khu vực, tiện nghi, khoảng cách tới biển/sân bay/trung tâm hoặc kiểu chỗ ở ở Đà Nẵng.",
  },
];

function AssistantAvatar() {
  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "flex-end",
        backgroundColor: "#EAF0FF",
        borderRadius: 999,
        height: 32,
        justifyContent: "center",
        marginBottom: 4,
        width: 32,
      }}
    >
      <MaterialCommunityIcons color={theme.colors.accent} name="robot-excited-outline" size={17} />
    </View>
  );
}

export default function ChatTabRoute() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);

  const [draftMessage, setDraftMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [...initialMessages]);
  const [pendingAssistantReplies, setPendingAssistantReplies] = useState(0);

  const hasDraftMessage = draftMessage.trim().length > 0;
  const isAssistantTyping = pendingAssistantReplies > 0;
  const userMessageMaxWidth = Math.min(width * 0.56, 214);
  const assistantMessageMaxWidth = Math.min(width * 0.66, 236);
  const suggestionCardWidth = Math.min(width - 152, 226);
  const suggestionImageSize = Math.min(76, Math.max(66, width * 0.2));

  function scrollToBottom(animated = true) {
    scrollViewRef.current?.scrollToEnd({ animated });
  }

  async function handleSendMessage() {
    const trimmedMessage = draftMessage.trim();

    if (!trimmedMessage) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedMessage,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraftMessage("");
    setPendingAssistantReplies((count) => count + 1);

    try {
      const response = await fetchChatQuery(trimmedMessage);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response.answer,
          recommendedPlaces: response.recommended_places,
        },
      ]);
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text:
            error instanceof Error
              ? `Mình chưa gọi được AI chat: ${error.message}`
              : "Mình chưa gọi được AI chat. Bạn thử lại sau nhé.",
        },
      ]);
    } finally {
      setPendingAssistantReplies((count) => Math.max(count - 1, 0));
    }
  }

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />

      <ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 16,
          paddingBottom: Math.max(insets.bottom + 224, 240),
          paddingHorizontal: 18,
          paddingTop: Math.max(insets.top + 8, 18),
        }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollToBottom()}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: "#DCE9FF",
              borderRadius: 999,
              borderCurve: "continuous",
              height: 46,
              justifyContent: "center",
              width: 46,
            }}
          >
            <MaterialCommunityIcons color={theme.colors.accent} name="robot-excited-outline" size={22} />
          </View>

          <View style={{ gap: 2 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "700" }}>
              {headerTitle}
            </Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <View
                style={{
                  backgroundColor: "#25C65A",
                  borderRadius: 999,
                  height: 9,
                  width: 9,
                }}
              />
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "500" }}>
                {statusText}
              </Text>
            </View>
          </View>
        </View>

        <Text
          selectable
          style={{
            color: "#C5CBDB",
            fontSize: 13,
            fontWeight: "500",
            textAlign: "center",
          }}
        >
          Hôm nay
        </Text>

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <View key={message.id} style={{ alignItems: "flex-end", paddingLeft: 98 }}>
                <Animated.View
                  entering={FadeInRight.duration(220)}
                  style={{
                    alignSelf: "flex-end",
                    backgroundColor: "#3565EA",
                    borderRadius: 22,
                    borderBottomRightRadius: 10,
                    borderCurve: "continuous",
                    maxWidth: userMessageMaxWidth,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                  }}
                >
                  <Text selectable style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 20 }}>
                    {message.text}
                  </Text>
                </Animated.View>
              </View>
            );
          }

          const recommendedPlaces = message.recommendedPlaces || [];

          return (
            <View key={message.id} style={{ flexDirection: "row", gap: 9 }}>
              <AssistantAvatar />

              <View style={{ flex: 1, gap: 12, paddingRight: 24 }}>
                <Animated.View
                  entering={FadeInLeft.duration(220)}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: "#FFFFFF",
                    borderRadius: 22,
                    borderBottomLeftRadius: 10,
                    borderCurve: "continuous",
                    maxWidth: assistantMessageMaxWidth,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    boxShadow: "0 14px 34px rgba(20, 27, 52, 0.08)",
                  }}
                >
                  <Text selectable style={{ color: theme.colors.ink, fontSize: 14, lineHeight: 21 }}>
                    {message.text}
                  </Text>
                </Animated.View>

                {recommendedPlaces.length ? (
                  <Animated.View entering={FadeInLeft.duration(240)} style={{ gap: 9 }}>
                    <Text
                      selectable
                      style={{
                        color: "#868DA5",
                        fontSize: 10,
                        fontWeight: "600",
                        letterSpacing: 0.65,
                      }}
                    >
                      ĐỀ XUẤT PHÙ HỢP
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", gap: 12, paddingRight: 8 }}>
                        {recommendedPlaces.map((item) => (
                          <Pressable
                            key={item.place_id}
                            onPress={() =>
                              router.push({
                                pathname: "/place/[place-id]",
                                params: { "place-id": item.place_id },
                              })
                            }
                            style={({ pressed }) => ({
                              backgroundColor: "#FFFFFF",
                              borderRadius: 18,
                              borderCurve: "continuous",
                              flexDirection: "row",
                              gap: 10,
                              width: suggestionCardWidth,
                              opacity: pressed ? 0.92 : 1,
                              padding: 10,
                              boxShadow: "0 14px 34px rgba(20, 27, 52, 0.08)",
                            })}
                          >
                            <SafeImage
                              fallbackSource={fallbackImage}
                              source={getImageSource(item.cover_image, fallbackImage)}
                              style={{
                                borderRadius: 12,
                                height: suggestionImageSize,
                                width: suggestionImageSize,
                              }}
                            />

                            <View style={{ flex: 1, gap: 6, justifyContent: "center" }}>
                              <Text selectable numberOfLines={2} style={{ color: theme.colors.ink, fontSize: 13, fontWeight: "600", lineHeight: 17 }}>
                                {item.title}
                              </Text>

                              <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                                <Feather color={theme.colors.accent} name="star" size={12} />
                                <Text selectable style={{ color: theme.colors.accent, fontSize: 11.5, fontWeight: "600" }}>
                                  {formatRating(item.rating)}
                                </Text>
                                <Text selectable style={{ color: "#A1A8BD", fontSize: 11.5 }}>•</Text>
                                <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, flexShrink: 1, fontSize: 11.5, fontWeight: "500" }}>
                                  {item.district || item.neighborhood || "Đà Nẵng"}
                                </Text>
                              </View>

                              <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 4 }}>
                                <Text selectable style={{ color: theme.colors.sun, fontSize: 15, fontWeight: "700" }}>
                                  {formatPriceText(item.price_text)}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </Animated.View>
                ) : null}
              </View>
            </View>
          );
        })}

        {isAssistantTyping ? (
          <View style={{ flexDirection: "row", gap: 9 }}>
            <AssistantAvatar />

            <Animated.View
              entering={FadeInLeft.duration(180)}
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#FFFFFF",
                borderRadius: 22,
                borderBottomLeftRadius: 10,
                borderCurve: "continuous",
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 12,
                boxShadow: "0 14px 34px rgba(20, 27, 52, 0.08)",
              }}
            >
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[0, 1, 2].map((dot) => (
                  <View
                    key={dot}
                    style={{
                      backgroundColor: "#AAB5CD",
                      borderRadius: 999,
                      height: 6,
                      opacity: 1 - dot * 0.18,
                      width: 6,
                    }}
                  />
                ))}
              </View>
              <Text selectable style={{ color: "#8A95B1", fontSize: 12, fontWeight: "500" }}>
                StayFinder AI đang soạn...
              </Text>
            </Animated.View>
          </View>
        ) : null}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={{
          bottom: Math.max(insets.bottom + 86, 102),
          left: 0,
          paddingHorizontal: 18,
          position: "absolute",
          right: 0,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.98)",
            borderRadius: 22,
            borderCurve: "continuous",
            flexDirection: "row",
            gap: 10,
            minHeight: 58,
            paddingLeft: 16,
            paddingRight: 8,
            paddingVertical: 8,
            boxShadow: "0 16px 34px rgba(20, 27, 52, 0.12)",
          }}
        >
          <Feather color="#98A2BD" name="edit-3" size={16} />

          <TextInput
            blurOnSubmit={false}
            onChangeText={setDraftMessage}
            onFocus={() => scrollToBottom(false)}
            onSubmitEditing={handleSendMessage}
            placeholder="Nhắn cho StayFinder AI..."
            placeholderTextColor="#B3BACD"
            returnKeyType="send"
            selectionColor={theme.colors.accent}
            style={{
              color: theme.colors.ink,
              flex: 1,
              fontSize: 14,
              fontWeight: "500",
              paddingVertical: 0,
            }}
            value={draftMessage}
          />

          <Pressable
            disabled={!hasDraftMessage}
            onPress={handleSendMessage}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: hasDraftMessage ? theme.colors.accent : "#E8EEFA",
              borderRadius: 16,
              borderCurve: "continuous",
              height: 42,
              justifyContent: "center",
              opacity: pressed ? 0.84 : 1,
              width: 42,
            })}
          >
            <Feather color={hasDraftMessage ? "#FFFFFF" : "#9CA6BF"} name="send" size={16} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
