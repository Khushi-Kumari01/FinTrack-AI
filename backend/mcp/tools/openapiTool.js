// backend/mcp/tools/openapiTool.js
// Could return the OpenAPI spec so agents know endpoints
import fs from "fs/promises";
import path from "path";

export const openapiTool = async () => {
  const specPath = path.join(process.cwd(), "backend", "utils", "docs", "openapi.yaml");
  const yaml = await fs.readFile(specPath, "utf8");
  return { yaml };
};
