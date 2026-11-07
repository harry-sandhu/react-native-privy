import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLoginWithEmail, usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { useTheme } from "@/constants/ThemeProvider";
import { Spacing, Radius, Typography } from "@/constants";

export default function LoginScreen() {
  const { theme, toggleTheme, scheme } = useTheme();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/sign");
  }, [router, user]);

  const gradient =
    scheme === "dark"
      ? ["#0B0F1A", "#111827", "#0B0F1A"]
      : ["#f1f5f9", "#ffffff", "#e2e8f0"];

  return (
    <LinearGradient colors={gradient} style={styles.screen}>
      <Pressable
  onPress={() => {
    console.log("TOGGLE PRESSED");
    toggleTheme();
  }}
  style={[
    styles.toggle,
    { backgroundColor: "red" }
  ]}
>
  <Text style={{ fontSize: 18 }}>
    {scheme === "dark" ? "☀️" : "🌙"}
  </Text>
</Pressable>

      <View
        style={[
          styles.card,
          {
            backgroundColor:
              scheme === "dark"
                ? "rgba(30,41,59,0.8)"
                : "#ffffff",
            borderColor: theme.border,
          },
        ]}
      >
        <Text style={[Typography.h1, { color: theme.text }]}>
          Web3 Login
        </Text>

        <Text
          style={[
            Typography.caption,
            { color: theme.textSecondary, marginBottom: 20 },
          ]}
        >
          Secure authentication powered by Privy
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Enter email"
          placeholderTextColor={theme.placeholder}
          style={[
            styles.input,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />

        {!codeSent ? (
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: theme.primary },
            ]}
            onPress={async () => {
              await sendCode({ email });
              setCodeSent(true);
            }}
          >
            <Text style={styles.buttonText}>Send Code</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Enter OTP"
              placeholderTextColor={theme.placeholder}
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={async () => {
                await loginWithCode({ code, email });
              }}
            >
              <Text style={styles.buttonText}>Login</Text>
            </Pressable>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  card: {
    width: 360,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 12,
  },
  input: {
    borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: Spacing.md,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  toggle: {
    position: "absolute",
    top: 60,
    right: 20,
  },
});