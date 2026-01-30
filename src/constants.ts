/**
 * Constants and configuration for the Paperless NGX MCP Server.
 * 
 * Environment variables are loaded at startup and validated.
 * The server will log warnings if required variables are missing.
 */

// Paperless NGX API Configuration
// These are loaded from environment variables for security
export const PAPERLESS_URL = (process.env.PAPERLESS_URL || "").replace(/\/$/, "");
export const PAPERLESS_TOKEN = process.env.PAPERLESS_TOKEN || "";

// Server Configuration
export const SERVER_PORT = parseInt(process.env.PORT || "3000", 10);
export const SERVER_HOST = process.env.HOST || "0.0.0.0";

// API Request Settings
export const REQUEST_TIMEOUT_MS = 30000;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// Response formatting limits
export const MAX_CONTENT_LENGTH = 50000;  // Truncate very long document content
export const MAX_ITEMS_PER_REQUEST = 100;

// Matching algorithm constants used by Paperless NGX
// These define how auto-matching rules work for tags, correspondents, and document types
export const MATCHING_ALGORITHMS = {
  NONE: 0,
  ANY_WORD: 1,
  ALL_WORDS: 2,
  EXACT_MATCH: 3,
  REGEX: 4,
  FUZZY: 5,
  AUTO: 6
} as const;

export type MatchingAlgorithm = typeof MATCHING_ALGORITHMS[keyof typeof MATCHING_ALGORITHMS];

// Human-readable descriptions for matching algorithms
export const MATCHING_ALGORITHM_DESCRIPTIONS: Record<number, string> = {
  0: "None",
  1: "Any word",
  2: "All words",
  3: "Exact match",
  4: "Regular expression",
  5: "Fuzzy match",
  6: "Auto (learned)"
};
