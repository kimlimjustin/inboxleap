/**
 * HTML Escaping Utility
 * 
 * Prevents XSS attacks by escaping HTML special characters in user input
 * before embedding in HTML email templates or web content.
 * 
 * SECURITY: This utility is critical for preventing HTML injection attacks
 * in email templates where user-controlled content is displayed.
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') {
    return '';
  }
  
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;"); // Forward slash for extra safety
}

/**
 * Escape HTML attribute values
 */
export function escapeHtmlAttribute(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') {
    return '';
  }
  
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

/**
 * Sanitize text for safe inclusion in JSON
 */
export function escapeJsonString(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') {
    return '';
  }
  
  return unsafe
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\b/g, "\\b")
    .replace(/\f/g, "\\f");
}

/**
 * Strip HTML tags completely (for plain text conversion)
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&') // Decode HTML entities (do this last)
    .trim();
}