const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const { google } = require("googleapis");

const { Client } =
  require("@modelcontextprotocol/sdk/client/index.js");

const { StdioClientTransport } =
  require("@modelcontextprotocol/sdk/client/stdio.js");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CUA_DRIVER =
  "C:\\Users\\jamie\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe";

const TWENTYTOSIX_WORKSPACE =
  "C:\\Users\\jamie\\OneDrive\\Documents\\TwentyToSix Jobs";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}


// ====================================================
// LIMITS
// ====================================================
//
// These stop large accessibility/browser states from
// accumulating until the controller exceeds its context.
//
// ====================================================

const MAX_CONTROLLER_STEPS = 12;

const MAX_TOOL_RESULT_CHARS = 6000;

const MAX_CONTROLLER_MEMORY_CHARS = 10000;


// ====================================================
// CUA MCP CONNECTION
// ====================================================

let mcpClient = null;
let cuaTools = [];
let mcpReady = false;


async function connectToCua() {

  console.log("");
  console.log("Connecting Jarvis to CUA MCP...");

  const transport = new StdioClientTransport({
    command: CUA_DRIVER,
    args: ["mcp"]
  });

  mcpClient = new Client(
    {
      name: "jarvis-computer-controller",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  await mcpClient.connect(transport);

  const response = await mcpClient.listTools();

  cuaTools = response.tools || [];
  mcpReady = true;

  console.log("");
  console.log("======================================");
  console.log("          CUA MCP CONNECTED");
  console.log("======================================");
  console.log(`Loaded ${cuaTools.length} CUA tools.`);
  console.log("");
}


// ====================================================
// SCHEMA CLEANER
// ====================================================

function cleanSchemaNode(value) {

  if (Array.isArray(value)) {
    return value.map(cleanSchemaNode);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const forbidden = new Set([
    "$schema",
    "$id",
    "$defs",
    "definitions",
    "oneOf",
    "anyOf",
    "allOf",
    "not",
    "const"
  ]);

  const cleaned = {};

  for (const [key, child] of Object.entries(value)) {

    if (forbidden.has(key)) {
      continue;
    }

    cleaned[key] =
      cleanSchemaNode(child);
  }

  return cleaned;
}


function sanitizeToolSchema(schema) {

  const cleaned =
    cleanSchemaNode(schema || {});

  cleaned.type = "object";

  if (
    !cleaned.properties ||
    typeof cleaned.properties !== "object" ||
    Array.isArray(cleaned.properties)
  ) {

    cleaned.properties = {};
  }

  if (Array.isArray(cleaned.required)) {

    cleaned.required =
      cleaned.required.filter(name =>
        Object.prototype.hasOwnProperty.call(
          cleaned.properties,
          name
        )
      );

    if (!cleaned.required.length) {
      delete cleaned.required;
    }
  }

  return cleaned;
}


// ====================================================
// CUA TOOL DEFINITIONS
// ====================================================

function tokenizeTask(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3);
}

function selectCuaTools(task, limit = 12) {
  const words = new Set(tokenizeTask(task));

  const intentHints = {
    open: ["launch", "app", "window", "list_apps"],
    launch: ["launch", "app", "window", "list_apps"],
    type: ["type", "keyboard", "key", "text", "input"],
    write: ["type", "keyboard", "key", "text", "input"],
    click: ["click", "mouse", "pointer", "element", "inspect"],
    browser: ["browser", "tab", "url", "page", "inspect"],
    gmail: ["browser", "tab", "click", "type", "inspect"],
    email: ["browser", "tab", "click", "type", "inspect"],
    file: ["file", "folder", "path", "open", "save"],
    folder: ["file", "folder", "path", "open"],
    window: ["window", "app", "focus", "list"],
    screen: ["screen", "screenshot", "inspect", "window"],
    inspect: ["inspect", "accessibility", "screen", "window"]
  };

  const expanded = new Set(words);
  for (const word of words) {
    for (const hint of intentHints[word] || []) expanded.add(hint);
  }

  const scored = cuaTools.map((tool, index) => {
    const name = String(tool.name || "").toLowerCase();
    const description = String(tool.description || "").toLowerCase();
    const haystack = `${name} ${description}`;
    let score = 0;

    for (const word of expanded) {
      if (name.includes(word)) score += 8;
      else if (haystack.includes(word)) score += 2;
    }

    if (/list_apps|list_windows|active_window|foreground|inspect|accessibility|screenshot/.test(name)) {
      score += 2;
    }

    return { tool, score, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = scored
    .filter(item => item.score > 0)
    .slice(0, limit)
    .map(item => item.tool);

  if (selected.length < Math.min(6, cuaTools.length)) {
    for (const tool of cuaTools) {
      if (selected.includes(tool)) continue;
      selected.push(tool);
      if (selected.length >= Math.min(limit, cuaTools.length)) break;
    }
  }

  return selected;
}

function getControllerTools(task) {
  const selected = selectCuaTools(task);

  console.log(
    `Controller tool set: ${selected.length}/${cuaTools.length} tools`,
    selected.map(tool => tool.name).join(", ")
  );

  return selected.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description:
        compactText(
          tool.description || `CUA computer tool ${tool.name}`,
          500
        ),
      parameters: sanitizeToolSchema(tool.inputSchema)
    }
  }));
}


// ====================================================
// COMPACT LARGE TOOL RESULTS
// ====================================================

function compactText(text, maxChars) {

  if (typeof text !== "string") {
    text = String(text ?? "");
  }

  if (text.length <= maxChars) {
    return text;
  }

  const frontSize =
    Math.floor(maxChars * 0.7);

  const backSize =
    Math.floor(maxChars * 0.3);

  const removed =
    text.length -
    frontSize -
    backSize;

  return (
    text.slice(0, frontSize) +

    `\n\n--- JARVIS COMPACTED ${removed} CHARACTERS OF LARGE COMPUTER STATE ---\n\n` +

    text.slice(
      text.length - backSize
    )
  );
}


function compactToolResult(result) {

  let text;

  try {

    text =
      JSON.stringify(
        result,
        null,
        2
      );

  } catch {

    text =
      String(result);
  }

  return compactText(
    text,
    MAX_TOOL_RESULT_CHARS
  );
}


// ====================================================
// EXECUTE CUA TOOL
// ====================================================

async function executeCuaTool(name, args) {

  console.log("");
  console.log("CUA ACTION:", name);

  console.log(
    "ARGS:",
    JSON.stringify(
      args || {},
      null,
      2
    )
  );

  const result =
    await mcpClient.callTool({

      name,

      arguments:
        args &&
        typeof args === "object" &&
        !Array.isArray(args)

          ? args

          : {}
    });


  // Do not print hundreds of thousands of characters
  // into PowerShell either.

  const compact =
    compactToolResult(result);

  console.log(
    "CUA RESULT:",
    compact
  );

  return result;
}


// ====================================================
// SMALL CONTROLLER MEMORY
// ====================================================

function buildMemoryEntry(
  step,
  toolName,
  args,
  result
) {

  const resultText =
    compactToolResult(result);

  return compactText(
    [
      `STEP ${step}`,
      `TOOL: ${toolName}`,
      `ARGS: ${JSON.stringify(args || {})}`,
      `RESULT:`,
      resultText
    ].join("\n"),
    MAX_TOOL_RESULT_CHARS
  );
}


function compactMemory(entries) {

  let text =
    entries.join(
      "\n\n====================\n\n"
    );

  if (
    text.length <=
    MAX_CONTROLLER_MEMORY_CHARS
  ) {

    return text;
  }


  // Keep the newest computer state.
  // Old accessibility dumps are deliberately discarded.

  return (
    "[Earlier detailed computer states were discarded to keep the controller responsive. " +
    "Use a fresh inspection tool if you need current information.]\n\n" +

    text.slice(
      text.length -
      MAX_CONTROLLER_MEMORY_CHARS
    )
  );
}


// ====================================================
// COMPUTER CONTROLLER SYSTEM PROMPT
// ====================================================

function getControllerInstructions() {

  return `
You are the computer-control engine for Jarvis on Jamie's
Windows PC.

You receive ONE computer goal.

You have access to CUA computer tools.

Actually perform the task. Do not merely explain it.

IMPORTANT PERFORMANCE RULES:

Work in SMALL, BOUNDED steps.

Do not repeatedly request huge desktop/browser/accessibility
states when a smaller targeted action is possible.

Prefer operating on the specific active application or
window relevant to the task.

After an action, inspect again ONLY when you need to know
what changed.

Do not keep re-reading the entire desktop.

If you already have a pid, window_id, browser handle,
element identifier or other useful handle, reuse it.

If a tool returns an enormous state, extract what you need
from it and move on.

Do not repeat an identical failed call.

If a required identifier is missing, use an appropriate
list/state tool to obtain it.

MULTI-STEP TASKS:

Complete one logical action at a time.

Examples:

Open Gmail.
Locate the correct label.
Open the relevant email.
Read the job.
Then continue to the next required action.

Do NOT attempt to inspect every possible application,
window and page at once.

If the current computer state supplied to you is incomplete
because an older state was compacted, simply perform a
fresh TARGETED inspection.

SUCCESS:

Do not say a task is complete unless tool results support
that conclusion.

If you genuinely cannot continue, explain the specific
blocker.

SAFETY:

Do not send customer emails/messages, submit consequential
forms, make purchases, delete files, overwrite original
files, or perform another irreversible external action
without Jamie's explicit approval immediately beforehand.

Opening apps, navigating, reading information, clicking,
typing drafts, creating ordinary working files and other
reversible work can proceed without asking.
  `.trim();
}


// ====================================================
// INTERNAL COMPUTER CONTROLLER
// ====================================================

async function runComputerTask(task) {

  if (!mcpReady) {
    throw new Error(
      "CUA MCP is not ready."
    );
  }

  console.log("");
  console.log("======================================");
  console.log("       JARVIS COMPUTER REQUEST");
  console.log("======================================");
  console.log(task);
  console.log("");


  const tools =
    getControllerTools(task);


  // Instead of endlessly appending giant tool states to
  // one Chat Completions conversation, we maintain a
  // deliberately compact external memory.

  const memoryEntries = [];


  for (
    let step = 1;
    step <= MAX_CONTROLLER_STEPS;
    step++
  ) {

    console.log(
      `Computer controller step ${step}/${MAX_CONTROLLER_STEPS}`
    );


    const memory =
      compactMemory(
        memoryEntries
      );


    const messages = [

      {
        role: "system",
        content:
          getControllerInstructions()
      },

      {
        role: "user",

        content:
          [
            "ORIGINAL COMPUTER GOAL:",
            task,
            "",
            "COMPACT HISTORY OF ACTIONS ALREADY TAKEN:",
            memory || "(No actions yet.)",
            "",
            "Decide the NEXT useful action.",
            "",
            "Call the appropriate CUA tool if more computer work is required.",
            "If the original goal is genuinely complete, respond briefly with what was completed."
          ].join("\n")
      }
    ];


    const response =
      await fetch(
        "https://api.openai.com/v1/chat/completions",
        {

          method: "POST",

          headers: {

            Authorization:
              `Bearer ${OPENAI_API_KEY}`,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            model:
              "gpt-5.4-mini",

            messages,

            tools,

            tool_choice:
              "auto",

            temperature:
              0
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      console.error(
        "Controller model error:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      throw new Error(
        data?.error?.message ||
        "Computer controller model failed."
      );
    }


    const message =
      data.choices?.[0]?.message;


    if (!message) {

      throw new Error(
        "Computer controller returned no message."
      );
    }


    const toolCalls =
      message.tool_calls || [];


    // ==================================================
    // CONTROLLER SAYS TASK IS COMPLETE
    // ==================================================

    if (!toolCalls.length) {

      const finalText =
        message.content ||
        "Computer task finished.";

      console.log("");
      console.log(
        "COMPUTER CONTROLLER FINISHED:"
      );

      console.log(finalText);


      return {
        success: true,
        message: finalText,
        steps: step
      };
    }


    // ==================================================
    // EXECUTE TOOL CALLS
    // ==================================================

    for (const call of toolCalls) {

      const toolName =
        call.function?.name;


      if (!toolName) {

        memoryEntries.push(
          `STEP ${step}: Controller attempted a tool call without a tool name.`
        );

        continue;
      }


      let args = {};


      try {

        args =
          JSON.parse(
            call.function?.arguments ||
            "{}"
          );

      } catch {

        args = {};
      }


      let result;


      try {

        result =
          await executeCuaTool(
            toolName,
            args
          );

      } catch (error) {

        result = {
          isError: true,
          error:
            error.message
        };
      }


      const entry =
        buildMemoryEntry(
          step,
          toolName,
          args,
          result
        );


      memoryEntries.push(entry);


      // Keep only a modest number of recent actions.
      // The text-size limiter below provides another
      // protection layer.

      while (
        memoryEntries.length > 5
      ) {

        memoryEntries.shift();
      }
    }
  }


  console.log("");
  console.log(
    "Controller stopped at maximum step count."
  );


  return {
    success: false,

    error:
      `Computer controller reached its ${MAX_CONTROLLER_STEPS}-step safety limit.`,

    suggestion:
      "Continue the task with another Jarvis command."
  };
}


// ====================================================
// JARVIS REALTIME INSTRUCTIONS
// ====================================================

function getJarvisInstructions() {

  return `
You are Jarvis, Jamie's personal work and production
assistant.

Speak naturally, warmly and concisely.

You have ONE computer-control tool called:

control_computer

Whenever Jamie asks you to operate his Windows computer,
use control_computer.

Give it the complete computer goal in plain English.

Example:

"Open Notepad and type Computer control is working."

Do not attempt to manually choose low-level CUA tools.
The computer controller underneath you handles them.

Wait for the computer-control result before saying the
computer task is complete.

If the computer controller reports a specific blocker,
explain that blocker to Jamie.

TWENTYTOSIX:

You are Jamie's production assistant for TwentyToSix.

Astra is separate and handles sales/prospecting.

Never interfere with Astra's outreach workflow.

Production handover begins only from genuine booked work
passed through the Gmail label:

TwentyToSix Jobs/TO BOOK

For production, booking, Gmail, Google Sheets, client-file,
graphic-design, QC, amendment or delivery work, follow:

C:\\Users\\jamie\\OneDrive\\Documents\\TwentyToSix Jobs\\System\\ALEX-OPERATING-MANUAL.md

Do not guess critical missing customer information.

Initial finished customer work must be presented to Jamie
for approval before it is sent to the customer.

Ask Jamie immediately before consequential external
actions such as sending customer communications,
consequential submissions, purchases, deleting files or
overwriting originals.
  `.trim();
}


// ====================================================
// REALTIME SESSION
// ====================================================

app.get(
  "/session",

  async (req, res) => {

    try {

      if (!mcpReady) {

        return res
          .status(503)
          .json({
            error:
              "CUA MCP is not ready."
          });
      }


      console.log(
        "Creating lightweight Jarvis Realtime session..."
      );


      const response =
        await fetch(
          "https://api.openai.com/v1/realtime/client_secrets",
          {

            method: "POST",

            headers: {

              Authorization:
                `Bearer ${OPENAI_API_KEY}`,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                session: {

                  type:
                    "realtime",

                  model:
                    "gpt-realtime-2.1",

                  audio: {

                    output: {
                      voice: "marin"
                    }
                  },

                  instructions:
                    getJarvisInstructions(),

                  tools: [

                    {
                      type:
                        "function",

                      name:
                        "control_computer",

                      description:
                        "Operate Jamie's Windows computer to complete a requested computer task.",

                      parameters: {

                        type:
                          "object",

                        properties: {

                          task: {

                            type:
                              "string",

                            description:
                              "The complete computer task to perform in plain English."
                          }
                        },

                        required: [
                          "task"
                        ]
                      }
                    }
                  ],

                  tool_choice:
                    "auto"
                }
              })
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        console.error(
          "Realtime session error:",
          JSON.stringify(
            data,
            null,
            2
          )
        );


        return res
          .status(response.status)
          .json(data);
      }


      console.log(
        "Jarvis Realtime session created successfully."
      );


      res.json(data);
    }


    catch (error) {

      console.error(
        "Realtime session failed:",
        error
      );


      res.status(500).json({

        error:
          "Realtime session failed.",

        details:
          error.message
      });
    }
  }
);


// ====================================================
// COMPUTER ENDPOINT
// ====================================================

app.post(
  "/computer",

  async (req, res) => {

    try {

      let task =
        req.body?.task;


      if (
        !task &&
        req.body?.arguments?.task
      ) {

        task =
          req.body.arguments.task;
      }


      if (
        !task ||
        typeof task !== "string"
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "No computer task supplied."
          });
      }


      const result =
        await runComputerTask(task);


      res.json(result);
    }


    catch (error) {

      console.error(
        "Computer task failed:",
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message
      });
    }
  }
);




// ====================================================
// TWENTYTOSIX CONTROL CENTRE API
// ====================================================

const GOOGLE_TOKEN_PATH = path.join(__dirname, "google-token.json");
const GOOGLE_CREDENTIALS_PATH = path.join(__dirname, "gmail-credentials.json");
const JOB_SHEET_ID = "17wrRhcr8M8M1lgFTE7p5dywRpT8G6ZfcR_DOmnx4o-M";
const JOB_SHEET_TAB = "Jobs";
const REQUIRED_GOOGLE_ACCOUNT = "twentytosixwebsites@gmail.com";

async function getControlCentreGoogleAuth() {
  const credentialsJson = JSON.parse(await fs.readFile(GOOGLE_CREDENTIALS_PATH, "utf8"));
  const token = JSON.parse(await fs.readFile(GOOGLE_TOKEN_PATH, "utf8"));
  const credentials = credentialsJson.installed || credentialsJson.web;
  if (!credentials) throw new Error("Google OAuth credentials are invalid.");
  const redirectUri = Array.isArray(credentials.redirect_uris) && credentials.redirect_uris.length
    ? credentials.redirect_uris[0] : "http://localhost";
  const auth = new google.auth.OAuth2(credentials.client_id, credentials.client_secret, redirectUri);
  auth.setCredentials(token);
  return auth;
}

async function verifyControlCentreAccount(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const account = String(profile.data.emailAddress || "").trim().toLowerCase();
  if (account !== REQUIRED_GOOGLE_ACCOUNT) {
    throw new Error(`Wrong Gmail account. Expected ${REQUIRED_GOOGLE_ACCOUNT}.`);
  }
  return { gmail, account };
}

function padControlJobNumber(value) {
  const n = Number.parseInt(String(value || "").replace(/^'/, ""), 10);
  return Number.isFinite(n) ? String(n).padStart(4, "0") : String(value || "").trim();
}

app.get("/api/jobs", async (req, res) => {
  try {
    const auth = await getControlCentreGoogleAuth();
    await verifyControlCentreAccount(auth);
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: JOB_SHEET_ID,
      range: `${JOB_SHEET_TAB}!A2:I`
    });
    const rows = response.data.values || [];
    const jobs = rows.filter(row => row.some(cell => String(cell || "").trim())).map(row => ({
      jobNumber: padControlJobNumber(row[0]),
      dateReceived: row[1] || "",
      due: row[2] || "",
      company: row[3] || "",
      description: row[4] || "",
      jobType: row[5] || "",
      agent: row[6] || "",
      status: row[7] || "",
      dateComplete: row[8] || ""
    }));
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/mail", async (req, res) => {
  try {
    const auth = await getControlCentreGoogleAuth();
    const { gmail, account } = await verifyControlCentreAccount(auth);
    const list = await gmail.users.messages.list({ userId: "me", q: "in:inbox newer_than:7d", maxResults: 20 });
    const ids = (list.data.messages || []).slice(0, 20);
    const mail = [];
    for (const item of ids) {
      const m = await gmail.users.messages.get({ userId: "me", id: item.id, format: "metadata", metadataHeaders: ["From","Subject","Date"] });
      const headers = Object.fromEntries((m.data.payload?.headers || []).map(h => [String(h.name).toLowerCase(), h.value]));
      mail.push({ id: item.id, threadId: m.data.threadId, from: headers.from || "", subject: headers.subject || "", date: headers.date || "", labelIds: m.data.labelIds || [] });
    }
    res.json({ success: true, account, count: mail.length, mail });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/astra", async (req, res) => {
  res.json({ success: true, status: "AVAILABLE", note: "Astra sales activity is kept separate from Alex production." });
});

app.get("/api/system", async (req, res) => {
  res.json({
    success: true,
    jarvis: "ONLINE",
    cua: mcpReady ? "READY" : "NOT READY",
    realtimeTools: 1,
    filesystem: "READ ONLY",
    workspace: TWENTYTOSIX_WORKSPACE,
    approvalAgent: "CONNECTED"
  });
});

// ====================================================
// JARVIS APPROVAL API
// ====================================================
//
// This API bridges the HUD to approval-agent.js.
//
// GET  /api/approvals
// GET  /api/approvals/:jobNumber/artwork
// POST /api/approvals/:jobNumber/approve
// POST /api/approvals/:jobNumber/changes
//
// Consequential delivery requires:
//   { "confirm": true }
//
// ====================================================

const APPROVAL_AGENT =
  path.join(
    __dirname,
    "approval-agent.js"
  );


function normaliseApprovalJobNumber(value) {
  const cleaned =
    String(value || "")
      .replace(/\D/g, "");

  if (!cleaned) {
    throw new Error(
      "Invalid job number."
    );
  }

  return cleaned.padStart(4, "0");
}


function parseApprovalAgentJson(stdout) {
  const text =
    String(stdout || "").trim();

  if (!text) {
    throw new Error(
      "Approval agent returned no data."
    );
  }

  try {
    return JSON.parse(text);
  }

  catch {
    const firstBrace =
      text.indexOf("{");

    const lastBrace =
      text.lastIndexOf("}");

    if (
      firstBrace >= 0 &&
      lastBrace > firstBrace
    ) {
      return JSON.parse(
        text.slice(
          firstBrace,
          lastBrace + 1
        )
      );
    }

    throw new Error(
      "Approval agent returned invalid JSON."
    );
  }
}


function runApprovalAgent(args = []) {
  return new Promise(
    (resolve, reject) => {

      const child =
        spawn(
          process.execPath,
          [
            APPROVAL_AGENT,
            ...args
          ],
          {
            cwd:
              __dirname,

            env:
              process.env,

            windowsHide:
              true,

            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ]
          }
        );

      let stdout = "";
      let stderr = "";

      child.stdout.on(
        "data",
        chunk => {
          stdout +=
            chunk.toString();
        }
      );

      child.stderr.on(
        "data",
        chunk => {
          stderr +=
            chunk.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        code => {

          let data = null;

          try {
            data =
              parseApprovalAgentJson(
                stdout ||
                stderr
              );
          }

          catch {}

          if (code !== 0) {
            const message =
              data?.error ||
              stderr.trim() ||
              stdout.trim() ||
              `Approval agent exited with code ${code}.`;

            const error =
              new Error(message);

            error.data =
              data;

            reject(error);
            return;
          }

          if (!data) {
            reject(
              new Error(
                "Approval agent completed without readable JSON."
              )
            );

            return;
          }

          resolve(data);
        }
      );
    }
  );
}


async function getApprovalList() {
  const data =
    await runApprovalAgent([
      "list"
    ]);

  if (!data.success) {
    throw new Error(
      data.error ||
      "Could not load approvals."
    );
  }

  return data;
}


app.get(
  "/api/approvals",

  async (req, res) => {
    try {

      const data =
        await getApprovalList();

      res.json(data);
    }

    catch (error) {

      console.error(
        "Approval list failed:",
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);


app.get(
  "/api/approvals/:jobNumber/artwork",

  async (req, res) => {
    try {

      const jobNumber =
        normaliseApprovalJobNumber(
          req.params.jobNumber
        );

      const data =
        await getApprovalList();

      const job =
        (data.approvals || [])
          .find(
            item =>
              String(
                item.jobNumber
              ) ===
              jobNumber
          );

      if (!job) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              `Job ${jobNumber} is not waiting for approval.`
          });
      }

      if (!job.artwork) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              `Artwork for job ${jobNumber} is unavailable.`
          });
      }

      const workspaceRoot =
        path.resolve(
          TWENTYTOSIX_WORKSPACE
        );

      const artworkPath =
        path.resolve(
          job.artwork
        );

      const relative =
        path.relative(
          workspaceRoot,
          artworkPath
        );

      if (
        relative.startsWith("..") ||
        path.isAbsolute(relative)
      ) {
        throw new Error(
          "Artwork path is outside the TwentyToSix workspace."
        );
      }

      const stat =
        await fs.stat(
          artworkPath
        );

      if (!stat.isFile()) {
        throw new Error(
          "Approval artwork is not a file."
        );
      }

      res.sendFile(
        artworkPath
      );
    }

    catch (error) {

      console.error(
        "Approval artwork failed:",
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);


app.post(
  "/api/approvals/:jobNumber/approve",

  async (req, res) => {
    try {

      const jobNumber =
        normaliseApprovalJobNumber(
          req.params.jobNumber
        );

      if (
        req.body?.confirm !== true
      ) {
        return res
          .status(400)
          .json({
            success: false,
            confirmationRequired:
              true,
            error:
              `Explicit confirmation is required before job ${jobNumber} can be delivered.`
          });
      }

      console.log("");
      console.log(
        `JARVIS APPROVAL: Jamie approved job ${jobNumber} for customer delivery.`
      );

      const result =
        await runApprovalAgent([
          "approve",
          jobNumber
        ]);

      res.json(result);
    }

    catch (error) {

      console.error(
        "Approval delivery failed:",
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);


app.post(
  "/api/approvals/:jobNumber/changes",

  async (req, res) => {
    try {

      const jobNumber =
        normaliseApprovalJobNumber(
          req.params.jobNumber
        );

      const instructions =
        String(
          req.body?.instructions ||
          ""
        ).trim();

      if (!instructions) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Change instructions are required."
          });
      }

      const result =
        await runApprovalAgent([
          "changes",
          jobNumber,
          instructions
        ]);

      res.json(result);
    }

    catch (error) {

      console.error(
        "Request changes failed:",
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);


// ====================================================
// READ-ONLY TWENTYTOSIX FILESYSTEM
// ====================================================
//
// Jarvis' HUD can browse the real TwentyToSix Jobs
// workspace through this API.
//
// IMPORTANT:
// This API is deliberately READ ONLY.
// It cannot delete, rename, move or overwrite files.
//
// ====================================================

function resolveWorkspacePath(relativePath = "") {

  if (typeof relativePath !== "string") {

    throw new Error(
      "Invalid workspace path."
    );
  }


  // Browser paths use forward slashes.
  // Convert any backslashes first.

  const cleaned =
    relativePath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");


  const root =
    path.resolve(
      TWENTYTOSIX_WORKSPACE
    );


  const resolved =
    path.resolve(
      root,
      cleaned
    );


  const relative =
    path.relative(
      root,
      resolved
    );


  // Prevent ../../ style traversal outside the
  // TwentyToSix Jobs workspace.

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {

    throw new Error(
      "Path is outside the TwentyToSix workspace."
    );
  }


  return {

    root,

    resolved,

    relative:
      relative === ""
        ? ""
        : relative
            .split(path.sep)
            .join("/")
  };
}


function workspaceRelativePath(
  parentRelative,
  name
) {

  return [
    parentRelative,
    name
  ]
    .filter(Boolean)
    .join("/");
}


// ====================================================
// LIST WORKSPACE FOLDER
// ====================================================

app.get(
  "/api/files",

  async (req, res) => {

    try {

      const requestedPath =
        typeof req.query.path === "string"
          ? req.query.path
          : "";


      const {
        resolved,
        relative
      } =
        resolveWorkspacePath(
          requestedPath
        );


      const stat =
        await fs.stat(
          resolved
        );


      if (!stat.isDirectory()) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "The requested workspace path is not a folder."
          });
      }


      const directoryEntries =
        await fs.readdir(
          resolved,
          {
            withFileTypes:
              true
          }
        );


      const entries =
        await Promise.all(

          directoryEntries.map(
            async entry => {

              const fullPath =
                path.join(
                  resolved,
                  entry.name
                );


              let itemStat =
                null;


              try {

                itemStat =
                  await fs.stat(
                    fullPath
                  );

              } catch {

                // Keep item visible even if optional
                // metadata cannot be read.
              }


              return {

                name:
                  entry.name,

                type:
                  entry.isDirectory()
                    ? "folder"
                    : "file",

                path:
                  workspaceRelativePath(
                    relative,
                    entry.name
                  ),

                size:
                  itemStat &&
                  itemStat.isFile()
                    ? itemStat.size
                    : null,

                modified:
                  itemStat
                    ? itemStat.mtime.toISOString()
                    : null
              };
            }
          )
        );


      // Folders first, then files alphabetically.

      entries.sort(
        (a, b) => {

          if (a.type !== b.type) {

            return a.type === "folder"
              ? -1
              : 1;
          }


          return a.name.localeCompare(
            b.name,
            undefined,
            {
              sensitivity:
                "base"
            }
          );
        }
      );


      const parent =
        relative
          ? relative
              .split("/")
              .slice(0, -1)
              .join("/")
          : null;


      res.json({

        success:
          true,

        workspace:
          "TwentyToSix Jobs",

        path:
          relative,

        parent,

        readOnly:
          true,

        entries
      });

    }


    catch (error) {

      const status =
        error?.code === "ENOENT"
          ? 404
          : 400;


      res
        .status(status)
        .json({

          success:
            false,

          error:
            error.message
        });
    }
  }
);


// ====================================================
// WORKSPACE ITEM INFO
// ====================================================

app.get(
  "/api/files/info",

  async (req, res) => {

    try {

      const requestedPath =
        typeof req.query.path === "string"
          ? req.query.path
          : "";


      const {
        resolved,
        relative
      } =
        resolveWorkspacePath(
          requestedPath
        );


      const stat =
        await fs.stat(
          resolved
        );


      res.json({

        success:
          true,

        path:
          relative,

        type:
          stat.isDirectory()
            ? "folder"
            : "file",

        size:
          stat.isFile()
            ? stat.size
            : null,

        modified:
          stat.mtime.toISOString(),

        readOnly:
          true
      });

    }


    catch (error) {

      const status =
        error?.code === "ENOENT"
          ? 404
          : 400;


      res
        .status(status)
        .json({

          success:
            false,

          error:
            error.message
        });
    }
  }
);


// ====================================================
// HEALTH
// ====================================================

app.get(
  "/health",

  (req, res) => {

    res.json({

      ok:
        true,

      assistant:
        "Jarvis",

      mcpReady,

      realtimeTools:
        1,

      computerControl:
        "CUA MCP",

      filesystem:
        "TwentyToSix read-only",

      workspace:
        TWENTYTOSIX_WORKSPACE,

      cuaToolsAvailable:
        cuaTools.length,

      maxControllerSteps:
        MAX_CONTROLLER_STEPS,

      maxToolResultChars:
        MAX_TOOL_RESULT_CHARS,

      maxControllerMemoryChars:
        MAX_CONTROLLER_MEMORY_CHARS
    });
  }
);


// ====================================================
// START
// ====================================================

async function start() {

  try {

    await connectToCua();


    app.listen(
      PORT,

      () => {

        console.log(
          "======================================"
        );

        console.log(
          "       JARVIS VOICE IS ONLINE"
        );

        console.log(
          "======================================"
        );

        console.log(
          `Open: http://localhost:${PORT}`
        );

        console.log(
          "Realtime tools: 1"
        );

        console.log(
          `CUA tools behind controller: ${cuaTools.length}`
        );

        console.log(
          "Controller memory protection: ON"
        );

        console.log(
          "Filesystem HUD API: TwentyToSix read-only"
        );

        console.log("");
      }
    );
  }


  catch (error) {

    console.error("");

    console.error(
      "JARVIS STARTUP FAILED"
    );

    console.error(error);

    process.exit(1);
  }
}


start();