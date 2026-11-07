import * as MediaLibrary from "expo-media-library";
import { addJob } from "./jobQueue";
import { getSelectedFolders } from "./storage";

export async function generateJobsFromFolders() {
  const folders = await getSelectedFolders();

  for (const folder of folders) {
    const media = await MediaLibrary.getAssetsAsync({
      album: folder,
      mediaType: MediaLibrary.MediaType.photo,
      first: 50,
    });

    for (const asset of media.assets) {
      await addJob({
        id: asset.id,
        fileName: asset.uri,
        tasks: ["upload", "embedding", "face", "ocr"],
        currentTask: 0,
        status: "pending"
      });
    }
  }
}