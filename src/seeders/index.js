import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import dotenv from "dotenv"; 

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runSeeders = async () => {
  const seedersPath = __dirname;

  const files = fs
    .readdirSync(seedersPath)
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .sort();

  for (const file of files) {
    console.log(`Running seeder: ${file}`);

    const filePath = path.join(seedersPath, file);
    const fileUrl = pathToFileURL(filePath).href;

    const seeder = await import(fileUrl);
    if (seeder.default) {
      await seeder.default();
    }
  }

  console.log("✅ All seeders completed!");
  process.exit(0);
};

runSeeders().catch((err) => {
  console.error("❌ Error running seeders:", err);
  process.exit(1);
});
