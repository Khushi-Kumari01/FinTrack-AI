/**
 * agentRunner.js — Fire-and-forget Python agent pipeline launcher.
 *
 * Called after addTransaction and saveReceiptTransaction to trigger
 * background financial analysis without blocking the HTTP response.
 *
 * The subprocess is detached so it outlives the Node.js request lifecycle.
 * Stdout/stderr are written to a rotating log buffer (last 100 lines) so
 * the AgentConsole page can surface real execution evidence.
 */

import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory ring buffer of the last 100 agent log lines (for AgentConsole)
const MAX_LOG_LINES = 100;
const agentLog = [];

export const getAgentLog = () => [...agentLog];

const appendLog = (line) => {
  agentLog.push({ ts: new Date().toISOString(), line: line.trim() });
  if (agentLog.length > MAX_LOG_LINES) agentLog.shift();
};

/**
 * Resolve the Python executable. Tries 'python' first (Python 3 on most
 * systems), then 'py' (Windows Python Launcher), then 'python3'.
 * Can be overridden with PYTHON_PATH env var.
 */
const getPythonExecutable = () => process.env.PYTHON_PATH || "python";

/**
 * Launch the agent pipeline in a background subprocess.
 *
 * @param {Object} opts
 * @param {string} opts.userToken  — JWT for the authenticated user
 * @param {string} [opts.goal]     — Natural-language goal for the planner
 * @returns {boolean} true if subprocess was spawned, false if spawn failed
 */
export const runAgentPipeline = ({ userToken, goal = "Refresh spending insights" }) => {
  try {
    const agentScript = path.resolve(__dirname, "..", "..", "agent", "agent_main.py");
    const pythonExe = getPythonExecutable();

    const env = {
      ...process.env,
      FINTRACK_AGENT_USER_TOKEN: userToken || "",
      FINTRACK_BACKEND_URL: process.env.FINTRACK_BACKEND_URL || "http://localhost:5000/api",
      // Force UTF-8 output on Windows so emoji/unicode in agent logs don't crash
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    };

    const subprocess = spawn(
      pythonExe,
      [agentScript, "--goal", goal],
      {
        env,
        detached: true,
        // Capture stdout/stderr into our log buffer instead of ignoring them
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    subprocess.stdout?.on("data", (data) => {
      const lines = data.toString("utf8").split("\n").filter(Boolean);
      lines.forEach((l) => {
        appendLog(l);
        logger.debug(`[agent] ${l}`);
      });
    });

    subprocess.stderr?.on("data", (data) => {
      const lines = data.toString("utf8").split("\n").filter(Boolean);
      lines.forEach((l) => {
        appendLog(`ERROR: ${l}`);
        logger.warn(`[agent:stderr] ${l}`);
      });
    });

    subprocess.on("close", (code) => {
      const msg = `Agent pipeline exited (code=${code}) goal="${goal}"`;
      appendLog(msg);
      if (code !== 0) {
        logger.warn(msg);
      } else {
        logger.info(msg);
      }
    });

    subprocess.on("error", (err) => {
      const msg = `Failed to spawn agent: ${err.message}`;
      appendLog(msg);
      logger.error(msg);
    });

    // Detach so the subprocess outlives this Node process/request
    subprocess.unref();

    logger.info(`[agentRunner] Launched pipeline: goal="${goal}"`);
    return true;
  } catch (err) {
    logger.error(`agentRunner spawn error: ${err.message}`);
    return false;
  }
};
