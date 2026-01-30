/**
 * TypeScript type definitions for Paperless NGX API responses and internal data structures.
 * 
 * These types mirror the Paperless NGX API schema to ensure type safety
 * when handling API responses and constructing requests.
 */

// =============================================================================
// API Response Types - these match the Paperless NGX REST API responses
// =============================================================================

/**
 * Standard paginated list response from Paperless NGX API.
 * Most list endpoints return data in this format.
 */
export interface PaginatedResponse<T> {
  count: number;           // Total number of items matching the query
  next: string | null;     // URL to next page, or null if this is the last page
  previous: string | null; // URL to previous page, or null if this is the first page
  results: T[];            // Array of items for this page
}

/**
 * Core document data returned by the Paperless NGX API.
 * This represents a single document with all its metadata.
 */
export interface PaperlessDocument {
  id: number;
  correspondent: number | null;
  correspondent_name?: string;  // Included when using ?expand=correspondent
  document_type: number | null;
  document_type_name?: string;  // Included when using ?expand=document_type
  storage_path: number | null;
  storage_path_name?: string;
  title: string;
  content: string;              // OCR-extracted text content
  tags: number[];               // Array of tag IDs
  tag_names?: string[];         // Included when using ?expand=tags
  created: string;              // ISO 8601 datetime when document was created
  modified: string;             // ISO 8601 datetime when last modified
  added: string;                // ISO 8601 datetime when added to Paperless
  archive_serial_number: number | null;  // ASN for physical filing
  original_file_name: string;
  archived_file_name: string;
  owner: number | null;
  notes: DocumentNote[];
  custom_fields: CustomFieldValue[];
}

/**
 * Note attached to a document.
 */
export interface DocumentNote {
  id: number;
  note: string;
  created: string;
  document: number;
  user: number | null;
}

/**
 * Custom field value attached to a document.
 */
export interface CustomFieldValue {
  field: number;
  value: string | number | boolean | null;
}

/**
 * Tag definition in Paperless NGX.
 * Tags are used to categorize and organize documents.
 */
export interface PaperlessTag {
  id: number;
  slug: string;
  name: string;
  color: string;              // Hex color code, e.g., "#ff0000"
  text_color: string;         // Text color for contrast, e.g., "#ffffff"
  match: string;              // Auto-matching pattern
  matching_algorithm: number; // See MATCHING_ALGORITHMS constant
  is_insensitive: boolean;    // Case-insensitive matching
  is_inbox_tag: boolean;      // Whether this is an inbox tag
  document_count: number;     // Number of documents with this tag
  owner: number | null;
}

/**
 * Correspondent (sender/source) in Paperless NGX.
 * Represents a person, company, or organization that sends documents.
 */
export interface PaperlessCorrespondent {
  id: number;
  slug: string;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count: number;
  last_correspondence: string | null;  // ISO 8601 datetime
  owner: number | null;
}

/**
 * Document type definition in Paperless NGX.
 * Used to categorize documents by their purpose (Invoice, Contract, etc.).
 */
export interface PaperlessDocumentType {
  id: number;
  slug: string;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count: number;
  owner: number | null;
}

/**
 * Saved view configuration.
 * Stores filter criteria, sort order, and display settings for quick access.
 */
export interface PaperlessSavedView {
  id: number;
  name: string;
  show_on_dashboard: boolean;
  show_in_sidebar: boolean;
  sort_field: string | null;
  sort_reverse: boolean;
  filter_rules: SavedViewFilterRule[];
  owner: number | null;
}

/**
 * Filter rule within a saved view.
 * Each rule defines a condition that documents must match.
 */
export interface SavedViewFilterRule {
  rule_type: number;
  value: string | null;
}

/**
 * Statistics response from the Paperless NGX API.
 */
export interface PaperlessStatistics {
  documents_total: number;
  documents_inbox: number;
  inbox_tag: number | null;
  document_file_type_counts: FileTypeCount[];
  character_count: number;
}

export interface FileTypeCount {
  mime_type: string;
  mime_type_count: number;
}

/**
 * Document suggestions from the Paperless NGX ML classification.
 */
export interface DocumentSuggestions {
  correspondents: Array<{ id: number; name: string }>;
  tags: Array<{ id: number; name: string }>;
  document_types: Array<{ id: number; name: string }>;
  storage_paths: Array<{ id: number; name: string }>;
  dates: string[];
}

/**
 * Task response when uploading a document.
 * Documents are processed asynchronously, so upload returns a task ID.
 */
export interface UploadTaskResponse {
  task_id: string;
}

// =============================================================================
// Internal Types - used within the MCP server
// =============================================================================

/**
 * Output format enum for tool responses.
 * Markdown is more readable for humans, JSON for programmatic use.
 */
export type ResponseFormat = "markdown" | "json";

/**
 * Document ordering options for search queries.
 * Prefix with "-" for descending order.
 */
export type DocumentOrdering =
  | "created" | "-created"
  | "modified" | "-modified"
  | "added" | "-added"
  | "title" | "-title"
  | "correspondent__name" | "-correspondent__name"
  | "document_type__name" | "-document_type__name"
  | "archive_serial_number" | "-archive_serial_number";

/**
 * Generic API error response structure.
 * Paperless may return errors in various formats.
 */
export interface ApiErrorResponse {
  detail?: string;
  error?: string;
  non_field_errors?: string[];
  [key: string]: unknown;
}
