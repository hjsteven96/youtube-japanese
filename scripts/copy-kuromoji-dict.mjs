import { promises as fs } from "fs";
import path from "path";

const source = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
const destination = path.join(process.cwd(), "public", "kuromoji-dict");

await fs.mkdir(destination, { recursive: true });
await fs.cp(source, destination, { recursive: true });

console.log("[kuromoji] dict copied to public/kuromoji-dict");
