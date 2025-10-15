/**
 * Robust JSON parsing utility for Claude AI responses
 * Handles markdown code blocks and mixed text responses
 */

export function parseClaudeJsonResponse(response: string): any {
  // Clean up Claude's response by removing markdown code blocks
  let cleanedResponse = response.trim();
  
  // Remove markdown code block formatting if present
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Try to find JSON in the response if it's mixed with other text
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[0];
  }
  
  // Additional cleanup for common Claude formatting issues
  cleanedResponse = cleanedResponse
    .replace(/^Here's the JSON response:\s*/i, '') // Remove common prefix
    .replace(/^Here's the analysis:\s*/i, '') // Remove common prefix
    .replace(/^Analysis:\s*/i, '') // Remove common prefix
    .trim();
  
  return JSON.parse(cleanedResponse);
}

export function parseClaudeJsonResponseSafe(response: string, fallback: any = null): any {
  try {
    return parseClaudeJsonResponse(response);
  } catch (error) {
    console.warn('Failed to parse Claude JSON response:', error);
    console.warn('Raw response (first 500 chars):', response.substring(0, 500));
    return fallback;
  }
}