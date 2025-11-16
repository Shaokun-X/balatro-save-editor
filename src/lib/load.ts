import Pako from "pako";

// Regex patterns
const returnPrefix = /^return /;
const stringKeys = /\["(.*?)"\]=/g;
const numberKeys = /\[(\d+)\]=/g;
const trailingCommas = /,}/g;

const numberKey = /"NOSTRING_(\d+)":/g;
const stringKey = /"([^"]*?)":/g;

// ----------------------
// Compression / Decompression
// ----------------------
function decompress(data: Uint8Array | ArrayBuffer) {
  return Pako.inflateRaw(data, { to: "string" });
}

function compress(data: string | Uint8Array) {
  return Pako.deflateRaw(data);
}

// ----------------------
// Convert Lua-like raw string to JSON
// ----------------------
function rawToJSON(data: string): any {
  return JSON.parse(
    data
      .replace(returnPrefix, "")
      .replace(stringKeys, '"$1":')
      .replace(numberKeys, '"NOSTRING_$1":')
      .replace(trailingCommas, "}")
  );
}

// ----------------------
// Fix Lua-style arrays in JSON
// ----------------------
function FixJSONArrays(json: any): any {
  if (typeof json !== "object" || json === null) {
    return json;
  }
  const keys = Object.keys(json);
  if (keys.length === 0) return json;

  if (!keys.every((key) => key.startsWith("NOSTRING_"))) {
    for (const key of keys) {
      json[key] = FixJSONArrays(json[key]);
    }
    return json;
  }

  const array: any[] = [];
  for (const key of keys) {
    // -1 because Lua arrays are 1-indexed
    array[parseInt(key.slice(9)) - 1] = FixJSONArrays(json[key]);
  }
  return array;
}

// ----------------------
// Convert JS arrays back to Lua-style objects
// ----------------------
function FixLuaArrays(json: any): any {
  if (Array.isArray(json)) {
    const obj: Record<string, any> = {};
    for (let i = 0; i < json.length; i++) {
      // +1 because Lua arrays are 1-indexed
      obj[`NOSTRING_${i + 1}`] = FixLuaArrays(json[i]);
    }
    return obj;
  }
  if (typeof json === "object" && json !== null) {
    for (const key in json) {
      json[key] = FixLuaArrays(json[key]);
    }
  }
  return json;
}

// ----------------------
// Convert JSON back to Lua-like raw string
// ----------------------
function JSONToRaw(data: any): string {
  return (
    "return " +
    JSON.stringify(data)
      .replace(numberKey, "[$1]=")
      .replace(stringKey, '["$1"]=') // keep quotes around string keys
  );
}

// ----------------------
// High-level helpers
// ----------------------
function binaryToJSON(buffer: Uint8Array | ArrayBuffer): any {
  const data = decompress(buffer);
  const json = rawToJSON(data);
  return FixJSONArrays(json);
}

function JSONToBinary(json: any) {
  const fixed = FixLuaArrays(json);
  const data = JSONToRaw(fixed);
  return compress(data);
}


export interface CompatibleFileHandle {
  kind: "native" | "fallback";
  fileHandle?: FileSystemFileHandle;
  file?: File; // fallback read
  name: string;
}

/**
 * Firefox-compatible universal open function.
 * - Chrome/Edge → File System Access API
 * - Firefox/Safari → <input type="file"> fallback
 */
export async function open(): Promise<CompatibleFileHandle> {
  // const supportsNativePicker = "showOpenFilePicker" in window;
  const supportsNativePicker = false; // save file location is restricted in some OSes so FSA doesn't do anything

  if (supportsNativePicker) {
    // Native File System Access API (Chrome/Edge)
    const [fileHandle] = await (window as any).showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Balatro save file",
          accept: {
            "application/octet-stream": [".jkr"] // MIME type can be generic
          }
        }
      ]
    });

    return {
      kind: "native",
      fileHandle,
      name: fileHandle.name
    };
  }

  // ---------- FIREFOX FALLBACK ----------
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".jkr,application/octet-stream";

  return new Promise((resolve, reject) => {
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject("No file selected");

      resolve({
        kind: "fallback",
        file,
        name: file.name
      });
    };

    input.click();
  });
}

/**
 * Reads + decompresses JSON using either native FS or fallback.
 */
export async function read(handle: CompatibleFileHandle): Promise<any> {
  const arrayBuffer =
  handle.kind === "native"
  ? await handle.fileHandle!.getFile().then(f => f.arrayBuffer())
  : await handle.file!.arrayBuffer();

  const json = binaryToJSON(new Uint8Array(arrayBuffer))
  
  console.log("Decompressed JSON:", json);
  return json;
}

/**
 * Compresses JSON + saves file
 * - Native save if supported
 * - Firefox/Safari: triggers a download
 */
export async function save(
  handle: CompatibleFileHandle,
  json: any
): Promise<void> {
  const compressed = JSONToBinary(json)

  if (handle.kind === "native") {
    const writable = await handle.fileHandle!.createWritable();
    await writable.write(compressed);
    await writable.close();
    console.log("Saved (native).");
    return;
  }

  // ---------- FIREFOX FALLBACK ----------
  const blob = new Blob([compressed], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = handle.name; // same name
  a.click();

  URL.revokeObjectURL(url);

  console.log("Saved (fallback download).");
}
