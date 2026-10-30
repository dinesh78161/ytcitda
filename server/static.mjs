import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { HttpError } from "./validation.mjs";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};
const contained = (root, file) => {
  const part = relative(root, file);
  return part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
};

export function createStaticHandler(directory) {
  const root = resolve(directory);
  return async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method))
      throw new HttpError(405, "Use GET or HEAD.");
    let pathname;
    try {
      pathname = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      throw new HttpError(400, "Invalid path.");
    }
    if (
      !pathname.startsWith("/") ||
      pathname.includes("\\") ||
      pathname.includes("\0") ||
      pathname.split("/").some((part) => part.startsWith("."))
    ) {
      throw new HttpError(404, "File not found.");
    }
    let file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!contained(root, file)) throw new HttpError(404, "File not found.");
    try {
      if (!(await stat(file)).isFile())
        throw Object.assign(new Error(), { code: "ENOENT" });
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
      // Missing assets and API endpoints must never receive the app shell.
      if (
        extname(pathname) ||
        pathname.startsWith("/assets/") ||
        !req.headers.accept?.includes("text/html")
      ) {
        throw new HttpError(404, "File not found.");
      }
      file = resolve(root, "index.html");
    }
    const [actualRoot, actualFile] = await Promise.all([
      realpath(root),
      realpath(file),
    ]);
    if (!contained(actualRoot, actualFile) || !types[extname(file)])
      throw new HttpError(404, "File not found.");
    const body = await readFile(actualFile);
    res.setHeader("Content-Type", types[extname(file)]);
    res.setHeader("Content-Length", body.length);
    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    res.end(req.method === "HEAD" ? undefined : body);
  };
}
