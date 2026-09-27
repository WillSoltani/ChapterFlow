import { readFileSync } from "node:fs";
import { validateBookPackage } from "/home/user/ChapterFlow/app/app/api/book/_lib/validate-book-package.ts";
const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
try { const p = validateBookPackage(raw); console.log("APP_VALIDATOR_OK chapters=", p.chapters.length); }
catch (e: any) { console.log("APP_VALIDATOR_FAIL", e?.message, JSON.stringify(e?.issues ?? e?.details ?? "", null, 1).slice(0, 2000)); }
