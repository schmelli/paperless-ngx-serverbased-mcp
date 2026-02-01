/**
 * Zod Validation Schemas
 * 
 * This module defines Zod schemas for all MCP tool inputs. Using Zod provides:
 * - Runtime type validation with descriptive error messages
 * - TypeScript type inference via z.infer<>
 * - Self-documenting field constraints and descriptions
 * 
 * Each schema includes detailed descriptions for parameters which are
 * surfaced to the LLM when it decides which tool to use and how.
 */

import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MATCHING_ALGORITHMS } from "../constants.js";

// =============================================================================
// Common Schemas (reusable building blocks)
// =============================================================================

/**
 * Response format enum - used by most tools to allow the caller to choose
 * between human-readable markdown and structured JSON output.
 */
export const ResponseFormatSchema = z.enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: 'markdown' for human-readable text, 'json' for structured data");

/**
 * Standard pagination parameters reused across list endpoints.
 */
const paginationParams = {
  page: z.number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination (starts at 1)"),
  page_size: z.number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Number of results per page (1-${MAX_PAGE_SIZE}, default ${DEFAULT_PAGE_SIZE})`)
};

/**
 * Document ordering options for search results.
 * Prefix with "-" for descending order.
 */
export const DocumentOrderingSchema = z.enum([
  "created", "-created",
  "modified", "-modified",
  "added", "-added",
  "title", "-title",
  "correspondent__name", "-correspondent__name",
  "document_type__name", "-document_type__name",
  "archive_serial_number", "-archive_serial_number"
]).default("-created")
  .describe("Sort order for results. Use '-' prefix for descending order (e.g., '-created' for newest first)");

/**
 * Date pattern validator for YYYY-MM-DD format.
 */
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const DateSchema = z.string()
  .regex(datePattern, "Date must be in YYYY-MM-DD format (e.g., 2024-03-15)");

/**
 * Matching algorithm schema for auto-assign rules.
 */
export const MatchingAlgorithmSchema = z.number()
  .int()
  .min(MATCHING_ALGORITHMS.NONE)
  .max(MATCHING_ALGORITHMS.AUTO)
  .optional()
  .describe(
    "Matching algorithm: 0=None, 1=Any word, 2=All words, 3=Exact match, 4=RegEx, 5=Fuzzy, 6=Auto"
  );

// =============================================================================
// Document Schemas
// =============================================================================

/**
 * Schema for searching documents.
 * Supports full-text search, filtering by metadata, and pagination.
 */
export const SearchDocumentsSchema = z.object({
  query: z.string()
    .max(500)
    .optional()
    .describe("Full-text search query. Searches document title, content, and metadata."),
  
  correspondent_id: z.number()
    .int()
    .positive()
    .optional()
    .describe("Filter by correspondent ID. Use paperless_list_correspondents to find IDs."),
  
  document_type_id: z.number()
    .int()
    .positive()
    .optional()
    .describe("Filter by document type ID. Use paperless_list_document_types to find IDs."),
  
  tag_ids: z.array(z.number().int().positive())
    .max(20)
    .optional()
    .describe("Filter by tag IDs. Documents must have ALL specified tags. Use paperless_list_tags to find IDs."),
  
  created_after: DateSchema
    .optional()
    .describe("Filter documents created after this date (YYYY-MM-DD format)"),
  
  created_before: DateSchema
    .optional()
    .describe("Filter documents created before this date (YYYY-MM-DD format)"),
  
  ordering: DocumentOrderingSchema,
  ...paginationParams,
  response_format: ResponseFormatSchema
}).strict();

export type SearchDocumentsInput = z.infer<typeof SearchDocumentsSchema>;

/**
 * Schema for retrieving a single document by ID.
 */
export const GetDocumentSchema = z.object({
  document_id: z.number()
    .int()
    .positive()
    .describe("The unique ID of the document to retrieve"),
  
  include_content: z.boolean()
    .default(true)
    .describe("Whether to include the full OCR text content in the response"),
  
  response_format: ResponseFormatSchema
}).strict();

export type GetDocumentInput = z.infer<typeof GetDocumentSchema>;

/**
 * Schema for a custom field value.
 */
export const CustomFieldValueSchema = z.object({
  field: z.number()
    .int()
    .positive()
    .describe("The ID of the custom field"),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
  ]).describe("The value for the custom field (type depends on field definition)")
});

/**
 * Schema for updating document metadata.
 * All fields are optional - only specified fields will be updated.
 * Note: We don't use .refine() here as it breaks JSON schema export to MCP clients.
 * The validation for "at least one field" is done in the tool handler instead.
 */
export const UpdateDocumentSchema = z.object({
  document_id: z.number()
    .int()
    .positive()
    .describe("The ID of the document to update"),
  
  title: z.string()
    .min(1)
    .max(255)
    .optional()
    .describe("New title for the document"),
  
  correspondent_id: z.number()
    .int()
    .min(0)
    .optional()
    .describe("New correspondent ID. Use 0 to remove the correspondent."),
  
  document_type_id: z.number()
    .int()
    .min(0)
    .optional()
    .describe("New document type ID. Use 0 to remove the document type."),
  
  tag_ids: z.array(z.number().int().positive())
    .optional()
    .describe("New list of tag IDs. This REPLACES all existing tags."),
  
  archive_serial_number: z.number()
    .int()
    .min(0)
    .optional()
    .describe("New Archive Serial Number (ASN). Use 0 to remove."),
  
  created: DateSchema
    .optional()
    .describe("New creation date (YYYY-MM-DD format)"),
  
  custom_fields: z.array(CustomFieldValueSchema)
    .optional()
    .describe("Custom field values. Each entry needs 'field' (ID) and 'value'. Use paperless_list_custom_fields to find field IDs.")
}).strict();

export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

/**
 * Schema for deleting a document.
 * Requires explicit confirmation to prevent accidental deletions.
 */
export const DeleteDocumentSchema = z.object({
  document_id: z.number()
    .int()
    .positive()
    .describe("The ID of the document to delete. This action is PERMANENT!"),
  
  confirm: z.literal(true)
    .describe("Must be set to true to confirm deletion. This prevents accidental deletions.")
}).strict();

export type DeleteDocumentInput = z.infer<typeof DeleteDocumentSchema>;

/**
 * Schema for getting document download URL.
 */
export const GetDocumentDownloadUrlSchema = z.object({
  document_id: z.number()
    .int()
    .positive()
    .describe("The ID of the document"),
  
  original: z.boolean()
    .default(false)
    .describe("If true, get the original uploaded file. If false (default), get the archived PDF version.")
}).strict();

export type GetDocumentDownloadUrlInput = z.infer<typeof GetDocumentDownloadUrlSchema>;

/**
 * Schema for getting document suggestions.
 */
export const GetSuggestionsSchema = z.object({
  document_id: z.number()
    .int()
    .positive()
    .describe("The ID of the document to get AI suggestions for")
}).strict();

export type GetSuggestionsInput = z.infer<typeof GetSuggestionsSchema>;

// =============================================================================
// Tag Schemas
// =============================================================================

/**
 * Schema for listing tags.
 */
export const ListTagsSchema = z.object({
  search: z.string()
    .max(100)
    .optional()
    .describe("Filter tags by name (partial match, case-insensitive)"),
  ...paginationParams,
  response_format: ResponseFormatSchema
}).strict();

export type ListTagsInput = z.infer<typeof ListTagsSchema>;

/**
 * Schema for creating a new tag.
 */
export const CreateTagSchema = z.object({
  name: z.string()
    .min(1)
    .max(128)
    .describe("Name of the new tag"),
  
  color: z.string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex code like #ff0000")
    .optional()
    .describe("Hex color code for the tag (e.g., '#ff0000' for red)"),
  
  match: z.string()
    .max(256)
    .optional()
    .describe("Auto-matching pattern for automatic tag assignment to new documents"),
  
  matching_algorithm: MatchingAlgorithmSchema,
  
  is_insensitive: z.boolean()
    .default(true)
    .describe("Whether matching is case-insensitive (default: true)")
}).strict();

export type CreateTagInput = z.infer<typeof CreateTagSchema>;

// =============================================================================
// Correspondent Schemas
// =============================================================================

/**
 * Schema for listing correspondents.
 */
export const ListCorrespondentsSchema = z.object({
  search: z.string()
    .max(100)
    .optional()
    .describe("Filter correspondents by name (partial match, case-insensitive)"),
  ...paginationParams,
  response_format: ResponseFormatSchema
}).strict();

export type ListCorrespondentsInput = z.infer<typeof ListCorrespondentsSchema>;

/**
 * Schema for creating a new correspondent.
 */
export const CreateCorrespondentSchema = z.object({
  name: z.string()
    .min(1)
    .max(128)
    .describe("Name of the correspondent (person, company, or organization)"),
  
  match: z.string()
    .max(256)
    .optional()
    .describe("Auto-matching pattern for automatic correspondent assignment"),
  
  matching_algorithm: MatchingAlgorithmSchema,
  
  is_insensitive: z.boolean()
    .default(true)
    .describe("Whether matching is case-insensitive (default: true)")
}).strict();

export type CreateCorrespondentInput = z.infer<typeof CreateCorrespondentSchema>;

// =============================================================================
// Document Type Schemas
// =============================================================================

/**
 * Schema for listing document types.
 */
export const ListDocumentTypesSchema = z.object({
  search: z.string()
    .max(100)
    .optional()
    .describe("Filter document types by name (partial match, case-insensitive)"),
  ...paginationParams,
  response_format: ResponseFormatSchema
}).strict();

export type ListDocumentTypesInput = z.infer<typeof ListDocumentTypesSchema>;

/**
 * Schema for creating a new document type.
 */
export const CreateDocumentTypeSchema = z.object({
  name: z.string()
    .min(1)
    .max(128)
    .describe("Name of the document type (e.g., 'Invoice', 'Contract', 'Receipt')"),
  
  match: z.string()
    .max(256)
    .optional()
    .describe("Auto-matching pattern for automatic document type assignment"),
  
  matching_algorithm: MatchingAlgorithmSchema,
  
  is_insensitive: z.boolean()
    .default(true)
    .describe("Whether matching is case-insensitive (default: true)")
}).strict();

export type CreateDocumentTypeInput = z.infer<typeof CreateDocumentTypeSchema>;

// =============================================================================
// Saved View Schemas
// =============================================================================

/**
 * Schema for listing saved views.
 */
export const ListSavedViewsSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export type ListSavedViewsInput = z.infer<typeof ListSavedViewsSchema>;

/**
 * Schema for executing a saved view.
 */
export const ExecuteSavedViewSchema = z.object({
  view_id: z.number()
    .int()
    .positive()
    .describe("ID of the saved view to execute. Use paperless_list_saved_views to find IDs."),
  ...paginationParams,
  response_format: ResponseFormatSchema
}).strict();

export type ExecuteSavedViewInput = z.infer<typeof ExecuteSavedViewSchema>;

// =============================================================================
// Statistics Schema
// =============================================================================

/**
 * Schema for getting Paperless statistics.
 */
export const GetStatisticsSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export type GetStatisticsInput = z.infer<typeof GetStatisticsSchema>;

// =============================================================================
// Custom Fields Schema
// =============================================================================

/**
 * Schema for listing custom fields.
 */
export const ListCustomFieldsSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export type ListCustomFieldsInput = z.infer<typeof ListCustomFieldsSchema>;
