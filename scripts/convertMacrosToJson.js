/**
 * Convert extracted_macros.md to macros.json for the serverless function.
 * Run once: node scripts/convertMacrosToJson.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, "..", "extracted_macros.md");
const outputPath = path.join(__dirname, "..", "api", "macros.json");

const content = fs.readFileSync(inputPath, "utf8");

const pattern = /## MACRO (\d+)\s*\*\*Title:\*\* ([^\n]+)\s*\*\*Text:\*\* ([^\n]+(?:\n(?!## MACRO)[^\n]+)*)/gm;
const macros = [];

let match;
while ((match = pattern.exec(content)) !== null) {
  macros.push({
    number: parseInt(match[1], 10),
    title: match[2].trim(),
    text: match[3].trim(),
  });
}

// Ensure api directory exists
const apiDir = path.dirname(outputPath);
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(macros, null, 2), "utf8");
console.log(`Converted ${macros.length} macros to ${outputPath}`);
