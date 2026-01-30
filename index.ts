/**
 * Paperless NGX MCP Server - Main Entry Point
 * 
 * This is the main entry point for the Paperless NGX MCP server. It initializes
 * the MCP server, registers all tools, and starts the appropriate transport
 * based on the TRANSPORT environment variable:
 * 
 * - TRANSPORT=http (default): Runs as an HTTP server for remote access
 *   This mode allows Claude.ai mobile app and other remote clients to connect.
 * 
 * - TRANSPORT=stdio: Runs in stdio mode for local Claude Desktop integration
 *   This mode is used when running the server as a subprocess.
 * 
 * Configuration:
 *   PAPERLESS_URL    - URL of your Paperless NGX server (required)
 *   PAPERLESS_TOKEN  - API token for authentication (required)
 *   PORT             - HTTP port to listen on (default: 3000)
 *   HOST             - Host to bind to (default: 0.0.0.0)
 *   TRANSPORT        - Transport mode: 'http' or 'stdio' (default: http)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { Request, Response } from "express";

import { registerTools } from "./tools/index.js";
import {
  SERVER_PORT,
  SERVER_HOST,
  PAPERLESS_URL,
  PAPERLESS_TOKEN
} from "./constants.js";

// =============================================================================
// Server Initialization
// =============================================================================

/**
 * Create and configure a new MCP server instance.
 * This function creates the server and registers all Paperless NGX tools.
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: "paperless-ngx-mcp-server",
    version: "1.0.0"
  });
  
  // Register all Paperless NGX tools
  registerTools(server);
  
  return server;
}

// =============================================================================
// HTTP Transport (for remote access)
// =============================================================================

/**
 * Run the MCP server in HTTP mode.
 * 
 * This mode exposes the MCP protocol over HTTP, allowing remote clients
 * (like the Claude.ai mobile app) to connect to the server. Each request
 * creates a new stateless transport instance for simplicity and scalability.
 */
async function runHttpServer(): Promise<void> {
  const app = express();
  
  // Parse JSON request bodies
  app.use(express.json());
  
  // Health check endpoint for container orchestration
  app.get("/health", (_req: Request, res: Response) => {
    // Check if required configuration is present
    const configOk = Boolean(PAPERLESS_URL && PAPERLESS_TOKEN);
    
    if (configOk) {
      res.json({
        status: "healthy",
        server: "paperless-ngx-mcp-server",
        paperless_url: PAPERLESS_URL
      });
    } else {
      res.status(503).json({
        status: "unhealthy",
        error: "Missing required configuration (PAPERLESS_URL or PAPERLESS_TOKEN)"
      });
    }
  });
  
  // MCP endpoint - handles all MCP protocol requests
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      // Create a new server and transport for each request (stateless mode)
      // This simplifies scaling and avoids session management complexity
      const server = createServer();
      
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,  // Stateless mode - no session tracking
        enableJsonResponse: true        // Return JSON instead of streaming
      });
      
      // Clean up transport when response closes
      res.on("close", () => {
        transport.close().catch(console.error);
      });
      
      // Connect server to transport and handle the request
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      
    } catch (error) {
      console.error("Error handling MCP request:", error);
      
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  });
  
  // Start the HTTP server
  app.listen(SERVER_PORT, SERVER_HOST, () => {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║       Paperless NGX MCP Server (HTTP Mode)                   ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  MCP Endpoint: http://${SERVER_HOST}:${SERVER_PORT}/mcp`);
    console.log(`║  Health Check: http://${SERVER_HOST}:${SERVER_PORT}/health`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    
    if (PAPERLESS_URL) {
      console.log(`║  Paperless URL: ${PAPERLESS_URL}`);
    } else {
      console.log("║  ⚠️  WARNING: PAPERLESS_URL not configured!");
    }
    
    if (PAPERLESS_TOKEN) {
      console.log("║  Paperless Token: ********** (configured)");
    } else {
      console.log("║  ⚠️  WARNING: PAPERLESS_TOKEN not configured!");
    }
    
    console.log("╚══════════════════════════════════════════════════════════════╝");
  });
}

// =============================================================================
// Stdio Transport (for local Claude Desktop)
// =============================================================================

/**
 * Run the MCP server in stdio mode.
 * 
 * This mode uses stdin/stdout for communication, which is how Claude Desktop
 * typically runs local MCP servers as subprocesses.
 */
async function runStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  
  // Log to stderr so it doesn't interfere with the MCP protocol on stdout
  console.error("Paperless NGX MCP Server (stdio mode) starting...");
  
  if (!PAPERLESS_URL) {
    console.error("WARNING: PAPERLESS_URL environment variable not set");
  }
  if (!PAPERLESS_TOKEN) {
    console.error("WARNING: PAPERLESS_TOKEN environment variable not set");
  }
  
  await server.connect(transport);
  
  console.error("Paperless NGX MCP Server ready");
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Main function - determines transport mode and starts the server.
 */
async function main(): Promise<void> {
  // Determine transport mode from environment variable
  // Default to HTTP for Docker/remote deployments
  const transport = process.env.TRANSPORT?.toLowerCase() || "http";
  
  try {
    if (transport === "stdio") {
      await runStdioServer();
    } else if (transport === "http") {
      await runHttpServer();
    } else {
      console.error(`Unknown transport mode: ${transport}`);
      console.error("Valid options are: 'http' (default) or 'stdio'");
      process.exit(1);
    }
  } catch (error) {
    console.error("Fatal error starting server:", error);
    process.exit(1);
  }
}

// Start the server
main();
