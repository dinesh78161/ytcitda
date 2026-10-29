import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  createHash,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

const magic = Buffer.from("AAROGYA-BACKUP-1\n");
const maxSize = 512 * 1024 * 1024;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const key = (passphrase, salt) => {
  if (typeof passphrase !== "string" || passphrase.length < 16)
    throw new Error(
      "Use a private backup passphrase of at least 16 characters.",
    );
  return scryptSync(passphrase, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
};

export function sealBackup(files, metadata, passphrase) {
  const entries = Object.entries(files).map(([name, bytes]) => {
    if (!safeName(name)) throw new Error("Invalid backup entry name.");
    const content = Buffer.from(bytes);
    return { name, sha256: digest(content), data: content.toString("base64") };
  });
  if (
    entries.reduce((size, entry) => size + Buffer.byteLength(entry.data), 0) >
    maxSize
  )
    throw new Error("Backup exceeds the supported archive size.");
  const payload = gzipSync(
    Buffer.from(JSON.stringify({ format: 1, metadata, entries })),
  );
  if (payload.length > maxSize)
    throw new Error("Backup exceeds the supported archive size.");
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(passphrase, salt), iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]);
}

export function openBackup(archive, passphrase) {
  const bytes = Buffer.from(archive),
    offset = magic.length;
  if (
    bytes.length < offset + 45 ||
    bytes.length > maxSize ||
    !bytes.subarray(0, offset).equals(magic)
  )
    throw new Error("Invalid or unsupported backup archive.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(passphrase, bytes.subarray(offset, offset + 16)),
    bytes.subarray(offset + 16, offset + 28),
  );
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(offset + 28, offset + 44));
  let payload;
  try {
    payload = JSON.parse(
      gunzipSync(
        Buffer.concat([
          decipher.update(bytes.subarray(offset + 44)),
          decipher.final(),
        ]),
        { maxOutputLength: maxSize },
      ).toString(),
    );
  } catch {
    throw new Error(
      "Backup could not be authenticated. Check the passphrase and archive integrity.",
    );
  }
  if (payload.format !== 1 || !Array.isArray(payload.entries))
    throw new Error("Invalid backup contents.");
  const files = new Map();
  for (const entry of payload.entries) {
    if (
      !safeName(entry.name) ||
      files.has(entry.name) ||
      typeof entry.data !== "string"
    )
      throw new Error("Invalid backup entry.");
    const content = Buffer.from(entry.data, "base64");
    if (digest(content) !== entry.sha256)
      throw new Error("Backup entry checksum mismatch.");
    files.set(entry.name, content);
  }
  return { metadata: payload.metadata, files };
}
const safeName = (name) =>
  typeof name === "string" &&
  /^[a-zA-Z0-9_./-]+$/.test(name) &&
  !name.startsWith("/") &&
  !name.split("/").some((part) => !part || part === "." || part === "..");
