import AsyncStorage from "@react-native-async-storage/async-storage";

const FOLDER_KEY = "SELECTED_FOLDERS";

export async function saveSelectedFolders(folders: any[]) {
  await AsyncStorage.setItem(FOLDER_KEY, JSON.stringify(folders));
}

export async function getSelectedFolders(): Promise<any[]> {
  const data = await AsyncStorage.getItem(FOLDER_KEY);
  return data ? JSON.parse(data) : [];
}