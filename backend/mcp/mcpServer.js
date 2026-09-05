// backend/mcp/mcpServer.js
// Very small placeholder – you can wire real MCP later.
import { readFileTool } from "./tools/fileTool.js";
import { todayTool } from "./tools/calendarTool.js";

export const mcp = {
  tools: {
    file_read: readFileTool,
    calendar_today: todayTool
  }
};
