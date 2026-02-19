import { PrivyProvider } from "@privy-io/expo";
import { Slot } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { monadTestnet } from "viem/chains";

export default function DemoLayout() {
  if (
    process.env.EXPO_PUBLIC_PRIVY_APP_ID &&
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID
  ) {
    return (
      <PrivyProvider
        clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID as string}
        appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID as string}
        supportedChains={[monadTestnet]}
        config={{
          embedded: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
        }}
      >
        <Slot />
      </PrivyProvider>
    );
  }

  return (
    <View style={styles.container}>
      <Text>EXPO_PUBLIC_PRIVY_APP_ID is not set in .env file</Text>
      <Text>EXPO_PUBLIC_PRIVY_CLIENT_ID is not set in .env file</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
