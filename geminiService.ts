import { ZoteroItem, EnrichmentResult, OrganizationSuggestion, TagCluster } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Gemini model names for v1beta API:
// - gemini-3-flash-preview (best, newest, optimized for speed)
// - gemini-2.5-flash (good and stable, reliable fallback)
// - gemini-2.0-flash-exp (experimental fallback)
const MODEL = 'gemini-3-flash-preview';
const MODEL_FALLBACK = 'gemini-2.5-flash';
const MODEL_FALLBACK2 = 'gemini-2.0-flash-exp';

/**
 * Simple JSON parse that returns null on failure instead of throwing
 * No complex repair logic - if it doesn't parse, we skip it
 */
function safeJSONParse(jsonString: string): any | null {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }

  // Basic cleaning: Remove Markdown code blocks if present
  let clean = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
  
  // Remove any text before first { or after last }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(clean);
  } catch (e) {
    // Just return null - don't try to repair, don't throw errors
    console.warn('[Gemini Service] JSON parse failed, skipping response');
    return null;
  }
}

export interface GeminiResponse {
  text?: string;
  json?: any;
  rawText?: string;
  error?: Error;
}

export async function callGemini(apiKey: string, prompt: string, expectJson: boolean = false): Promise<any> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API key is required');
  }
  
  // Try primary model first, then fallbacks
  const modelsToTry = [MODEL, MODEL_FALLBACK, MODEL_FALLBACK2];
  let lastError: Error | null = null;
  
  for (const model of modelsToTry) {
    try {
      const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
      
      // If expecting JSON, add system instruction to enforce JSON format
      const systemInstruction = expectJson 
        ? "You MUST respond with ONLY valid, complete JSON. Start with { and end with }. Do not include any explanatory text, markdown code blocks, or text outside the JSON object. Ensure the JSON is complete and properly closed."
        : undefined;
      
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1, // Lower temperature for more consistent data extraction
          maxOutputTokens: 8192, // Increased to reduce truncation
        }
      };
      
      // Add JSON response type if expecting JSON
      // Note: responseMimeType may not be supported in all API versions
      if (expectJson) {
        body.generationConfig.responseMimeType = 'application/json';
      }
      
      // Add system instruction if provided (Gemini API supports this)
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        let errText = '';
        try {
          const errData = await response.json();
          errText = JSON.stringify(errData);
        } catch {
          errText = await response.text();
        }
        
        // Never log API keys - sanitize error messages
        const sanitizedErr = errText.replace(/key=([^&\s"']+)/gi, 'key=***').replace(/AIza[^"'\s}]+/gi, 'AIza***');
        
        // Log full error details for debugging
        console.error('[Gemini Service] API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          error: sanitizedErr,
          model: model,
          url: url.replace(/key=[^&]+/, 'key=***'),
          errorDetails: errText.length > 500 ? errText.substring(0, 500) + '...' : errText
        });
        
        // If it's a model-specific error and we have another model to try, continue
        const isModelError = errText.includes('model') || 
                            errText.includes('not found') || 
                            errText.includes('invalid') ||
                            errText.includes('Model') ||
                            errText.includes('does not exist') ||
                            response.status === 404;
        
        if (isModelError && modelsToTry.indexOf(model) < modelsToTry.length - 1) {
          console.warn(`[Gemini Service] Model ${model} failed (${response.status}), trying next model...`);
          lastError = new Error(`Model ${model} failed: ${response.status}`);
          continue; // Try next model
        }
        
        throw new Error(`Gemini API error (${model}): ${response.status} - ${sanitizedErr}`);
      }
      
      // Success - parse response
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        // If no text but we have another model to try, continue
        if (modelsToTry.indexOf(model) < modelsToTry.length - 1) {
          lastError = new Error('Empty response from Gemini');
          continue;
        }
        throw new Error('Empty response from Gemini');
      }
      
      // If expecting JSON, use simple safe parsing (returns null on failure)
      if (expectJson) {
        const parsed = safeJSONParse(text);
        if (parsed === null) {
          // If parsing failed and we have another model to try, continue
          if (modelsToTry.indexOf(model) < modelsToTry.length - 1) {
            lastError = new Error('Could not parse JSON response');
            continue;
          }
          // Return empty object instead of throwing - let the caller handle it
          console.warn('[Gemini Service] Could not parse JSON response, returning empty result');
          return {};
        }
        return parsed;
      }
      
      return text;
    } catch (error) {
      // If this is the last model, throw the error
      if (modelsToTry.indexOf(model) >= modelsToTry.length - 1) {
        throw error;
      }
      // Otherwise, save error and try next model
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }
  
  // If we get here, all models failed
  throw lastError || new Error('All Gemini models failed');
}

export async function suggestOrganization(
  items: ZoteroItem[], 
  apiKey: string
): Promise<OrganizationSuggestion[]> {
  const context = items.map(i => ({
    key: i.key,
    title: i.data.title,
    abstract: i.data.abstractNote || 'No abstract available',
    existingTags: i.data.tags?.map(t => t.tag) || []
  }));

  const prompt = `You are an expert information architect for academic libraries. 
Analyze these ${items.length} bibliographic items and suggest organization.

For each item, consider:
- The title
- The abstract (full text)
- Existing user tags (if any) - build upon these, don't duplicate them

For each item, provide:
1. "suggestedCollection": A specific but concise collection name (e.g., "Deep Learning Architectures")
2. "suggestedTags": 3-5 highly descriptive tags that complement the existing tags. If the item already has good tags, suggest additional relevant tags that add value.
3. "reasoning": Brief explanation for the classification

Items:
${JSON.stringify(context, null, 2)}

Respond with ONLY a valid JSON array of objects with keys: itemKey, suggestedCollection, suggestedTags, reasoning.
Do not include any explanatory text, only the JSON array.`;

  try {
    const result = await callGemini(apiKey, prompt, true);
    
    // Handle different response formats
    let suggestionsArray: any[] = [];
    
    if (Array.isArray(result)) {
      suggestionsArray = result;
    } else if (result && typeof result === 'object') {
      // Check if it's wrapped in a property
      if (result.suggestions && Array.isArray(result.suggestions)) {
        suggestionsArray = result.suggestions;
      } else if (result.items && Array.isArray(result.items)) {
        suggestionsArray = result.items;
      } else if (result.data && Array.isArray(result.data)) {
        suggestionsArray = result.data;
      } else {
        // Try to extract array from object values
        const values = Object.values(result);
        if (values.length > 0 && Array.isArray(values[0])) {
          suggestionsArray = values[0];
        } else {
          // Single object - wrap in array
          suggestionsArray = [result];
        }
      }
    }
    
    if (suggestionsArray.length === 0) {
      return [];
    }
    
    // Map results to ensure itemKey is set correctly
    // The AI might return 'key' or 'itemKey', so we normalize it
    return suggestionsArray.map((suggestion: any, index: number) => {
      const itemKey = suggestion.itemKey || suggestion.key || items[index]?.key || '';
      return {
        itemKey,
        itemTitle: suggestion.itemTitle || items.find(i => i.key === itemKey)?.data.title,
        suggestedCollection: suggestion.suggestedCollection || '',
        suggestedTags: Array.isArray(suggestion.suggestedTags) ? suggestion.suggestedTags : [],
        reasoning: suggestion.reasoning || ''
      };
    }).filter(s => s.itemKey); // Filter out any invalid entries
  } catch (e) {
    console.error("[Gemini Service] Failed to parse organization suggestions:", e instanceof Error ? e.message : 'Unknown error');
    console.error("[Gemini Service] Error details:", e);
    throw e; // Re-throw so UI can show error
  }
}

export async function standardizeTags(
  tags: string[], 
  apiKey: string
): Promise<TagCluster[]> {
  const prompt = `Analyze this list of Zotero tags from an academic library.
Identify groups of tags that are synonyms, variations, or closely related concepts.
For each group, suggest a single canonical tag to merge them into.

Tags: ${tags.join(', ')}

Only include groups where tags are genuinely similar or duplicative.
Respond with ONLY a valid JSON array of objects with keys: canonicalTag, similarTags (array), reason.
Do not include any explanatory text, only the JSON array.`;

  try {
    const result = await callGemini(apiKey, prompt, true);
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("[Gemini Service] Failed to parse tag clusters:", e instanceof Error ? e.message : 'Unknown error');
    throw e; // Re-throw so UI can show error
  }
}

export async function enrichItemMetadata(
  item: ZoteroItem, 
  apiKey: string
): Promise<EnrichmentResult> {
  const itemData = item.data;
  
  const isBookChapter = itemData.itemType === 'bookChapter';
  const isJournalArticle = itemData.itemType === 'journalArticle';
  
  let itemSpecificPrompt = '';
  if (isBookChapter) {
    itemSpecificPrompt = `
SPECIFIC REQUIREMENTS FOR BOOK CHAPTERS:
- bookTitle: The full title of the book containing this chapter (REQUIRED)
- pages: Page numbers for this chapter, e.g., "123-145" (REQUIRED)
- ISBN: ISBN of the book (recommended)
- publisher: Publisher of the book (recommended)
- Ensure chapter title (title field) matches the chapter, not the book`;
  } else if (isJournalArticle) {
    itemSpecificPrompt = `
SPECIFIC REQUIREMENTS FOR JOURNAL ARTICLES:
- volume: Journal volume number (REQUIRED)
- issue: Journal issue number (REQUIRED)
- pages: Page numbers, e.g., "123-145" (REQUIRED)
- publicationTitle: Full journal name (REQUIRED)`;
  }

  const prompt = `You are a scholarly search specialist. Find verified bibliographic metadata.

Search academic databases (Crossref, PubMed, Google Scholar) for this reference:

Title: ${itemData.title}
Authors: ${item.meta.creatorSummary || 'Unknown'}
Year: ${itemData.date || 'Unknown'}
Type: ${itemData.itemType}
Current DOI: ${itemData.DOI || 'Missing'}
Current ISBN: ${itemData.ISBN || 'Missing'}
${isBookChapter ? `Current Book Title: ${itemData.bookTitle || 'Missing'}` : ''}
${isBookChapter ? `Current Pages: ${itemData.pages || 'Missing'}` : ''}
${isJournalArticle ? `Current Volume: ${itemData.volume || 'Missing'}` : ''}
${isJournalArticle ? `Current Issue: ${itemData.issue || 'Missing'}` : ''}
${isJournalArticle ? `Current Pages: ${itemData.pages || 'Missing'}` : ''}

Goal: Find the missing DOI, ISBN/ISSN, publication name, abstract, and authors/creators.
${itemSpecificPrompt}

CRITICAL RULES:
- Only include fields you can verify from academic sources
- If uncertain, leave the field empty or null (use null, not the string "null")
- DO NOT make up data
- For abstracts, provide the actual abstract text if found
- For creators (authors), provide an array of creator objects with proper names (not placeholder data like "Last1, F.; Last2")
- Each creator object must have: creatorType (usually "author"), and either (firstName + lastName) OR name
- Ensure all strings are properly escaped (use \\n for newlines, \\" for quotes)
- Do not include trailing commas
- Keep JSON valid and well-formed
- Return ONLY valid JSON - no markdown code blocks, no explanatory text, no text before or after the JSON

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY a valid JSON object
- Start with { and end with }
- Do NOT include any text before or after the JSON
- Do NOT wrap in markdown code blocks (no triple backticks with json or plain triple backticks)
- Do NOT include explanatory text, comments, or notes
- All string values must use double quotes, not single quotes
- Escape special characters: use \\n for newlines, \\" for quotes, \\\\ for backslashes
- Do NOT include trailing commas
- Use null (not the string "null") for missing values
- Keep the JSON compact and valid

Include only these fields if you can confidently fill them:
title, date, DOI, ISBN, publisher, publicationTitle, bookTitle, volume, issue, pages, abstractNote, url, conferenceName, university, institution, creators.

For creators, use this format (array of objects):
[{"creatorType": "author", "firstName": "John", "lastName": "Smith"}, {"creatorType": "author", "firstName": "Jane", "lastName": "Doe"}]
OR for names that can't be split: [{"creatorType": "author", "name": "Full Name"}]

Example format (your response should look exactly like this, with no additional text):
${isBookChapter 
  ? '{"bookTitle": "The Book Title", "pages": "123-145", "ISBN": "978-0-123456-78-9", "publisher": "Example Press", "creators": [{"creatorType": "author", "firstName": "John", "lastName": "Smith"}]}'
  : isJournalArticle
  ? '{"DOI": "10.1234/example", "volume": "42", "issue": "3", "pages": "123-145", "publicationTitle": "Journal Name", "creators": [{"creatorType": "author", "firstName": "Jane", "lastName": "Doe"}]}'
  : '{"DOI": "10.1234/example", "abstractNote": "The abstract text here", "publisher": "Example Press", "creators": [{"creatorType": "author", "firstName": "John", "lastName": "Smith"}]}'
}

CRITICAL: Your response MUST be a complete, valid JSON object that starts with { and ends with }.
DO NOT truncate the response - ensure all fields are included and the JSON is properly closed.
The JSON must be parseable by JSON.parse() without any modifications.
Return ONLY the JSON object, nothing else - no text before, no text after, no explanations.`;

  try {
    const result = await callGemini(apiKey, prompt, true);
    
    // If result is null, empty, or not an object, return empty
    if (!result || typeof result !== 'object') {
      return {};
    }
    
    const cleaned: EnrichmentResult = {};
    
    // Only keep fields that are actually different and provide value
    Object.entries(result).forEach(([key, val]) => {
        // Only process fields that are in EnrichmentResult
        const validFields = ['title', 'date', 'DOI', 'ISBN', 'publisher', 'publicationTitle', 
                        'bookTitle', 'volume', 'issue', 'pages', 'abstractNote', 'url', 'conferenceName', 
                        'university', 'institution', 'creators'];
        if (!validFields.includes(key)) {
          return; // Skip unexpected fields
        }
    
    const currentVal = (itemData as any)[key];
    
    // Handle creators specially (array of objects)
    if (key === 'creators') {
      if (Array.isArray(val) && val.length > 0) {
        // Validate creator structure and only use if it's properly formatted
        const validCreators = val.filter((c: any) => 
          c && typeof c === 'object' && 
          (c.lastName || c.name || c.firstName) &&
          c.creatorType
        );
        if (validCreators.length > 0) {
          // Check if creators are different from current (simple check - if current has placeholder-like data)
          const currentCreatorsStr = JSON.stringify((itemData.creators || []).map(c => 
            [c.lastName, c.firstName, c.name].filter(Boolean).join(' ')
          )).toLowerCase();
          const hasPlaceholder = currentCreatorsStr.includes('last1') || 
                                  currentCreatorsStr.includes('last2') || 
                                  currentCreatorsStr.match(/last\d+/i);
          
          // Always use new creators if current ones look like placeholders, or if they're different
          if (hasPlaceholder || JSON.stringify(validCreators) !== JSON.stringify(itemData.creators || [])) {
            (cleaned as any)[key] = validCreators;
          }
        }
      }
      return; // Done processing creators
    }
    
    // Handle different value types for other fields
    if (val !== null && val !== undefined) {
      const stringVal = String(val).trim();
      if (
        stringVal !== '' && 
        stringVal !== currentVal && 
        stringVal.toLowerCase() !== 'unknown' &&
        stringVal.toLowerCase() !== 'null' &&
        stringVal.toLowerCase() !== 'n/a' &&
        stringVal.toLowerCase() !== 'none'
      ) {
        (cleaned as any)[key] = typeof val === 'string' ? stringVal : val;
      }
    }
    });
    
    return cleaned;
  } catch (err) {
    // Don't throw errors - just return empty object and log
    console.warn("Enrichment error (returning empty result):", err instanceof Error ? err.message : String(err));
    return {}; // Return empty instead of throwing
  }
}
