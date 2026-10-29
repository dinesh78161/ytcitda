import { readFile, writeFile, readdir, lstat, mkdir } from "node:fs/promises";
import path from "node:path";
import { sealBackup, openBackup } from "../server/backup-archive.mjs";

const [action, source, destination] = process.argv.slice(2);
try {
  const passphrase = process.env.BACKUP_PASSPHRASE;
  if (action === "seal") {
    if (!source || !destination)
      throw new Error(
        "Usage: backup:seal -- <existing-backup-folder> <new-encrypted-file>",
      );
    const directory = path.resolve(source),
      files = {};
    const visit = async (current) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const filename = path.join(current, entry.name);
        const stat = await lstat(filename);
        if (stat.isSymbolicLink())
          throw new Error("Backup folders must not contain symbolic links.");
        if (entry.isDirectory()) await visit(filename);
        else if (entry.isFile())
          files[path.relative(directory, filename).replaceAll("\\", "/")] =
            await readFile(filename);
      }
    };
    await visit(directory);
    if (!files["roles.sql"] || !files["schema.sql"] || !files["data.sql"])
      throw new Error(
        "Supply Supabase's roles.sql, schema.sql and data.sql exports, plus a storage/ directory and its checksums.",
      );
    const archive = sealBackup(
      files,
      {
        created_at: new Date().toISOString(),
        kind: "supabase-logical-export",
        files: Object.keys(files).length,
      },
      passphrase,
    );
    await writeFile(destination, archive, { flag: "wx", mode: 0o600 });
    // Always decrypt and authenticate before reporting a completed backup.
    const verified = openBackup(await readFile(destination), passphrase);
    console.log(
      `PASS: encrypted backup created and ${verified.files.size} entries authenticated. Keep the passphrase separately.`,
    );
  } else if (action === "extract") {
    if (!source || !destination)
      throw new Error(
        "Usage: backup:extract -- <encrypted-file> <new-empty-folder>",
      );
    const verified = openBackup(await readFile(source), passphrase);
    const directory = path.resolve(destination);
    await mkdir(directory, { mode: 0o700 }); // Refuse an existing destination, including symlinks.
    for (const [name, bytes] of verified.files) {
      const filename = path.join(directory, ...name.split("/"));
      await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
      await writeFile(filename, bytes, { flag: "wx", mode: 0o600 });
    }
    console.log(
      `PASS: ${verified.files.size} authenticated files extracted to the new directory. Treat them as private plaintext.`,
    );
  } else if (action === "verify") {
    if (!source) throw new Error("Usage: backup:verify -- <encrypted-file>");
    const verified = openBackup(await readFile(source), passphrase);
    console.log(
      `PASS: encrypted backup authenticated; ${verified.files.size} entry checksums verified.`,
    );
  } else
    throw new Error(
      "Choose seal, verify or extract. This utility never restores over a database.",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
