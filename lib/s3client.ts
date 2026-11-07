// lib/s3Client.ts

const GATEWAY = "https://jacob-wyoming-milan-trim.trycloudflare.com";

const S3_HEADERS = {
  "x-s3-access-key": "ps3_f7133c9e2c741d0f06bebd62",
  "x-s3-secret-key": "4d4746f88c02adfbb0f76404ba08c32b9e68cae94dc3738a2232ecfb9be9c9a3",
  "x-s3-bucket": "darkphenoix",
  "x-s3-endpoint": "http://localhost:4569",
  "x-s3-region": "us-east-1",
};

async function request(
  method: string,
  path: string,
  body?: Uint8Array | string
) {

  const url = `${GATEWAY}/${path}`;

  console.log("S3CLIENT REQUEST");
  console.log("METHOD:", method);
  console.log("URL:", url);

  try {

    const res = await fetch(url, {
      method,
      headers: {
        ...S3_HEADERS,
        "content-type": "application/octet-stream",
      },
      body: body as any,
    });

    console.log("S3CLIENT RESPONSE STATUS:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.log("S3CLIENT ERROR RESPONSE:", text);
      throw new Error(text);
    }

    return res;

  } catch (err) {

    console.log("S3CLIENT NETWORK ERROR:", err);

    throw err;
  }
}

// ---------- UPLOAD ----------
export async function upload(key: string, bytes: Uint8Array) {
  await request("PUT", `upload/${key}`, bytes);
}

// ---------- STREAM UPLOAD ----------
export async function streamUpload(key: string, bytes: Uint8Array) {
  await request("POST", `stream-upload/${key}`, bytes);
}

// ---------- DOWNLOAD ----------
export async function download(key: string) {
  const res = await request("GET", `file/${key}`);
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer.slice(0));
}

// ---------- DELETE ----------
export async function remove(key: string) {
  await request("DELETE", `file/${key}`);
}

// ---------- EXISTS ----------
export async function exists(key: string) {
  const res = await request("GET", `exists/${key}`);
  return (await res.json()).exists;
}

// ---------- LIST ----------
export async function list(prefix?: string) {
  const path = prefix ? `list?prefix=${prefix}` : "list";
  const res = await request("GET", path);
  return await res.json();
}

// ---------- STAT ----------
export async function stat(key: string) {
  const res = await request("GET", `stat/${key}`);
  return await res.json();
}

// ---------- SIZE ----------
export async function size(key: string) {
  const res = await request("GET", `size/${key}`);
  return await res.json();
}

// ---------- PRESIGN DOWNLOAD ----------
export async function presignDownload(key: string) {
  const res = await request("GET", `presign-download/${key}`);
  return await res.json();
}

// ---------- CREATE BUCKET ----------
export async function createBucket() {
  await request("PUT", "bucket");
}