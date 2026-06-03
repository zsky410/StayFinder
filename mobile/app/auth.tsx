import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/brand-header";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";

type AuthMode = "login" | "signup";

function AuthTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.colors.ink, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#B8C0D6"
        secureTextEntry={secureTextEntry}
        selectionColor={theme.colors.accent}
        style={{
          backgroundColor: "#F8FAFF",
          borderColor: theme.colors.chipBorder,
          borderRadius: 16,
          borderWidth: 1,
          color: theme.colors.ink,
          fontSize: 15,
          fontWeight: "600",
          minHeight: 54,
          paddingHorizontal: 14,
        }}
        value={value}
      />
    </View>
  );
}

export default function AuthRoute() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isInitializing, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLogin = mode === "login";

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      router.replace("/(tabs)/home");
    }
  }, [isAuthenticated, isInitializing]);

  async function submitAuth() {
    const cleanedEmail = email.trim();
    if (!cleanedEmail || !password) {
      setErrorMessage("Vui lòng nhập email và mật khẩu.");
      return;
    }
    if (!isLogin && password.length < 6) {
      setErrorMessage("Mật khẩu cần có ít nhất 6 ký tự.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (isLogin) {
        await signIn(cleanedEmail, password);
      } else {
        await signUp({
          displayName: displayName.trim() || undefined,
          email: cleanedEmail,
          password,
        });
      }
      router.replace("/(tabs)/profile");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Chưa đăng nhập được. Bạn thử lại nhé.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: theme.colors.page, flex: 1 }}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          gap: 22,
          paddingBottom: Math.max(insets.bottom + 28, 44),
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 12, 24),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader
          bellSize={24}
          logoHeight={44}
          logoWidth={188}
          onPressBell={undefined}
        />

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 }}>
            {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản"}
          </Text>
          <Text style={{ color: theme.colors.muted, fontSize: 15, fontWeight: "500", lineHeight: 23 }}>
            {isLogin
              ? "Đăng nhập để lưu địa điểm yêu thích và tiếp tục trải nghiệm cá nhân hóa."
              : "Tạo tài khoản StayFinder để lưu địa điểm, quản lý hồ sơ và dùng các tính năng cá nhân."}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: 18,
            padding: 18,
          }}
        >
          <View style={{ backgroundColor: "#EEF2FF", borderRadius: 18, flexDirection: "row", padding: 4 }}>
            {(["login", "signup"] as const).map((item) => {
              const active = mode === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setMode(item);
                    setErrorMessage(null);
                  }}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: active ? theme.colors.surface : "transparent",
                    borderRadius: 14,
                    flex: 1,
                    minHeight: 44,
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: active ? theme.colors.ink : theme.colors.muted,
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    {item === "login" ? "Đăng nhập" : "Đăng ký"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!isLogin ? (
            <AuthTextInput
              label="Tên hiển thị"
              onChangeText={setDisplayName}
              placeholder="Ví dụ: Minh Anh"
              value={displayName}
            />
          ) : null}

          <AuthTextInput
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="you@example.com"
            value={email}
          />
          <AuthTextInput
            label="Mật khẩu"
            onChangeText={setPassword}
            placeholder={isLogin ? "Nhập mật khẩu" : "Tối thiểu 6 ký tự"}
            secureTextEntry
            value={password}
          />

          {errorMessage ? (
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#FFF4F4",
                borderColor: "#F0CECE",
                borderRadius: 14,
                borderWidth: 1,
                flexDirection: "row",
                gap: 8,
                padding: 12,
              }}
            >
              <Feather color={theme.colors.coral} name="alert-circle" size={16} />
              <Text style={{ color: theme.colors.coral, flex: 1, fontSize: 13, fontWeight: "700" }}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Pressable
            disabled={isSubmitting}
            onPress={submitAuth}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: theme.colors.accent,
              borderRadius: 18,
              flexDirection: "row",
              gap: 8,
              justifyContent: "center",
              minHeight: 54,
              opacity: pressed || isSubmitting ? 0.78 : 1,
            })}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>
              {isLogin ? "Đăng nhập" : "Tạo tài khoản"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
