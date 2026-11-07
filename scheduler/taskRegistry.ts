export const TASKS: Record<string, (fileName: string) => Promise<void>> = {

  upload: async (fileName) => {
    console.log("Uploading:", fileName);
    // later: call your upload logic
  },

  embedding: async (fileName) => {
    console.log("Embedding:", fileName);
    // later: run model
  },

  face: async (fileName) => {
    console.log("Face detection:", fileName);
  },

  ocr: async (fileName) => {
    console.log("OCR:", fileName);
  }

};