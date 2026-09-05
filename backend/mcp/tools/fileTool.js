// backend/mcp/tools/fileTool.js
import fs from "fs/promises";
import path from "path";

export const readFileTool = async ({ filePath }) => {
  if (!filePath) throw new Error("filePath is required");
  const abs = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(abs, "utf8");
  return { content };
};
