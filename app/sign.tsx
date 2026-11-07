import { useState , useEffect , useRef } from "react";
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
import * as FileSystem from "expo-file-system";
import { encryptBytes } from "@/crypto/encryption";
import { walletKeyGen } from "@/crypto/utils";
import { decryptStoredFile } from "@/crypto/decryptFile";
import { upload, download, list, stat } from "@/lib/s3client";
import { fromByteArray, toByteArray } from "base64-js";
import * as ImageManipulator from "expo-image-manipulator";
import { storeMasterKey, loadMasterKey , clearMasterKey } from "@/crypto/keychain";



let MASTER_KEY_CACHE: Uint8Array | null = null;
const now = () => performance.now();

const logTime = (label: string, start: number) => {
  const end = performance.now();
  console.log(`${label}: ${(end - start).toFixed(2)} ms`);
};

export default function SignScreen() {
  const { scheme } = useTheme();
  const { wallets } = useEmbeddedEthereumWallet();
  const autoBackupRunning = useRef(false);
  const [pin, setPin] = useState("");
  const [albums, setAlbums] = useState<any[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<any[]>([]);
  const [statusText, setStatusText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [thumbnails, setThumbnails] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [metadataCache, setMetadataCache] = useState<any>(null);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const thumbCache = useRef<Map<string,string>>(new Map()).current;
  const [galleryPage, setGalleryPage] = useState(0);
  const [screen, setScreen] = useState<"home" | "gallery" | "loading">("loading");
  const [uploadModal, setUploadModal] = useState(false);
  const PAGE_SIZE = 30;

  const gradient =
    scheme === "dark"
      ? ["#0B0F1A", "#111827", "#0B0F1A"]
      : ["#f1f5f9", "#ffffff", "#e2e8f0"];

  
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
    const init = async () => {
      try {
        const key = await loadMasterKey();
  
        if (key) {
          MASTER_KEY_CACHE = key;
          setHasStoredKey(true);
  
          setScreen("gallery");
          await handleDecrypt();
        } else {
          setScreen("home");
          setStatusText("Enter PIN to unlock 🔐");
        }
      } catch (e) {
        setStatusText("Unlock failed ❌");
      }
    };
  
    init();
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




  const autoBackupCamera = async () => {
    if (autoBackupRunning.current) return;

    autoBackupRunning.current = true;
    try {
      console.log("Auto Camera Backup Start");
  
      const cameraAlbum = (await MediaLibrary.getAlbumsAsync()).find(
        (a) => a.title.toLowerCase() === "camera"
      );
  
      if (!cameraAlbum) {
        console.log("Camera album not found");
        return;
      }
  
      const media = await MediaLibrary.getAssetsAsync({
        album: cameraAlbum,
        mediaType: MediaLibrary.MediaType.photo,
        first: 200,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
  
      let metadata: any = { files: [] };
  
      try {
        const existing = await download("metadata.json");
  
        metadata = JSON.parse(
          new TextDecoder().decode(existing)
        );
      } catch {}
  
      const existingNames = new Set(
        metadata.files.map((f: any) => f.name)
      );
  
      const masterKey = await deriveMasterKey();
  
      for (const asset of media.assets) {
        const safeName =
          (asset.filename || `file_${Date.now()}`)
            .replace(/\s+/g, "_")
            .replace(/[^\w.-]/g, "");
  
        const objectKey = safeName + ".enc";
  
        if (existingNames.has(objectKey)) continue;
  
        console.log("Uploading new camera photo:", safeName);
  
        await processAsset(asset,masterKey,metadata);
      }
  
      const metadataBytes =
        new TextEncoder().encode(JSON.stringify(metadata));
  
      await upload("metadata.json", metadataBytes);
  
      console.log("Camera backup finished");
    } catch (err) {
      console.log("Auto backup error", err);
    }
    finally {
  autoBackupRunning.current = false;
}
  };


  const autoBackupSelectedFolders = async () => {
  if (autoBackupRunning.current) return;

  autoBackupRunning.current = true;

  try {
    const saved = await FileSystem.readAsStringAsync(
      FileSystem.documentDirectory + "folders.json"
    ).catch(() => null);

    if (!saved) return;

    const folders = JSON.parse(saved);

    let metadata: any = { files: [] };

    try {
      const existing = await download("metadata.json");
      metadata = JSON.parse(
        new TextDecoder().decode(existing)
      );
    } catch {}

    const existingNames = new Set(
      metadata.files.map((f: any) => f.name)
    );

    const masterKey = await deriveMasterKey();

    for (const album of folders) {
      const media = await MediaLibrary.getAssetsAsync({
        album,
        mediaType: MediaLibrary.MediaType.photo,
        first: 200,
      });

      for (const asset of media.assets) {
        const safeName =
          (asset.filename || `file_${Date.now()}`)
            .replace(/\s+/g, "_")
            .replace(/[^\w.-]/g, "") + ".enc";

        if (existingNames.has(safeName)) continue;

        await processAsset(asset, masterKey, metadata);
      }
    }

    await upload(
      "metadata.json",
      new TextEncoder().encode(JSON.stringify(metadata))
    );

  } catch (err) {
    console.log("Auto backup error", err);
  }
  finally {
  autoBackupRunning.current = false;
}
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


  const processAsset = async (
    asset: any,
    masterKey: Uint8Array,
    metadata: any
  ) => {
  
    console.log("Processing:", asset.filename);
  
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
  
    const safeName =
      (asset.filename || `file_${Date.now()}`)
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "");
  
    const objectKey = safeName + ".enc";
    const thumbKey = safeName + ".thumb.enc";
  
    // CREATE THUMBNAIL
    const thumbBytes = await createThumbnail(asset.uri);
  
    const { ciphertext: thumbCipher, iv: thumbIv } =
      await encryptBytes(thumbBytes, aesKey);
  
    await upload(thumbKey, thumbCipher);
  
    // READ IMAGE
    const fileBuffer = await fetch(asset.uri).then(r => r.arrayBuffer());
  
    const fileBytes = new Uint8Array(fileBuffer);
  
    // ENCRYPT IMAGE
    const { ciphertext, iv } = await encryptBytes(fileBytes, aesKey);
  
    // ENCRYPT FILE KEY
    const { ciphertext: encryptedKey, iv: keyIv } =
      await encryptBytes(aesKey, masterKey);
  
    // UPLOAD FILE
    await upload(objectKey, ciphertext);
  
    // SAVE METADATA
    metadata.files.push({
      name: objectKey,
      thumb: thumbKey,
      iv: uint8ToBase64(iv),
      thumbIv: uint8ToBase64(thumbIv),
      encryptedKey: uint8ToBase64(encryptedKey),
      keyIv: uint8ToBase64(keyIv),
    });
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
        console.log("Vault metadata not found — creating new");
        metadata = { files: [] };
      }

      

      const concurrency = 3;

      const queue = [...media.assets];
      
      const workers = Array.from({ length: concurrency }, async () => {
      
        while (queue.length > 0) {
      
          const asset = queue.shift();
      
          if (!asset) break;
      
          await processAsset(asset, masterKey, metadata);
      
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
  
      const metadataBytes = await download("metadata.json");

      const metadata = JSON.parse(
        new TextDecoder().decode(metadataBytes)
      );
      
      setMetadataCache(metadata);
      setThumbnails([]);
      setGalleryPage(0);
      
      setStatusText("Gallery ready");
  
    } catch (err) {
      console.log(err);
      setStatusText("Gallery load failed");
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
  onPress={async () => {
    try {
      if (pin.length !== 6) {
        setStatusText("Enter 6-digit PIN ❌");
        return;
      }

      const masterKey = await deriveMasterKey();

      setScreen("gallery");
      await handleDecrypt();

    } catch {
      setStatusText("Unlock failed ❌");
    }
  }}
>
  <Text style={styles.buttonText}>Unlock Vault</Text>
</Pressable>

        <Pressable
          style={styles.button}
          onPress={() => {
            loadAlbums();
            setUploadModal(true);
          }}
        >
          <Text style={styles.buttonText}>Encrypt & Upload Photos</Text>
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
            const isSelected = selectedAlbums.some(a => a.id === item.id);

            return (
              <Pressable
                style={[
                  styles.albumItem,
                  { backgroundColor: isSelected ? "#3B82F6" : "#e5e7eb" },
                ]}
                onPress={() => {
                  const exists = selectedAlbums.find(a => a.id === item.id);
                
                  if (exists) {
                    setSelectedAlbums(prev => prev.filter(a => a.id !== item.id));
                  } else {
                    setSelectedAlbums(prev => [...prev, item]);
                  }
                }}
              >
                <Text style={{ color: isSelected ? "#fff" : "#000" }}>
                  {item.title} ({item.fileCount})
                </Text>
              </Pressable>
            );
          }}
        />

        {selectedAlbums.length > 0 && (
          <Pressable
            style={styles.button}
            disabled={isSending}
            onPress={async () => {
              await FileSystem.writeAsStringAsync(
                FileSystem.documentDirectory + "folders.json",
                JSON.stringify(selectedAlbums)
              );
              
              await autoBackupSelectedFolders();
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

const renderGallery = () => (
  <LinearGradient colors={gradient} style={styles.screen}>
    <View style={{
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 16
    }}>
      <Text style={{ fontWeight: "700" }}>Vault</Text>
    
      <Pressable onPress={() => {
        loadAlbums();
        setUploadModal(true);
      }}>
        <Text style={{ fontSize: 20 }}>⋮</Text>
      </Pressable>
    </View>
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

    
  </LinearGradient>
);

if (screen === "loading") {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Unlocking Vault...</Text>
    </View>
  );
}

  return (
  <>
    {screen === "home" && renderHome()}
    {screen === "gallery" && renderGallery()}
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
});