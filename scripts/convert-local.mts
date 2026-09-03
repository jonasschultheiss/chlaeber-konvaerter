import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
import { convertBtwToNlbl } from "../lib/convert";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: npx tsx scripts/convert-local.mts <file.btw>");
}

const bytes = new Uint8Array(readFileSync(inputPath));
const result = await convertBtwToNlbl(basename(inputPath), bytes);
mkdirSync("samples/out", { recursive: true });
const outputPath = `samples/out/${result.fileName}`;
writeFileSync(outputPath, result.nlbl);
console.log(JSON.stringify({ outputPath, notes: result.notes, size: result.nlbl.length }, null, 2));
