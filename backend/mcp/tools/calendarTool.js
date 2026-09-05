// backend/mcp/tools/calendarTool.js
export const todayTool = async () => {
  const today = new Date().toISOString().split("T")[0];
  return { today };
};
