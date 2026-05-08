import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { aiChatDemo } from "@/data/demo-stays";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const suggestionAnchorMessageId = aiChatDemo.messages[1]?.id;

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function buildAssistantReply(input: string) {
  const normalized = normalizeText(input);

  if (normalized.includes("thuong luong") || normalized.includes("gia")) {
    return "Nếu ở 7-10 ngày, nhiều homestay tại Mỹ Khê hoặc An Thượng có thể hỗ trợ giá tốt hơn hoặc miễn phí dọn phòng giữa kỳ. Bạn nên ưu tiên hỏi theo combo ở dài ngày để dễ thương lượng hơn.";
  }

  if (normalized.includes("song han") || normalized.includes("cau rong")) {
    return "Nếu bạn thích gần sông Hàn hoặc tiện xem Cầu Rồng, mình sẽ ưu tiên khu Hải Châu và tuyến Bạch Đằng. Khu này đẹp về đêm, nhiều quán ăn và đi bộ ra cầu khá thuận tiện.";
  }

  if (normalized.includes("gan bien") || normalized.includes("my khe") || normalized.includes("pet")) {
    return "Mình sẽ ưu tiên các chỗ ở quanh Mỹ Khê, An Thượng và đầu bán đảo Sơn Trà vì vừa gần biển, vừa dễ gọi xe vào trung tâm. Nếu cần, mình có thể lọc tiếp theo tiêu chí pet-friendly hoặc có bếp riêng.";
  }

  return "Mình có thể tiếp tục lọc theo khu vực, mức giá, tiện nghi hoặc loại hình lưu trú để gợi ý sát hơn. Bạn cứ nhắn thêm 1-2 tiêu chí là mình thu hẹp danh sách ngay.";
}

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
  const pendingReplyTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [draftMessage, setDraftMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [...aiChatDemo.messages]);
  const [pendingAssistantReplies, setPendingAssistantReplies] = useState(0);

  const hasDraftMessage = draftMessage.trim().length > 0;
  const isAssistantTyping = pendingAssistantReplies > 0;
  const userMessageMaxWidth = Math.min(width * 0.56, 214);
  const assistantMessageMaxWidth = Math.min(width * 0.66, 236);
  const suggestionCardWidth = Math.min(width - 152, 226);
  const suggestionImageSize = Math.min(76, Math.max(66, width * 0.2));

  useEffect(() => {
    return () => {
      pendingReplyTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function scrollToBottom(animated = true) {
    scrollViewRef.current?.scrollToEnd({ animated });
  }

  function handleSendMessage() {
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

    const replyTimer = setTimeout(() => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: buildAssistantReply(trimmedMessage),
        },
      ]);
      setPendingAssistantReplies((count) => Math.max(count - 1, 0));
      pendingReplyTimeoutsRef.current = pendingReplyTimeoutsRef.current.filter((timer) => timer !== replyTimer);
    }, 780);

    pendingReplyTimeoutsRef.current.push(replyTimer);
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
              {aiChatDemo.headerTitle}
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
                {aiChatDemo.statusText}
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
          {aiChatDemo.timestamp}
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

                {message.id === suggestionAnchorMessageId ? (
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
                        {aiChatDemo.suggestions.map((item) => (
                          <Pressable
                            key={item.id}
                            onPress={() =>
                              router.push({
                                pathname: "/place/[place-id]",
                                params: { "place-id": item.detailId },
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
                            <Image
                              source={item.image}
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
                                  {item.rating}
                                </Text>
                                <Text selectable style={{ color: "#A1A8BD", fontSize: 11.5 }}>•</Text>
                                <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, flexShrink: 1, fontSize: 11.5, fontWeight: "500" }}>
                                  {item.area}
                                </Text>
                              </View>

                              <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 4 }}>
                                <Text selectable style={{ color: theme.colors.sun, fontSize: 15, fontWeight: "700" }}>
                                  {item.priceShort}
                                </Text>
                                <Text selectable style={{ color: theme.colors.muted, fontSize: 11.5, fontWeight: "500" }}>
                                  /đêm
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
