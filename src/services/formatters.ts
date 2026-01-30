/**
 * Formatting Utilities
 * 
 * This module provides consistent formatting functions for converting Paperless NGX
 * data into human-readable markdown or structured JSON. All tools use these utilities
 * to ensure a uniform output style across the MCP server.
 * 
 * The formatting philosophy prioritizes:
 * - Readability: Clear structure with appropriate headers and spacing
 * - Completeness: All relevant information included without overwhelming detail
 * - Consistency: Same data types formatted identically across all tools
 */

import { MAX_CONTENT_LENGTH, MATCHING_ALGORITHM_DESCRIPTIONS } from "../constants.js";
import type {
  PaperlessDocument,
  PaperlessTag,
  PaperlessCorrespondent,
  PaperlessDocumentType,
  PaperlessSavedView,
  PaperlessStatistics,
  DocumentSuggestions,
  PaginatedResponse,
  ResponseFormat
} from "../types.js";

// =============================================================================
// Date Formatting
// =============================================================================

/**
 * Convert an ISO 8601 date string to a human-readable format.
 * Returns "Unknown" for null/undefined values to maintain output consistency.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  
  try {
    const date = new Date(dateStr);
    // Check for invalid date
    if (isNaN(date.getTime())) return dateStr;
    
    // Format as YYYY-MM-DD HH:MM in local time
    return date.toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date for display with just the date portion (no time).
 */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// Document Formatting
// =============================================================================

/**
 * Format a single document as a markdown block.
 * Includes all relevant metadata in a structured, readable format.
 * 
 * @param doc - The document to format
 * @param includeContent - Whether to include the full OCR text content
 */
export function formatDocumentMarkdown(
  doc: PaperlessDocument,
  includeContent: boolean = false
): string {
  const lines: string[] = [
    `### ${doc.title || "Untitled"}`,
    "",
    `**ID:** ${doc.id}`,
    `**Created:** ${formatDate(doc.created)}`,
    `**Added:** ${formatDate(doc.added)}`,
    `**Modified:** ${formatDate(doc.modified)}`
  ];
  
  // Add optional metadata fields if present
  if (doc.correspondent) {
    const corrName = doc.correspondent_name || `ID ${doc.correspondent}`;
    lines.push(`**Correspondent:** ${corrName}`);
  }
  
  if (doc.document_type) {
    const typeName = doc.document_type_name || `ID ${doc.document_type}`;
    lines.push(`**Document Type:** ${typeName}`);
  }
  
  if (doc.storage_path) {
    const pathName = doc.storage_path_name || `ID ${doc.storage_path}`;
    lines.push(`**Storage Path:** ${pathName}`);
  }
  
  if (doc.archive_serial_number !== null && doc.archive_serial_number !== undefined) {
    lines.push(`**ASN:** ${doc.archive_serial_number}`);
  }
  
  // Format tags - prefer names if available, fall back to IDs
  if (doc.tags && doc.tags.length > 0) {
    const tagDisplay = doc.tag_names?.length 
      ? doc.tag_names.join(", ")
      : doc.tags.map(t => `#${t}`).join(", ");
    lines.push(`**Tags:** ${tagDisplay}`);
  }
  
  if (doc.original_file_name) {
    lines.push(`**Original File:** ${doc.original_file_name}`);
  }
  
  // Include document content if requested
  if (includeContent && doc.content) {
    let content = doc.content;
    
    // Truncate very long content to avoid overwhelming the context
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH) + 
                `\n\n... [Content truncated. Full length: ${doc.content.length} characters]`;
    }
    
    lines.push("", "**Content:**", "```", content, "```");
  }
  
  // Include notes if present
  if (doc.notes && doc.notes.length > 0) {
    lines.push("", "**Notes:**");
    for (const note of doc.notes) {
      lines.push(`- ${formatDate(note.created)}: ${note.note}`);
    }
  }
  
  return lines.join("\n");
}

/**
 * Format a paginated list of documents as markdown.
 * Includes pagination information and summary statistics.
 */
export function formatDocumentsListMarkdown(
  data: PaginatedResponse<PaperlessDocument>,
  includeContent: boolean = false
): string {
  const docs = data.results;
  const total = data.count;
  
  if (docs.length === 0) {
    return "No documents found matching your criteria.";
  }
  
  const lines: string[] = [
    `## Documents (${docs.length} of ${total} total)`,
    ""
  ];
  
  for (const doc of docs) {
    lines.push(formatDocumentMarkdown(doc, includeContent));
    lines.push(""); // Blank line between documents
  }
  
  // Add pagination guidance if there are more results
  if (data.next) {
    lines.push(
      "---",
      `**Pagination:** Showing ${docs.length} of ${total} total documents.`,
      "Use the `page` parameter to view more results."
    );
  }
  
  return lines.join("\n");
}

// =============================================================================
// Tag Formatting
// =============================================================================

/**
 * Format a single tag as a markdown list item.
 */
export function formatTagMarkdown(tag: PaperlessTag): string {
  const parts: string[] = [
    `- **${tag.name}** (ID: ${tag.id})`
  ];
  
  // Add color indicator
  if (tag.color && tag.color !== "#000000") {
    parts.push(`  - Color: ${tag.color}`);
  }
  
  // Add document count
  parts.push(`  - Documents: ${tag.document_count ?? "N/A"}`);
  
  // Add matching info if configured
  if (tag.match) {
    const algorithm = MATCHING_ALGORITHM_DESCRIPTIONS[tag.matching_algorithm] || "Unknown";
    parts.push(`  - Auto-match: "${tag.match}" (${algorithm})`);
  }
  
  return parts.join("\n");
}

/**
 * Format a list of tags as markdown.
 */
export function formatTagsListMarkdown(
  data: PaginatedResponse<PaperlessTag>
): string {
  const tags = data.results;
  const total = data.count;
  
  if (tags.length === 0) {
    return "No tags found.";
  }
  
  const lines: string[] = [
    `## Tags (${tags.length} of ${total} total)`,
    ""
  ];
  
  for (const tag of tags) {
    lines.push(formatTagMarkdown(tag));
  }
  
  if (data.next) {
    lines.push(
      "",
      `**More available:** Use the \`page\` parameter to see additional tags.`
    );
  }
  
  return lines.join("\n");
}

// =============================================================================
// Correspondent Formatting
// =============================================================================

/**
 * Format a single correspondent as a markdown list item.
 */
export function formatCorrespondentMarkdown(corr: PaperlessCorrespondent): string {
  const parts: string[] = [
    `- **${corr.name}** (ID: ${corr.id})`
  ];
  
  parts.push(`  - Documents: ${corr.document_count ?? "N/A"}`);
  
  if (corr.last_correspondence) {
    parts.push(`  - Last correspondence: ${formatDateOnly(corr.last_correspondence)}`);
  }
  
  if (corr.match) {
    const algorithm = MATCHING_ALGORITHM_DESCRIPTIONS[corr.matching_algorithm] || "Unknown";
    parts.push(`  - Auto-match: "${corr.match}" (${algorithm})`);
  }
  
  return parts.join("\n");
}

/**
 * Format a list of correspondents as markdown.
 */
export function formatCorrespondentsListMarkdown(
  data: PaginatedResponse<PaperlessCorrespondent>
): string {
  const correspondents = data.results;
  const total = data.count;
  
  if (correspondents.length === 0) {
    return "No correspondents found.";
  }
  
  const lines: string[] = [
    `## Correspondents (${correspondents.length} of ${total} total)`,
    ""
  ];
  
  for (const corr of correspondents) {
    lines.push(formatCorrespondentMarkdown(corr));
  }
  
  if (data.next) {
    lines.push(
      "",
      `**More available:** Use the \`page\` parameter to see additional correspondents.`
    );
  }
  
  return lines.join("\n");
}

// =============================================================================
// Document Type Formatting
// =============================================================================

/**
 * Format a single document type as a markdown list item.
 */
export function formatDocumentTypeMarkdown(dtype: PaperlessDocumentType): string {
  const parts: string[] = [
    `- **${dtype.name}** (ID: ${dtype.id})`
  ];
  
  parts.push(`  - Documents: ${dtype.document_count ?? "N/A"}`);
  
  if (dtype.match) {
    const algorithm = MATCHING_ALGORITHM_DESCRIPTIONS[dtype.matching_algorithm] || "Unknown";
    parts.push(`  - Auto-match: "${dtype.match}" (${algorithm})`);
  }
  
  return parts.join("\n");
}

/**
 * Format a list of document types as markdown.
 */
export function formatDocumentTypesListMarkdown(
  data: PaginatedResponse<PaperlessDocumentType>
): string {
  const types = data.results;
  const total = data.count;
  
  if (types.length === 0) {
    return "No document types found.";
  }
  
  const lines: string[] = [
    `## Document Types (${types.length} of ${total} total)`,
    ""
  ];
  
  for (const dtype of types) {
    lines.push(formatDocumentTypeMarkdown(dtype));
  }
  
  if (data.next) {
    lines.push(
      "",
      `**More available:** Use the \`page\` parameter to see additional document types.`
    );
  }
  
  return lines.join("\n");
}

// =============================================================================
// Saved View Formatting
// =============================================================================

/**
 * Format a list of saved views as markdown.
 */
export function formatSavedViewsListMarkdown(
  views: PaperlessSavedView[]
): string {
  if (views.length === 0) {
    return "No saved views found.";
  }
  
  const lines: string[] = [
    `## Saved Views (${views.length} total)`,
    ""
  ];
  
  for (const view of views) {
    const parts: string[] = [
      `- **${view.name}** (ID: ${view.id})`
    ];
    
    if (view.show_on_dashboard) {
      parts.push(`  - Shown on dashboard`);
    }
    
    if (view.show_in_sidebar) {
      parts.push(`  - Shown in sidebar`);
    }
    
    if (view.sort_field) {
      const direction = view.sort_reverse ? "descending" : "ascending";
      parts.push(`  - Sort: ${view.sort_field} (${direction})`);
    }
    
    if (view.filter_rules && view.filter_rules.length > 0) {
      parts.push(`  - Filter rules: ${view.filter_rules.length} active`);
    }
    
    lines.push(parts.join("\n"));
  }
  
  return lines.join("\n");
}

// =============================================================================
// Statistics Formatting
// =============================================================================

/**
 * Format Paperless NGX statistics as markdown.
 */
export function formatStatisticsMarkdown(stats: PaperlessStatistics): string {
  const lines: string[] = [
    "## Paperless NGX Statistics",
    "",
    `**Total Documents:** ${stats.documents_total.toLocaleString("de-DE")}`,
    `**Documents in Inbox:** ${stats.documents_inbox.toLocaleString("de-DE")}`,
    `**Total Characters:** ${stats.character_count.toLocaleString("de-DE")}`
  ];
  
  if (stats.document_file_type_counts && stats.document_file_type_counts.length > 0) {
    lines.push("", "**Documents by File Type:**");
    
    for (const ft of stats.document_file_type_counts) {
      // Clean up MIME type for display
      const displayType = ft.mime_type.replace("application/", "").replace("image/", "");
      lines.push(`  - ${displayType}: ${ft.mime_type_count.toLocaleString("de-DE")}`);
    }
  }
  
  return lines.join("\n");
}

// =============================================================================
// Suggestions Formatting
// =============================================================================

/**
 * Format document suggestions as markdown.
 */
export function formatSuggestionsMarkdown(
  documentId: number,
  suggestions: DocumentSuggestions
): string {
  const lines: string[] = [
    `## Suggestions for Document #${documentId}`,
    ""
  ];
  
  let hasSuggestions = false;
  
  if (suggestions.correspondents && suggestions.correspondents.length > 0) {
    hasSuggestions = true;
    lines.push("**Suggested Correspondents:**");
    for (const c of suggestions.correspondents) {
      lines.push(`  - ${c.name} (ID: ${c.id})`);
    }
    lines.push("");
  }
  
  if (suggestions.tags && suggestions.tags.length > 0) {
    hasSuggestions = true;
    lines.push("**Suggested Tags:**");
    for (const t of suggestions.tags) {
      lines.push(`  - ${t.name} (ID: ${t.id})`);
    }
    lines.push("");
  }
  
  if (suggestions.document_types && suggestions.document_types.length > 0) {
    hasSuggestions = true;
    lines.push("**Suggested Document Types:**");
    for (const dt of suggestions.document_types) {
      lines.push(`  - ${dt.name} (ID: ${dt.id})`);
    }
    lines.push("");
  }
  
  if (suggestions.dates && suggestions.dates.length > 0) {
    hasSuggestions = true;
    lines.push("**Suggested Dates:**");
    for (const d of suggestions.dates) {
      lines.push(`  - ${formatDateOnly(d)}`);
    }
  }
  
  if (!hasSuggestions) {
    lines.push("No suggestions available for this document.");
  }
  
  return lines.join("\n");
}

// =============================================================================
// Response Formatter
// =============================================================================

/**
 * Format data for tool response based on the requested format.
 * This is the main entry point for formatting tool outputs.
 * 
 * @param data - The data to format
 * @param format - Desired output format (markdown or json)
 * @param markdownFormatter - Function to format data as markdown
 */
export function formatResponse<T>(
  data: T,
  format: ResponseFormat,
  markdownFormatter: (data: T) => string
): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return markdownFormatter(data);
}
