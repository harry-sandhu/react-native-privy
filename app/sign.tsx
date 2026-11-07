import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  
  StyleSheet,
  FlatList,
  Image,
  BackHandler,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { useEmbeddedEthereumWallet } from "@privy-io/expo";
import { useTheme } from "@/constants/ThemeProvider";

import * as MediaLibrary from "expo-media-library";
import * as ImageManipulator from "expo-image-manipulator";

import { encryptBytes } from "@/crypto/encryption";
import { nativeEncryptFile } from "@/crypto/nativeAES";
import { decryptStoredFile } from "@/crypto/decryptFile";
import { runScheduler, shouldRunNow } from "@/scheduler/scheduler";
import { saveSelectedFolders } from "@/scheduler/storage";

import { walletKeyGen } from "@/crypto/utils";
import { storeMasterKey, loadMasterKey, clearMasterKey } from "@/crypto/keychain";

import { upload, download } from "@/lib/s3client";

import { fromByteArray, toByteArray } from "base64-js";


let MASTER_KEY_CACHE: Uint8Array | null = null;
const now = () => performance.now();

const logTime = (label: string, start: number) => {
  const end = performance.now();
  console.log(`${label}: ${(end - start).toFixed(2)} ms`);
};

export default function SignScreen() {
  const { scheme } = useTheme();
  const { wallets } = useEmbeddedEthereumWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pin, setPin] = useState("");
  const [albums, setAlbums] = useState<any[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [statusText, setStatusText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [thumbnails, setThumbnails] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [metadataCache, setMetadataCache] = useState<any>(null);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const thumbCache = useRef<Map<string,string>>(new Map()).current;
  const [galleryPage, setGalleryPage] = useState(0);
  const [screen, setScreen] = useState<"home" | "gallery">("home");
  const [uploadModal, setUploadModal] = useState(false);
  const PAGE_SIZE = 30;

  const gradient =
    scheme === "dark"
      ? ["#0B0F1A", "#111827", "#0B0F1A"]
      : ["#f1f5f9", "#ffffff", "#e2e8f0"];

  
  // BACK BUTTON HANDLER
  useEffect(() => {
    const backAction = () => {
      if (previewImage) {
        setPreviewImage(null);
        return true;
      }
      return false;
    };
  
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
  
    return () => backHandler.remove();
  }, [previewImage]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const shouldRun = await shouldRunNow();
  
      if (shouldRun) {
        await runScheduler();
      }
    }, 60000); // check every minute
  
    return () => clearInterval(interval);
  }, []);

  // AUTO LOAD VAULT
  useEffect(() => {
    const init = async () => {
      try {
        setStatusText("Loading vault...");
        setError(null);
        await handleDecrypt();
        setScreen("gallery");
      } catch (e) {
        setError("Failed to load vault ❌");
      }
    };
  
    init();
  }, []);


  useEffect(() => {
    const checkKey = async () => {
      const key = await loadMasterKey();
      if (key) setHasStoredKey(true);
    };
  
    checkKey();
  }, []);

  useEffect(() => {
    if (!metadataCache) return;
  
    loadNextPage();
  }, [metadataCache, galleryPage]);
  
  const base64ToUint8 = (base64: string) => {
    return toByteArray(base64);
  };
  
  const uint8ToBase64 = (bytes: Uint8Array) => {
    return fromByteArray(bytes);
  };

  // ================= LOAD ALBUMS =================
  const loadAlbums = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      setStatusText("Permission denied ❌");
      return;
    }

    const allAlbums = await MediaLibrary.getAlbumsAsync();

    const albumsWithCount = await Promise.all(
      allAlbums.map(async (album) => {
        const assets = await MediaLibrary.getAssetsAsync({
          album,
          first: 1,
        });

        return {
          ...album,
          fileCount: assets.totalCount,
        };
      })
    );

    setAlbums(albumsWithCount);
    setStatusText("Select album 👇");
  };

  // ================= MASTER KEY =================
  
  
  const deriveMasterKey = async () => {
  
    if (MASTER_KEY_CACHE) return MASTER_KEY_CACHE;
  
    // try biometric unlock first
    const stored = await loadMasterKey();
  
    if (stored) {
      MASTER_KEY_CACHE = stored;
      return stored;
    }
  
    if (!wallets?.length) throw new Error("No wallet connected");
  
    const privyWallet = wallets[0];
  
    const wallet = {
      account: { address: privyWallet.address },
      signMessage: async ({ message }: { message: string }) => {
        const provider = await privyWallet.getProvider();
        const accounts = await provider.request({
          method: "eth_requestAccounts",
        });
  
        return await provider.request({
          method: "personal_sign",
          params: [message, accounts[0]],
        });
      },
    } as any;
  
    const { seed } = await walletKeyGen(wallet, {
      pin,
      salts: {
        challenge: "0x11111111111111111111111111111111",
        seed: "0x22222222222222222222222222222222",
        pin: "0x33333333333333333333333333333333",
      },
    });
  
    const masterKey = seed.slice(0, 32);
  
    MASTER_KEY_CACHE = masterKey;
  
    // store securely for future biometric unlock
    await storeMasterKey(masterKey);

    setHasStoredKey(true);
  
    return masterKey;
  };

  

  async function logoutVault() {
    MASTER_KEY_CACHE = null;
    await clearMasterKey();
  }

  // ================= ENCRYPT & UPLOAD =================
   

  const createThumbnail = async (uri: string) => {
    const thumb = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 160 } }],
      {
        compress: 0.5,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
  
    return base64ToUint8(thumb.base64!);
  };
    
  const sendSelectedAlbum = async () => {
    if (!selectedAlbum) {
      setStatusText("Select album ❌");
      return;
    }
    

    if (!hasStoredKey && (!pin || pin.length !== 6)) {
      setStatusText("Enter 6-digit PIN ❌");
      return;
    }

    try {
      setIsSending(true);
      setStatusText("Deriving master key...");

      const masterKey = await deriveMasterKey();

      const media = await MediaLibrary.getAssetsAsync({
        album: selectedAlbum,
        mediaType: MediaLibrary.MediaType.photo,
        first: 200,
      });

      let metadata: any = { files: [] };

      try {
        const existing = await download("metadata.json");
      
        metadata = JSON.parse(
          new TextDecoder().decode(existing)
        );
      } catch {
        metadata = { files: [] };
      }

      const processAsset = async (asset: any) => {

        console.log("Processing:", asset.filename);
      
        const aesKey = crypto.getRandomValues(new Uint8Array(32));
      
        const safeName =
          (asset.filename || `file_${Date.now()}`)
            .replace(/\s+/g, "_")
            .replace(/[^\w.-]/g, "");
      
        const objectKey = safeName + ".enc";
        const thumbKey = safeName + ".thumb.enc";
      
        // 1️⃣ CREATE THUMBNAIL FIRST
        const thumbStart = now();
      
        const thumbBytes = await createThumbnail(asset.uri);
      
        logTime("Create Thumbnail", thumbStart);
      
        const thumbEncStart = now();
      
        const { ciphertext: thumbCipher, iv: thumbIv } =
          await encryptBytes(thumbBytes, aesKey);
      
        logTime("Encrypt Thumbnail", thumbEncStart);
      
        const thumbUploadStart = now();
      
        await upload(thumbKey, thumbCipher);
      
        logTime("Upload Thumbnail", thumbUploadStart);
      
      
        // 2️⃣ READ FULL IMAGE
       // 2️⃣ ENCRYPT IMAGE DIRECTLY FROM FILE
       const encStart = now();
       
       const filePath = asset.uri.replace("file://", "");

      const { ciphertext, iv } = await nativeEncryptFile(
        filePath,
        aesKey
      );
       
       logTime("Encrypt Image", encStart);
      
      
        // 4️⃣ ENCRYPT AES KEY
        const keyEncStart = now();
      
        const { ciphertext: encryptedKey, iv: keyIv } =
          await encryptBytes(aesKey, masterKey);
      
        logTime("Encrypt AES Key", keyEncStart);
      
      
        // 5️⃣ UPLOAD IMAGE
        const uploadStart = now();
      
        await upload(objectKey, ciphertext);
      
        logTime("Upload Encrypted File", uploadStart);
      
      
        // 6️⃣ SAVE METADATA
        metadata.files.push({
          name: objectKey,
          thumb: thumbKey,
          iv: uint8ToBase64(iv),
          thumbIv: uint8ToBase64(thumbIv),
          encryptedKey: uint8ToBase64(encryptedKey),
          keyIv: uint8ToBase64(keyIv),
        });
      
      };

      const concurrency = 1;

      const queue = [...media.assets];
      
      const workers = Array.from({ length: concurrency }, async () => {
      
        while (queue.length > 0) {
      
          const asset = queue.shift();
      
          if (!asset) break;
      
          await processAsset(asset);
      
        }
      
      });
      
      await Promise.all(workers);

      const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));

      await upload("metadata.json", metadataBytes);

      setStatusText("Upload Complete 🚀");
    } catch (err) {
      console.log(err);
      setStatusText("Upload failed ❌");
    } finally {
      setIsSending(false);
    }
  };


  

  // ================= FETCH FILE LIST =================
  const handleDecrypt = async () => {
    if (isSending) return;
    setIsSending(true);
  
    try {
      setStatusText("Loading gallery...");
      setError(null);
  
      const metadataBytes = await download("metadata.json");
  
      const metadata = JSON.parse(
        new TextDecoder().decode(metadataBytes)
      );
  
      setMetadataCache(metadata);
      setThumbnails([]);
      setGalleryPage(0);
  
      if (!metadata.files || metadata.files.length === 0) {
        setStatusText("No images in vault 📭");
      } else {
        setStatusText("Gallery ready");
      }
  
    } catch (err) {
      console.log(err);
      setError("Error loading vault ❌");
      setStatusText("");
    } finally {
      setIsSending(false);
    }
  };


  const loadNextPage = async () => {
    try {
  
      if (!metadataCache?.files) return;
  
      const masterKey = await deriveMasterKey();
  
      const files = metadataCache.files.slice(
        galleryPage * PAGE_SIZE,
        (galleryPage + 1) * PAGE_SIZE
      );
  
      const results = await Promise.all(
        files.map(async (file: any) => {
          try {
  
            let thumbUri = thumbCache.get(file.name);
  
            if (!thumbUri) {
              const thumbBytes = await download(file.thumb);
  
              thumbUri = await decryptStoredFile(
                thumbBytes,
                file.encryptedKey,
                file.keyIv,
                file.thumbIv,
                masterKey
              );
  
              thumbCache.set(file.name, thumbUri);
            }
  
            return {
              thumbUri,
              fileName: file.name,
            };
  
          } catch (err) {
            console.log("thumb fail", err);
            return null;
          }
        })
      );
  
      setThumbnails(prev => {
        const newItems = results.filter(
          (r) => r && !prev.find(p => p.fileName === r.fileName)
        );
  
        return [...prev, ...newItems];
      });
  
    } catch (err) {
      console.log("loadNextPage error", err);
    }
  };

  // ================= DECRYPT SELECTED FILE =================
  const decryptFile = async (fileName: string, thumbUri: string) => {
    try {

      setPreviewImage(thumbUri);
  
      
  
      setStatusText("Downloading file...");
  
      const masterKey = await deriveMasterKey();
  
      const downloadStart = now();

      const encryptedBytes = await download(fileName);
      
      logTime("Download File", downloadStart);
  
      


      const metadata = metadataCache;
  
      if (!metadata) {
        setStatusText("Metadata missing ❌");
        return;
      }
  
      const fileMeta = metadata.files.find(
        (f: any) => f.name === fileName
      );
  
      if (!fileMeta) {
        setStatusText("Metadata not found ❌");
        return;
      }
  
      const decryptStart = now();

      const outputUri = await decryptStoredFile(
        encryptedBytes,
        fileMeta.encryptedKey,
        fileMeta.keyIv,
        fileMeta.iv,
        masterKey
      );
      
      logTime("Decrypt Image", decryptStart);
  
      setPreviewImage(outputUri);
  
      setStatusText("Image decrypted ✅");
  
    } catch (err) {
      console.log(err);
      setStatusText("Decrypt failed ❌");
    }
  };

  const renderHome = () => (
  <LinearGradient colors={gradient} style={styles.screen}>
    <View style={styles.center}>
      <View style={styles.card}>
        <Text style={styles.title}>Encrypted Vault</Text>

        {!hasStoredKey && (
          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="Enter 6-digit PIN"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />
        )}

        <Pressable
          style={styles.button}
          onPress={() => {
            loadAlbums();
            setUploadModal(true);
          }}
        >
          <Text style={styles.buttonText}>Encrypt & Upload Photos</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: "#10B981" }]}
          onPress={async () => {
            setThumbnails([]);
            setGalleryPage(0);
            setScreen("gallery");
            await handleDecrypt(); 
          }}
        >
          <Text style={styles.buttonText}>Open Vault</Text>
        </Pressable>

        <Text>{statusText}</Text>
      </View>
    </View>
  </LinearGradient>
);

const renderUploadModal = () => (
  uploadModal && (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <Text style={styles.title}>Select Album</Text>

        <FlatList
          data={albums}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedAlbum?.id === item.id;

            return (
              <Pressable
                style={[
                  styles.albumItem,
                  { backgroundColor: isSelected ? "#3B82F6" : "#e5e7eb" },
                ]}
                onPress={() => setSelectedAlbum(item)}
              >
                <Text style={{ color: isSelected ? "#fff" : "#000" }}>
                  {item.title} ({item.fileCount})
                </Text>
              </Pressable>
            );
          }}
        />

        {selectedAlbum && (
          <Pressable
            style={styles.button}
            disabled={isSending}
            onPress={async () => {
              await saveSelectedFolders([selectedAlbum]);
              setStatusText("Folder saved for auto-upload ✅");
              setUploadModal(false);
            }}
          >
            <Text style={styles.buttonText}>
              {isSending ? "Uploading..." : "Start Upload"}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, { backgroundColor: "#6B7280" }]}
          onPress={() => setUploadModal(false)}
        >
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>

        <Text>{statusText}</Text>
      </View>
    </View>
  )
);

const renderMenu = () => (
  <>
    <Pressable
      style={styles.menuButton}
      onPress={() => setMenuOpen(!menuOpen)}
    >
      <Text style={{ fontSize: 22 }}>⋮</Text>
    </Pressable>

    {menuOpen && (
      <View style={styles.menuDropdown}>

        <Pressable
          style={styles.menuItem}
          onPress={async () => {
            setMenuOpen(false);
            await loadAlbums();
            setUploadModal(true);
          }}
        >
          <Text>Select Folder(s)</Text>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => {
            setMenuOpen(false);
            alert("Set scheduler time (next step)");
          }}
        >
          <Text>Set Schedule Time</Text>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={async () => {
            setMenuOpen(false);
            await handleDecrypt();
          }}
        >
          <Text>Refresh</Text>
        </Pressable>

      </View>
    )}
  </>
);

const renderGallery = () => (
  <LinearGradient colors={gradient} style={styles.screen}>

    {renderMenu()}

    {/* ERROR */}
    {error && (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    )}

    {/* EMPTY */}
    {!error && metadataCache?.files?.length === 0 && (
      <View style={styles.center}>
        <Text>No images in vault 📭</Text>
      </View>
    )}

    {/* GALLERY */}
    {!error && metadataCache?.files?.length > 0 && (
      <FlatList
        contentContainerStyle={{ padding: 10 }}
        data={thumbnails}
        numColumns={3}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        removeClippedSubviews
        keyExtractor={(item) => item.fileName}
        renderItem={({ item }) => (
          <Pressable onPress={() => decryptFile(item.fileName, item.thumbUri)}>
            <Image
              source={{ uri: item.thumbUri }}
              style={{
                width: 110,
                height: 110,
                margin: 5,
                borderRadius: 8,
              }}
            />
          </Pressable>
        )}
        onEndReached={() => {
          if (!metadataCache) return;

          const nextPage = galleryPage + 1;

          if (nextPage * PAGE_SIZE >= metadataCache.files.length) return;

          setGalleryPage(nextPage);
        }}
        onEndReachedThreshold={0.5}
      />
    )}

  </LinearGradient>
);

  return (
  <>
    {renderGallery()}   {/* always show gallery */}
    {renderUploadModal()}

    {previewImage && (
      <Pressable
        style={styles.previewOverlay}
        onPress={() => setPreviewImage(null)}
      >
        <Image
          source={{ uri: previewImage }}
          style={{
            width: "100%",
            height: "100%",
            resizeMode: "contain",
          }}
        />
      </Pressable>
    )}
  </>
);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  card: {
  width: "100%",
  padding: 20,
},
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  input: { borderWidth: 1, padding: 12, marginBottom: 10 },
  button: {
    padding: 16,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: "#3B82F6",
    marginBottom: 10,
  },
  albumItem: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  modalOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
  justifyContent: "center",
  alignItems: "center",
},

modalCard: {
  width: "85%",
  maxHeight: "80%",
  backgroundColor: "white",
  borderRadius: 12,
  padding: 20,
},

backButton: {
  position: "absolute",
  bottom: 30,
  alignSelf: "center",
  backgroundColor: "#111",
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 999,
},

previewOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "black",
  justifyContent: "center",
  alignItems: "center",
},
menuButton: {
  position: "absolute",
  top: 50,
  right: 20,
  zIndex: 10,
  backgroundColor: "white",
  padding: 8,
  borderRadius: 999,
},

menuDropdown: {
  position: "absolute",
  top: 90,
  right: 20,
  backgroundColor: "white",
  borderRadius: 8,
  padding: 10,
  elevation: 5,
  zIndex: 10,
},

menuItem: {
  paddingVertical: 10,
  paddingHorizontal: 15,
},
});