/**
 * MCP Tool Implementations
 * 
 * This module contains all tool handlers for the Paperless NGX MCP server.
 * Each tool is implemented as an async function that:
 * - Receives validated input parameters (validated by Zod schema)
 * - Calls the Paperless NGX API via the api service
 * - Formats the response using the formatters service
 * - Returns a standardized MCP tool response
 * 
 * Tools are organized by domain (documents, tags, correspondents, etc.)
 * with consistent error handling and response formatting.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del, PaperlessApiError } from "../services/paperless-api.js";
import {
  formatDocumentMarkdown,
  formatDocumentsListMarkdown,
  formatTagsListMarkdown,
  formatTagMarkdown,
  formatCorrespondentsListMarkdown,
  formatCorrespondentMarkdown,
  formatDocumentTypesListMarkdown,
  formatDocumentTypeMarkdown,
  formatSavedViewsListMarkdown,
  formatStatisticsMarkdown,
  formatSuggestionsMarkdown,
  formatResponse
} from "../services/formatters.js";
import {
  SearchDocumentsSchema,
  GetDocumentSchema,
  UpdateDocumentSchema,
  DeleteDocumentSchema,
  GetDocumentDownloadUrlSchema,
  GetSuggestionsSchema,
  ListTagsSchema,
  CreateTagSchema,
  ListCorrespondentsSchema,
  CreateCorrespondentSchema,
  ListDocumentTypesSchema,
  CreateDocumentTypeSchema,
  ListSavedViewsSchema,
  ExecuteSavedViewSchema,
  GetStatisticsSchema,
  type SearchDocumentsInput,
  type GetDocumentInput,
  type UpdateDocumentInput,
  type DeleteDocumentInput,
  type GetDocumentDownloadUrlInput,
  type GetSuggestionsInput,
  type ListTagsInput,
  type CreateTagInput,
  type ListCorrespondentsInput,
  type CreateCorrespondentInput,
  type ListDocumentTypesInput,
  type CreateDocumentTypeInput,
  type ListSavedViewsInput,
  type ExecuteSavedViewInput,
  type GetStatisticsInput
} from "../schemas/index.js";
import type {
  PaginatedResponse,
  PaperlessDocument,
  PaperlessTag,
  PaperlessCorrespondent,
  PaperlessDocumentType,
  PaperlessSavedView,
  PaperlessStatistics,
  DocumentSuggestions
} from "../types.js";
import { PAPERLESS_URL } from "../constants.js";

// =============================================================================
// Helper: Standardized error handling wrapper
// =============================================================================

/**
 * Wraps a tool handler function with consistent error handling.
 * Converts PaperlessApiError into user-friendly error messages.
 */
function handleToolError(error: unknown): { content: Array<{ type: "text"; text: string }> } {
  if (error instanceof PaperlessApiError) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }]
    };
  }
  
  if (error instanceof Error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }]
    };
  }
  
  return {
    content: [{ type: "text", text: "An unexpected error occurred." }]
  };
}

// =============================================================================
// Tool Registration
// =============================================================================

/**
 * Register all Paperless NGX tools with the MCP server.
 * This function is called during server initialization.
 */
export function registerTools(server: McpServer): void {
  
  // ===========================================================================
  // Document Tools
  // ===========================================================================
  
  server.registerTool(
    "paperless_search_documents",
    {
      title: "Search Documents",
      description: `Search for documents in Paperless NGX with flexible filtering options.

Supports full-text search across document content and title, plus filtering by correspondent, document type, tags, and date ranges. Results are paginated and sortable.

Args:
  - query (string, optional): Full-text search query
  - correspondent_id (number, optional): Filter by correspondent ID
  - document_type_id (number, optional): Filter by document type ID  
  - tag_ids (number[], optional): Filter by tag IDs (documents must have ALL tags)
  - created_after (string, optional): Filter by creation date (YYYY-MM-DD)
  - created_before (string, optional): Filter by creation date (YYYY-MM-DD)
  - ordering (string): Sort order (default: -created for newest first)
  - page (number): Page number (default: 1)
  - page_size (number): Results per page (default: 25, max: 100)
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of matching documents with metadata (title, correspondent, tags, dates, etc.)

Examples:
  - "Find invoices from 2024" -> query="invoice", created_after="2024-01-01"
  - "Show documents tagged with 'important'" -> tag_ids=[5] (where 5 is the tag ID)`,
      inputSchema: SearchDocumentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: SearchDocumentsInput) => {
      try {
        // Build query parameters for the API
        const apiParams: Record<string, string | number | boolean | undefined> = {
          page: params.page,
          page_size: params.page_size,
          ordering: params.ordering
        };
        
        if (params.query) {
          apiParams.query = params.query;
        }
        if (params.correspondent_id) {
          apiParams["correspondent__id"] = params.correspondent_id;
        }
        if (params.document_type_id) {
          apiParams["document_type__id"] = params.document_type_id;
        }
        if (params.tag_ids && params.tag_ids.length > 0) {
          apiParams["tags__id__all"] = params.tag_ids.join(",");
        }
        if (params.created_after) {
          apiParams["created__date__gt"] = params.created_after;
        }
        if (params.created_before) {
          apiParams["created__date__lt"] = params.created_before;
        }
        
        const data = await get<PaginatedResponse<PaperlessDocument>>(
          "/api/documents/",
          apiParams
        );
        
        const text = formatResponse(
          data,
          params.response_format,
          formatDocumentsListMarkdown
        );
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_get_document",
    {
      title: "Get Document Details",
      description: `Retrieve detailed information about a specific document by ID.

Returns complete document metadata and optionally the full OCR text content. Use this to examine documents found via search or to verify details before making updates.

Args:
  - document_id (number, required): The unique ID of the document
  - include_content (boolean): Include full OCR text (default: true)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Complete document details including title, correspondent, document type, tags, dates, ASN, and optionally the full text content.`,
      inputSchema: GetDocumentSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: GetDocumentInput) => {
      try {
        const data = await get<PaperlessDocument>(
          `/api/documents/${params.document_id}/`
        );
        
        const text = formatResponse(
          data,
          params.response_format,
          (doc) => formatDocumentMarkdown(doc, params.include_content)
        );
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_update_document",
    {
      title: "Update Document Metadata",
      description: `Update metadata of an existing document in Paperless NGX.

Allows changing title, correspondent, document type, tags, ASN, and creation date. Only the specified fields will be updated; others remain unchanged.

Args:
  - document_id (number, required): ID of the document to update
  - title (string, optional): New title
  - correspondent_id (number, optional): New correspondent ID (0 to remove)
  - document_type_id (number, optional): New document type ID (0 to remove)
  - tag_ids (number[], optional): New tag IDs (REPLACES all existing tags)
  - archive_serial_number (number, optional): New ASN (0 to remove)
  - created (string, optional): New creation date (YYYY-MM-DD)

Returns:
  Confirmation with the updated document details.

Note: tag_ids replaces ALL existing tags. To add a tag, include all existing tag IDs plus the new one.`,
      inputSchema: UpdateDocumentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: UpdateDocumentInput) => {
      try {
        // Validate that at least one field to update is specified
        const { document_id, ...updateFields } = params;
        if (Object.values(updateFields).every(v => v === undefined)) {
          return {
            content: [{
              type: "text",
              text: "Error: At least one field to update must be specified (title, correspondent_id, document_type_id, tag_ids, archive_serial_number, or created)."
            }]
          };
        }
        
        // Build update payload with only provided fields
        const updateData: Record<string, unknown> = {};
        
        if (params.title !== undefined) {
          updateData.title = params.title;
        }
        if (params.correspondent_id !== undefined) {
          updateData.correspondent = params.correspondent_id > 0 ? params.correspondent_id : null;
        }
        if (params.document_type_id !== undefined) {
          updateData.document_type = params.document_type_id > 0 ? params.document_type_id : null;
        }
        if (params.tag_ids !== undefined) {
          updateData.tags = params.tag_ids;
        }
        if (params.archive_serial_number !== undefined) {
          updateData.archive_serial_number = params.archive_serial_number > 0 ? params.archive_serial_number : null;
        }
        if (params.created !== undefined) {
          updateData.created = params.created;
        }
        
        const data = await patch<PaperlessDocument>(
          `/api/documents/${params.document_id}/`,
          updateData
        );
        
        const text = `Document #${params.document_id} updated successfully!\n\n${formatDocumentMarkdown(data)}`;
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_delete_document",
    {
      title: "Delete Document",
      description: `Permanently delete a document from Paperless NGX.

WARNING: This action CANNOT be undone! The document and all its versions will be permanently removed from the system. Requires explicit confirmation.

Args:
  - document_id (number, required): ID of the document to delete
  - confirm (boolean, required): Must be true to confirm deletion

Returns:
  Confirmation of successful deletion.`,
      inputSchema: DeleteDocumentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (params: DeleteDocumentInput) => {
      try {
        await del(`/api/documents/${params.document_id}/`);
        
        return {
          content: [{
            type: "text",
            text: `Document #${params.document_id} has been permanently deleted.`
          }]
        };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_get_document_download_url",
    {
      title: "Get Document Download URL",
      description: `Get the download URL for a document file.

Returns a URL to download either the archived PDF version or the original uploaded file.

Args:
  - document_id (number, required): ID of the document
  - original (boolean): If true, get original file; if false (default), get archived PDF

Returns:
  Download URL (requires authentication via API token in Authorization header).`,
      inputSchema: GetDocumentDownloadUrlSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: GetDocumentDownloadUrlInput) => {
      try {
        // Verify document exists
        await get<PaperlessDocument>(`/api/documents/${params.document_id}/`);
        
        const urlPath = params.original
          ? `/api/documents/${params.document_id}/original/`
          : `/api/documents/${params.document_id}/download/`;
        
        const text = [
          "**Download URL:**",
          `${PAPERLESS_URL}${urlPath}`,
          "",
          "**Note:** This URL requires authentication. Include your API token in the Authorization header: `Authorization: Token YOUR_TOKEN`"
        ].join("\n");
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_get_suggestions",
    {
      title: "Get Document Suggestions",
      description: `Get AI-generated metadata suggestions for a document.

Paperless NGX analyzes the document content using machine learning and suggests appropriate correspondents, tags, document types, and dates.

Args:
  - document_id (number, required): ID of the document

Returns:
  Suggested correspondents, tags, document types, and dates based on content analysis.`,
      inputSchema: GetSuggestionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: GetSuggestionsInput) => {
      try {
        const data = await get<DocumentSuggestions>(
          `/api/documents/${params.document_id}/suggestions/`
        );
        
        const text = formatSuggestionsMarkdown(params.document_id, data);
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  // ===========================================================================
  // Tag Tools
  // ===========================================================================
  
  server.registerTool(
    "paperless_list_tags",
    {
      title: "List Tags",
      description: `List all tags in Paperless NGX with optional filtering.

Tags are used to categorize and organize documents. Each tag shows its name, color, document count, and auto-matching configuration.

Args:
  - search (string, optional): Filter tags by name (partial match)
  - page (number): Page number (default: 1)
  - page_size (number): Results per page (default: 25)
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of tags with their IDs, names, colors, and document counts.`,
      inputSchema: ListTagsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ListTagsInput) => {
      try {
        const apiParams: Record<string, string | number | undefined> = {
          page: params.page,
          page_size: params.page_size,
          ordering: "name"
        };
        
        if (params.search) {
          apiParams["name__icontains"] = params.search;
        }
        
        const data = await get<PaginatedResponse<PaperlessTag>>(
          "/api/tags/",
          apiParams
        );
        
        const text = formatResponse(
          data,
          params.response_format,
          formatTagsListMarkdown
        );
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_create_tag",
    {
      title: "Create Tag",
      description: `Create a new tag in Paperless NGX.

Tags help organize documents by category, status, or any classification. You can set auto-matching rules to automatically apply tags to incoming documents.

Args:
  - name (string, required): Tag name (max 128 characters)
  - color (string, optional): Hex color code (e.g., '#ff0000' for red)
  - match (string, optional): Auto-matching pattern
  - matching_algorithm (number, optional): 0=None, 1=Any word, 2=All words, 3=Exact, 4=RegEx, 5=Fuzzy, 6=Auto
  - is_insensitive (boolean): Case-insensitive matching (default: true)

Returns:
  Confirmation with the new tag's details including its ID.`,
      inputSchema: CreateTagSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (params: CreateTagInput) => {
      try {
        const tagData: Record<string, unknown> = {
          name: params.name,
          is_insensitive: params.is_insensitive
        };
        
        if (params.color) tagData.color = params.color;
        if (params.match) tagData.match = params.match;
        if (params.matching_algorithm !== undefined) {
          tagData.matching_algorithm = params.matching_algorithm;
        }
        
        const data = await post<PaperlessTag>("/api/tags/", tagData);
        
        const text = `Tag created successfully!\n${formatTagMarkdown(data)}`;
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  // ===========================================================================
  // Correspondent Tools
  // ===========================================================================
  
  server.registerTool(
    "paperless_list_correspondents",
    {
      title: "List Correspondents",
      description: `List all correspondents in Paperless NGX.

Correspondents represent the sender or source of documents (companies, people, organizations). Shows name, document count, and auto-matching configuration.

Args:
  - search (string, optional): Filter by name (partial match)
  - page (number): Page number (default: 1)
  - page_size (number): Results per page (default: 25)
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of correspondents with their IDs, names, and document counts.`,
      inputSchema: ListCorrespondentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ListCorrespondentsInput) => {
      try {
        const apiParams: Record<string, string | number | undefined> = {
          page: params.page,
          page_size: params.page_size,
          ordering: "name"
        };
        
        if (params.search) {
          apiParams["name__icontains"] = params.search;
        }
        
        const data = await get<PaginatedResponse<PaperlessCorrespondent>>(
          "/api/correspondents/",
          apiParams
        );
        
        const text = formatResponse(
          data,
          params.response_format,
          formatCorrespondentsListMarkdown
        );
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_create_correspondent",
    {
      title: "Create Correspondent",
      description: `Create a new correspondent in Paperless NGX.

Correspondents help track the source of documents. Set matching rules to automatically assign correspondents to incoming documents.

Args:
  - name (string, required): Correspondent name (max 128 characters)
  - match (string, optional): Auto-matching pattern
  - matching_algorithm (number, optional): 0=None, 1=Any word, 2=All words, 3=Exact, 4=RegEx, 5=Fuzzy, 6=Auto
  - is_insensitive (boolean): Case-insensitive matching (default: true)

Returns:
  Confirmation with the new correspondent's details including its ID.`,
      inputSchema: CreateCorrespondentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (params: CreateCorrespondentInput) => {
      try {
        const corrData: Record<string, unknown> = {
          name: params.name,
          is_insensitive: params.is_insensitive
        };
        
        if (params.match) corrData.match = params.match;
        if (params.matching_algorithm !== undefined) {
          corrData.matching_algorithm = params.matching_algorithm;
        }
        
        const data = await post<PaperlessCorrespondent>("/api/correspondents/", corrData);
        
        const text = `Correspondent created successfully!\n${formatCorrespondentMarkdown(data)}`;
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  // ===========================================================================
  // Document Type Tools
  // ===========================================================================
  
  server.registerTool(
    "paperless_list_document_types",
    {
      title: "List Document Types",
      description: `List all document types in Paperless NGX.

Document types categorize documents by their purpose (Invoice, Contract, Receipt, etc.). Shows name, document count, and auto-matching configuration.

Args:
  - search (string, optional): Filter by name (partial match)
  - page (number): Page number (default: 1)
  - page_size (number): Results per page (default: 25)
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of document types with their IDs, names, and document counts.`,
      inputSchema: ListDocumentTypesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ListDocumentTypesInput) => {
      try {
        const apiParams: Record<string, string | number | undefined> = {
          page: params.page,
          page_size: params.page_size,
          ordering: "name"
        };
        
        if (params.search) {
          apiParams["name__icontains"] = params.search;
        }
        
        const data = await get<PaginatedResponse<PaperlessDocumentType>>(
          "/api/document_types/",
          apiParams
        );
        
        const text = formatResponse(
          data,
          params.response_format,
          formatDocumentTypesListMarkdown
        );
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_create_document_type",
    {
      title: "Create Document Type",
      description: `Create a new document type in Paperless NGX.

Document types help categorize documents by their purpose. Set matching rules to automatically classify incoming documents.

Args:
  - name (string, required): Document type name (max 128 characters)
  - match (string, optional): Auto-matching pattern
  - matching_algorithm (number, optional): 0=None, 1=Any word, 2=All words, 3=Exact, 4=RegEx, 5=Fuzzy, 6=Auto
  - is_insensitive (boolean): Case-insensitive matching (default: true)

Returns:
  Confirmation with the new document type's details including its ID.`,
      inputSchema: CreateDocumentTypeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (params: CreateDocumentTypeInput) => {
      try {
        const dtypeData: Record<string, unknown> = {
          name: params.name,
          is_insensitive: params.is_insensitive
        };
        
        if (params.match) dtypeData.match = params.match;
        if (params.matching_algorithm !== undefined) {
          dtypeData.matching_algorithm = params.matching_algorithm;
        }
        
        const data = await post<PaperlessDocumentType>("/api/document_types/", dtypeData);
        
        const text = `Document type created successfully!\n${formatDocumentTypeMarkdown(data)}`;
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  // ===========================================================================
  // Saved View Tools
  // ===========================================================================
  
  server.registerTool(
    "paperless_list_saved_views",
    {
      title: "List Saved Views",
      description: `List all saved views in Paperless NGX.

Saved views are pre-configured search filters that can be quickly executed. They store filter criteria, sort order, and display settings.

Args:
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of saved views with their IDs, names, and configurations.`,
      inputSchema: ListSavedViewsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ListSavedViewsInput) => {
      try {
        // Saved views endpoint may return array directly or paginated
        const response = await get<PaginatedResponse<PaperlessSavedView> | PaperlessSavedView[]>(
          "/api/saved_views/"
        );
        
        const views = Array.isArray(response) ? response : response.results;
        
        if (params.response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(views, null, 2) }]
          };
        }
        
        const text = formatSavedViewsListMarkdown(views);
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  server.registerTool(
    "paperless_execute_saved_view",
    {
      title: "Execute Saved View",
      description: `Execute a saved view and return matching documents.

Runs the search defined in a saved view and returns the matching documents. Useful for quickly accessing frequently used document filters.

Args:
  - view_id (number, required): ID of the saved view to execute
  - page (number): Page number (default: 1)
  - page_size (number): Results per page (default: 25)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Documents matching the saved view's filter criteria.`,
      inputSchema: ExecuteSavedViewSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ExecuteSavedViewInput) => {
      try {
        // First, get the saved view configuration
        const view = await get<PaperlessSavedView>(
          `/api/saved_views/${params.view_id}/`
        );
        
        // Build query parameters from saved view
        const apiParams: Record<string, string | number | undefined> = {
          page: params.page,
          page_size: params.page_size
        };
        
        // Apply sort settings from saved view
        if (view.sort_field) {
          const sortPrefix = view.sort_reverse ? "-" : "";
          apiParams.ordering = `${sortPrefix}${view.sort_field}`;
        }
        
        // Apply filter rules from saved view
        // Note: This is a simplified mapping - Paperless uses numeric rule types
        for (const rule of view.filter_rules || []) {
          const ruleType = rule.rule_type;
          const value = rule.value;
          
          if (value === null) continue;
          
          // Map common rule types to API parameters
          // See Paperless NGX source for complete mapping
          switch (ruleType) {
            case 0: // Title contains
              apiParams["title__icontains"] = value;
              break;
            case 3: // Correspondent
              apiParams["correspondent__id"] = value;
              break;
            case 4: // Document type
              apiParams["document_type__id"] = value;
              break;
            case 6: // Has tags (all)
              apiParams["tags__id__all"] = value;
              break;
            case 17: // Created after
              apiParams["created__date__gt"] = value;
              break;
            case 18: // Created before
              apiParams["created__date__lt"] = value;
              break;
          }
        }
        
        const data = await get<PaginatedResponse<PaperlessDocument>>(
          "/api/documents/",
          apiParams
        );
        
        const headerText = `## Results for Saved View: ${view.name}\n\n`;
        const text = formatResponse(
          data,
          params.response_format,
          (d) => headerText + formatDocumentsListMarkdown(d)
        );
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
  
  // ===========================================================================
  // Statistics Tool
  // ===========================================================================
  
  server.registerTool(
    "paperless_get_statistics",
    {
      title: "Get Statistics",
      description: `Get statistics about the Paperless NGX instance.

Returns counts for documents, inbox items, character count, and document distribution by file type.

Args:
  - response_format ('markdown' | 'json'): Output format

Returns:
  System statistics including total documents, inbox count, and file type breakdown.`,
      inputSchema: GetStatisticsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: GetStatisticsInput) => {
      try {
        const data = await get<PaperlessStatistics>("/api/statistics/");
        
        const text = formatResponse(
          data,
          params.response_format,
          formatStatisticsMarkdown
        );
        
        return { content: [{ type: "text", text }] };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
