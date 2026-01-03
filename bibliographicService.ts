import { ZoteroItem, EnrichmentResult, ZoteroCreator } from './types';

/**
 * Bibliographic Metadata Service
 * Uses real APIs (Crossref, OpenAlex) to find verified metadata
 * Never makes up data - only returns what can be verified from sources
 */

interface CrossrefWork {
  title?: string[];
  author?: Array<{
    given?: string;
    family?: string;
    name?: string;
  }>;
  published?: {
    'date-parts'?: number[][];
  };
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  ISBN?: string[];
  publisher?: string;
  abstract?: string;
  URL?: string;
}

interface CrossrefResponse {
  message?: CrossrefWork | {
    items?: CrossrefWork[];
  };
}

interface OpenAlexWork {
  id?: string;
  title?: string;
  authorships?: Array<{
    author: {
      display_name?: string;
    };
  }>;
  publication_date?: string;
  primary_location?: {
    source?: {
      display_name?: string;
    };
    landing_page_url?: string;
  };
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  doi?: string;
  abstract_inverted_index?: Record<string, number[]>;
  ids?: {
    doi?: string;
  };
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
}

/**
 * Search Crossref by DOI
 */
async function searchCrossrefByDOI(doi: string): Promise<EnrichmentResult | null> {
  try {
    const cleanDOI = doi.replace(/^https?:\/\/dx\.doi\.org\//, '').replace(/^https?:\/\/doi\.org\//, '').trim();
    if (!cleanDOI) return null;

    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Zotero-Cleanup-App/1.0 (mailto:support@example.com)'
      }
    });

    if (!response.ok) return null;

    let data: CrossrefResponse;
    try {
      data = await response.json();
    } catch (parseError) {
      console.warn('[Bibliographic Service] Failed to parse Crossref response:', parseError);
      return null;
    }
    
    // Crossref DOI endpoint returns work directly in message, not in items array
    const work = data.message && 'title' in data.message ? data.message : null;

    if (!work) return null;

    const result: EnrichmentResult = {};

    // Title
    if (work.title && work.title.length > 0) {
      result.title = work.title[0];
    }

    // Authors/Creators
    if (work.author && work.author.length > 0) {
      console.log(`[Bibliographic Service] Crossref DOI: Found ${work.author.length} author(s) from Crossref API for DOI ${cleanDOI}`);
      console.log(`[Bibliographic Service] Crossref DOI: Raw author data:`, JSON.stringify(work.author, null, 2));
      
      result.creators = work.author.map(author => {
        const creator: ZoteroCreator = {
          creatorType: 'author',
          firstName: author.given || '',
          lastName: author.family || ''
        };
        // If no first/last name but has name field, use that
        if (!creator.firstName && !creator.lastName && author.name) {
          return {
            creatorType: 'author',
            name: author.name
          };
        }
        return creator;
      }).filter(c => c.firstName || c.lastName || c.name);
      
      console.log(`[Bibliographic Service] Crossref DOI: Processed ${result.creators.length} creator(s):`, JSON.stringify(result.creators, null, 2));
    } else {
      console.log(`[Bibliographic Service] Crossref DOI: No authors found in Crossref response for DOI ${cleanDOI}`);
    }

    // Date
    if (work.published && work.published['date-parts'] && work.published['date-parts'].length > 0) {
      const dateParts = work.published['date-parts'][0];
      if (dateParts && dateParts.length > 0) {
        result.date = dateParts[0].toString();
      }
    }

    // DOI
    if (work.DOI) {
      result.DOI = work.DOI;
    }

    // Publication title (journal name)
    if (work['container-title'] && work['container-title'].length > 0) {
      result.publicationTitle = work['container-title'][0];
    }

    // Volume, Issue, Pages
    if (work.volume) {
      result.volume = work.volume;
    }
    if (work.issue) {
      result.issue = work.issue;
    }
    if (work.page) {
      result.pages = work.page;
    }

    // ISBN
    if (work.ISBN && work.ISBN.length > 0) {
      result.ISBN = work.ISBN[0];
    }

    // Publisher
    if (work.publisher) {
      result.publisher = work.publisher;
    }

    // Abstract
    if (work.abstract) {
      // Crossref abstracts may be HTML, strip tags
      result.abstractNote = work.abstract.replace(/<[^>]*>/g, '').trim();
    }

    // URL
    if (work.URL) {
      result.url = work.URL;
    } else if (work.DOI) {
      result.url = `https://doi.org/${work.DOI}`;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.warn('[Bibliographic Service] Crossref DOI search failed:', error);
    return null;
  }
}

/**
 * Search Crossref by title and optional author/year
 */
async function searchCrossrefByTitle(
  title: string,
  author?: string,
  year?: string
): Promise<EnrichmentResult | null> {
  try {
    if (!title || title.trim().length < 10) return null;

    // Build query - try multiple strategies
    let query = '';
    
    // Strategy 1: Exact title match in quotes
    const titleForQuery = title.trim();
    query = `title:"${titleForQuery}"`;
    
    if (author) {
      const authorParts = author.split(/[,;]/)[0].trim(); // Use first author
      if (authorParts && authorParts.length > 2) {
        // Extract last name from author string
        const lastWord = authorParts.split(/\s+/).pop();
        if (lastWord && lastWord.length > 2) {
          query += ` author:"${lastWord}"`;
        }
      }
    }
    if (year) {
      const yearMatch = year.match(/\d{4}/);
      if (yearMatch) {
        query += ` year:${yearMatch[0]}`;
      }
    }

    const response = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=3&sort=relevance`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Zotero-Cleanup-App/1.0 (mailto:support@example.com)'
        }
      }
    );

    if (!response.ok) {
      // If exact match fails, try without quotes (broader search)
      if (response.status === 404 || response.status >= 500) {
        const fallbackQuery = titleForQuery;
        const fallbackResponse = await fetch(
          `https://api.crossref.org/works?query=${encodeURIComponent(fallbackQuery)}&rows=3&sort=relevance`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Zotero-Cleanup-App/1.0 (mailto:support@example.com)'
            }
          }
        );
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const items = fallbackData.message && 'items' in fallbackData.message ? fallbackData.message.items : undefined;
          if (items && items.length > 0) {
            // Find best match by title similarity
            const bestMatch = items.find((work: any) => {
              const workTitle = (work.title?.[0] || '').toLowerCase();
              const searchTitle = titleForQuery.toLowerCase();
              return workTitle.includes(searchTitle.substring(0, 20)) ||
                     searchTitle.includes(workTitle.substring(0, 20));
            }) || items[0];
            
            if (bestMatch.DOI) {
              return await searchCrossrefByDOI(bestMatch.DOI);
            }
          }
        }
      }
      return null;
    }

    let data: CrossrefResponse;
    try {
      data = await response.json();
    } catch (parseError) {
      console.warn('[Bibliographic Service] Failed to parse Crossref title search response:', parseError);
      return null;
    }
    
    // Crossref search endpoint returns items array
    const items = data.message && 'items' in data.message ? data.message.items : undefined;

    if (!items || items.length === 0) return null;

    // Find best match by title similarity (not just first result)
    let bestMatch = items[0];
    const searchTitleLower = title.trim().toLowerCase();
    
    // Try to find exact or close match
    for (const work of items) {
      const workTitle = (work.title?.[0] || '').toLowerCase();
      // Check if titles are similar
      if (workTitle === searchTitleLower || 
          workTitle.includes(searchTitleLower.substring(0, Math.min(30, searchTitleLower.length))) ||
          searchTitleLower.includes(workTitle.substring(0, Math.min(30, workTitle.length)))) {
        bestMatch = work;
        break;
      }
    }
    
    // Try to get full data via DOI first
    if (bestMatch.DOI) {
      try {
        const result = await searchCrossrefByDOI(bestMatch.DOI);
        if (result) return result;
      } catch (error) {
        // DOI lookup failed (404, etc.), extract directly from search result
        console.warn(`[Bibliographic Service] DOI lookup failed for ${bestMatch.DOI}, using search result data`);
      }
    }
    
    // Extract data directly from search result (even if DOI lookup failed)
    const directResult: EnrichmentResult = {};
    
    if (bestMatch.title && bestMatch.title.length > 0) {
      directResult.title = bestMatch.title[0];
    }
    
    if (bestMatch.author && bestMatch.author.length > 0) {
      console.log(`[Bibliographic Service] Crossref Title Search: Found ${bestMatch.author.length} author(s) from Crossref title search`);
      console.log(`[Bibliographic Service] Crossref Title Search: Raw author data:`, JSON.stringify(bestMatch.author, null, 2));
      
      directResult.creators = bestMatch.author.map((author: any) => ({
        creatorType: 'author' as const,
        firstName: author.given || '',
        lastName: author.family || ''
      })).filter((c: ZoteroCreator) => c.lastName || c.firstName);
      
      console.log(`[Bibliographic Service] Crossref Title Search: Processed ${directResult.creators.length} creator(s):`, JSON.stringify(directResult.creators, null, 2));
    } else {
      console.log(`[Bibliographic Service] Crossref Title Search: No authors found in search results`);
    }
    
    if (bestMatch.published?.['date-parts']?.[0]?.[0]) {
      directResult.date = bestMatch.published['date-parts'][0][0].toString();
    }
    
    if (bestMatch.DOI) {
      directResult.DOI = bestMatch.DOI;
    }
    
    if (bestMatch['container-title'] && bestMatch['container-title'].length > 0) {
      directResult.publicationTitle = bestMatch['container-title'][0];
    }
    
    if (bestMatch.volume) {
      directResult.volume = bestMatch.volume;
    }
    
    if (bestMatch.issue) {
      directResult.issue = bestMatch.issue;
    }
    
    if (bestMatch.page) {
      directResult.pages = bestMatch.page;
    }
    
    if (bestMatch.publisher) {
      directResult.publisher = bestMatch.publisher;
    }
    
    if (Object.keys(directResult).length > 0) {
      return directResult;
    }
    
    return null;
  } catch (error) {
    console.warn('[Bibliographic Service] Crossref title search failed:', error);
    return null;
  }
}

/**
 * Search OpenAlex by title and optional author
 */
async function searchOpenAlex(
  title: string,
  author?: string,
  year?: string
): Promise<EnrichmentResult | null> {
  try {
    if (!title || title.trim().length < 10) return null;

    // Build search query
    let query = title.trim();
    if (author) {
      const authorParts = author.split(/[,;]/)[0].trim();
      if (authorParts) {
        query += ` ${authorParts}`;
      }
    }

    const searchUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=3&sort=relevance_score:desc`;
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) return null;

    let data: OpenAlexResponse;
    try {
      data = await response.json();
    } catch (parseError) {
      console.warn('[Bibliographic Service] Failed to parse OpenAlex response:', parseError);
      return null;
    }
    const works = data.results;

    if (!works || works.length === 0) return null;

    // Find best match by title similarity
    const searchTitleLower = title.trim().toLowerCase();
    let bestWork = works[0];
    
    for (const work of works) {
      const workTitle = (work.title || '').toLowerCase();
      if (workTitle === searchTitleLower || 
          workTitle.includes(searchTitleLower.substring(0, Math.min(30, searchTitleLower.length))) ||
          searchTitleLower.includes(workTitle.substring(0, Math.min(30, workTitle.length)))) {
        bestWork = work;
        break;
      }
    }
    
    const work = bestWork;
    const result: EnrichmentResult = {};

    // Title
    if (work.title) {
      result.title = work.title;
    }

    // Authors
    if (work.authorships && work.authorships.length > 0) {
      console.log(`[Bibliographic Service] OpenAlex: Found ${work.authorships.length} authorship(s) from OpenAlex API`);
      console.log(`[Bibliographic Service] OpenAlex: Raw authorship data:`, JSON.stringify(work.authorships.map(a => a.author?.display_name), null, 2));
      
      result.creators = work.authorships
        .map(authorship => {
          const displayName = authorship.author?.display_name || '';
          if (!displayName) return null;

          // Try to split name
          const parts = displayName.trim().split(/\s+/);
          if (parts.length >= 2) {
            const lastName = parts[parts.length - 1];
            const firstName = parts.slice(0, -1).join(' ');
            return {
              creatorType: 'author',
              firstName,
              lastName
            } as ZoteroCreator;
          }
          return {
            creatorType: 'author',
            name: displayName
          } as ZoteroCreator;
        })
        .filter((c): c is ZoteroCreator => c !== null);
      
      console.log(`[Bibliographic Service] OpenAlex: Processed ${result.creators.length} creator(s):`, JSON.stringify(result.creators, null, 2));
    } else {
      console.log(`[Bibliographic Service] OpenAlex: No authorships found in OpenAlex response`);
    }

    // Date
    if (work.publication_date) {
      const yearMatch = work.publication_date.match(/^(\d{4})/);
      if (yearMatch) {
        result.date = yearMatch[1];
      }
    }

    // DOI
    if (work.doi) {
      result.DOI = work.doi.replace(/^https?:\/\/dx\.doi\.org\//, '').replace(/^https?:\/\/doi\.org\//, '');
      result.url = `https://doi.org/${result.DOI}`;
    } else if (work.ids?.doi) {
      result.DOI = work.ids.doi.replace(/^https?:\/\/dx\.doi\.org\//, '').replace(/^https?:\/\/doi\.org\//, '');
      result.url = `https://doi.org/${result.DOI}`;
    }

    // Publication title
    if (work.primary_location?.source?.display_name) {
      result.publicationTitle = work.primary_location.source.display_name;
    }

    // URL
    if (!result.url && work.primary_location?.landing_page_url) {
      result.url = work.primary_location.landing_page_url;
    }

    // Volume, Issue, Pages
    if (work.biblio) {
      if (work.biblio.volume) {
        result.volume = work.biblio.volume;
      }
      if (work.biblio.issue) {
        result.issue = work.biblio.issue;
      }
      if (work.biblio.first_page && work.biblio.last_page) {
        result.pages = `${work.biblio.first_page}-${work.biblio.last_page}`;
      } else if (work.biblio.first_page) {
        result.pages = work.biblio.first_page;
      }
    }

    // Abstract (reconstruct from inverted index)
    if (work.abstract_inverted_index) {
      const words: string[] = [];
      const positions: Array<{ word: string; pos: number }> = [];
      
      Object.entries(work.abstract_inverted_index).forEach(([word, positions_list]) => {
        positions_list.forEach(pos => {
          positions.push({ word, pos });
        });
      });

      positions.sort((a, b) => a.pos - b.pos);
      const abstract = positions.map(p => p.word).join(' ');
      if (abstract.trim().length > 20) {
        result.abstractNote = abstract.trim();
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.warn('[Bibliographic Service] OpenAlex search failed:', error);
    return null;
  }
}

/**
 * Main function to enrich item metadata using real bibliographic APIs
 * Tries multiple sources and strategies aggressively
 * Only returns verified data, never makes up information
 */
export async function enrichItemMetadataFromAPIs(
  item: ZoteroItem
): Promise<{ result: EnrichmentResult; source: string } | null> {
  const itemData = item.data;
  const authorSummary = item.meta.creatorSummary || '';
  const title = itemData.title?.trim() || '';
  
  console.log(`[Bibliographic Service] Starting metadata enrichment for item: ${item.key}`);
  console.log(`[Bibliographic Service] Item title: "${title}"`);
  console.log(`[Bibliographic Service] Item DOI: ${itemData.DOI || 'none'}`);
  console.log(`[Bibliographic Service] Item existing authors:`, JSON.stringify(itemData.creators || [], null, 2));
  console.log(`[Bibliographic Service] Item author summary: "${authorSummary}"`);

  // Strategy 1: If we have a DOI, try Crossref directly (but don't fail completely if 404)
  if (itemData.DOI) {
    try {
      console.log(`[Bibliographic Service] Strategy 1: Trying Crossref DOI lookup for ${itemData.DOI}`);
      const crossrefResult = await searchCrossrefByDOI(itemData.DOI);
      if (crossrefResult && Object.keys(crossrefResult).length > 0) {
        console.log(`[Bibliographic Service] Strategy 1 SUCCESS: Crossref DOI returned data`);
        console.log(`[Bibliographic Service] Strategy 1: Result includes creators:`, crossrefResult.creators ? JSON.stringify(crossrefResult.creators, null, 2) : 'none');
        return { result: crossrefResult, source: 'Crossref (DOI)' };
      } else {
        console.log(`[Bibliographic Service] Strategy 1: Crossref DOI returned no data`);
      }
    } catch (error) {
      // DOI lookup failed (404, etc.) - continue to title search
      console.warn(`[Bibliographic Service] Strategy 1 FAILED: DOI lookup failed for ${itemData.DOI}, trying title search`, error);
    }
  } else {
    console.log(`[Bibliographic Service] Strategy 1: Skipped (no DOI)`);
  }

  // Strategy 2: Aggressive title-based search
  if (title.length >= 10) {
    // Try Crossref with title + author + year
    if (authorSummary) {
      try {
        console.log(`[Bibliographic Service] Strategy 2a: Trying Crossref title search (title + author + year)`);
        const crossrefResult = await searchCrossrefByTitle(title, authorSummary, itemData.date);
        if (crossrefResult && Object.keys(crossrefResult).length > 0) {
          console.log(`[Bibliographic Service] Strategy 2a SUCCESS: Crossref title search returned data`);
          console.log(`[Bibliographic Service] Strategy 2a: Result includes creators:`, crossrefResult.creators ? JSON.stringify(crossrefResult.creators, null, 2) : 'none');
          return { result: crossrefResult, source: 'Crossref (Title+Author)' };
        } else {
          console.log(`[Bibliographic Service] Strategy 2a: Crossref title search returned no data`);
        }
      } catch (error) {
        console.warn(`[Bibliographic Service] Strategy 2a FAILED:`, error);
      }
    }

    // Try Crossref with title + year only
    if (itemData.date) {
      try {
        console.log(`[Bibliographic Service] Strategy 2b: Trying Crossref title search (title + year)`);
        const crossrefResult = await searchCrossrefByTitle(title, undefined, itemData.date);
        if (crossrefResult && Object.keys(crossrefResult).length > 0) {
          console.log(`[Bibliographic Service] Strategy 2b SUCCESS: Crossref title search returned data`);
          console.log(`[Bibliographic Service] Strategy 2b: Result includes creators:`, crossrefResult.creators ? JSON.stringify(crossrefResult.creators, null, 2) : 'none');
          return { result: crossrefResult, source: 'Crossref (Title+Year)' };
        } else {
          console.log(`[Bibliographic Service] Strategy 2b: Crossref title search returned no data`);
        }
      } catch (error) {
        console.warn(`[Bibliographic Service] Strategy 2b FAILED:`, error);
      }
    }

    // Try Crossref with title only
    try {
      console.log(`[Bibliographic Service] Strategy 2c: Trying Crossref title search (title only)`);
      const crossrefResult = await searchCrossrefByTitle(title);
      if (crossrefResult && Object.keys(crossrefResult).length > 0) {
        console.log(`[Bibliographic Service] Strategy 2c SUCCESS: Crossref title search returned data`);
        console.log(`[Bibliographic Service] Strategy 2c: Result includes creators:`, crossrefResult.creators ? JSON.stringify(crossrefResult.creators, null, 2) : 'none');
        return { result: crossrefResult, source: 'Crossref (Title Only)' };
      } else {
        console.log(`[Bibliographic Service] Strategy 2c: Crossref title search returned no data`);
      }
    } catch (error) {
      console.warn(`[Bibliographic Service] Strategy 2c FAILED:`, error);
    }

    // Strategy 3: Try OpenAlex with title + author
    if (authorSummary) {
      try {
        console.log(`[Bibliographic Service] Strategy 3a: Trying OpenAlex search (title + author)`);
        const openAlexResult = await searchOpenAlex(title, authorSummary, itemData.date);
        if (openAlexResult && Object.keys(openAlexResult).length > 0) {
          console.log(`[Bibliographic Service] Strategy 3a SUCCESS: OpenAlex returned data`);
          console.log(`[Bibliographic Service] Strategy 3a: Result includes creators:`, openAlexResult.creators ? JSON.stringify(openAlexResult.creators, null, 2) : 'none');
          return { result: openAlexResult, source: 'OpenAlex (Title+Author)' };
        } else {
          console.log(`[Bibliographic Service] Strategy 3a: OpenAlex returned no data`);
        }
      } catch (error) {
        console.warn(`[Bibliographic Service] Strategy 3a FAILED:`, error);
      }
    }

    // Strategy 4: Try OpenAlex with title + year
    if (itemData.date) {
      try {
        console.log(`[Bibliographic Service] Strategy 4a: Trying OpenAlex search (title + year)`);
        const openAlexResult = await searchOpenAlex(title, undefined, itemData.date);
        if (openAlexResult && Object.keys(openAlexResult).length > 0) {
          console.log(`[Bibliographic Service] Strategy 4a SUCCESS: OpenAlex returned data`);
          console.log(`[Bibliographic Service] Strategy 4a: Result includes creators:`, openAlexResult.creators ? JSON.stringify(openAlexResult.creators, null, 2) : 'none');
          return { result: openAlexResult, source: 'OpenAlex (Title+Year)' };
        } else {
          console.log(`[Bibliographic Service] Strategy 4a: OpenAlex returned no data`);
        }
      } catch (error) {
        console.warn(`[Bibliographic Service] Strategy 4a FAILED:`, error);
      }
    }

    // Strategy 5: Try OpenAlex with title only
    try {
      console.log(`[Bibliographic Service] Strategy 5: Trying OpenAlex search (title only)`);
      const openAlexResult = await searchOpenAlex(title);
      if (openAlexResult && Object.keys(openAlexResult).length > 0) {
        console.log(`[Bibliographic Service] Strategy 5 SUCCESS: OpenAlex returned data`);
        console.log(`[Bibliographic Service] Strategy 5: Result includes creators:`, openAlexResult.creators ? JSON.stringify(openAlexResult.creators, null, 2) : 'none');
        return { result: openAlexResult, source: 'OpenAlex (Title Only)' };
      } else {
        console.log(`[Bibliographic Service] Strategy 5: OpenAlex returned no data`);
      }
    } catch (error) {
      console.warn(`[Bibliographic Service] Strategy 5 FAILED:`, error);
    }
  } else {
    console.log(`[Bibliographic Service] Title too short (${title.length} chars), skipping title-based searches`);
  }

  // No results found from any API
  console.log(`[Bibliographic Service] ALL STRATEGIES FAILED: No metadata found from any API`);
  return null;
}

/**
 * Enhanced enrichment that combines API results with Gemini (as fallback)
 * Only uses Gemini when APIs fail, and validates Gemini output strictly
 */
export async function enrichItemMetadataHybrid(
  item: ZoteroItem,
  geminiApiKey?: string
): Promise<{ result: EnrichmentResult; source: string } | null> {
  console.log(`[Bibliographic Service] ========== STARTING HYBRID ENRICHMENT ==========`);
  console.log(`[Bibliographic Service] Item key: ${item.key}`);
  console.log(`[Bibliographic Service] Item title: "${item.data.title}"`);
  
  // First, try real APIs
  const apiResult = await enrichItemMetadataFromAPIs(item);
  if (apiResult) {
    console.log(`[Bibliographic Service] ========== HYBRID ENRICHMENT RESULT ==========`);
    console.log(`[Bibliographic Service] Source: ${apiResult.source}`);
    console.log(`[Bibliographic Service] Final result creators:`, apiResult.result.creators ? JSON.stringify(apiResult.result.creators, null, 2) : 'none');
    console.log(`[Bibliographic Service] Final result keys:`, Object.keys(apiResult.result));
    console.log(`[Bibliographic Service] ========== END HYBRID ENRICHMENT ==========`);
    return apiResult;
  }

  // If APIs fail and we have Gemini key, use it as fallback
  // BUT: NEVER use Gemini for authors - only for other metadata fields
  // Authors must come from verified sources (Crossref, OpenAlex) only
  if (geminiApiKey) {
    try {
      console.log(`[Bibliographic Service] GEMINI FALLBACK: APIs failed, trying Gemini as fallback`);
      const { enrichItemMetadata } = await import('./geminiService');
      const geminiResult = await enrichItemMetadata(item, geminiApiKey);
      
      console.log(`[Bibliographic Service] GEMINI FALLBACK: Gemini returned:`, JSON.stringify(geminiResult, null, 2));
      
      // CRITICAL: Remove authors from Gemini results - we don't trust AI-generated authors
      // Authors must come from verified bibliographic databases only
      if (geminiResult.creators) {
        console.warn(`[Bibliographic Service] GEMINI FALLBACK: REJECTING ${geminiResult.creators.length} author(s) from Gemini - only using verified database sources for authors`);
        console.warn(`[Bibliographic Service] GEMINI FALLBACK: Rejected authors were:`, JSON.stringify(geminiResult.creators, null, 2));
        delete geminiResult.creators;
      } else {
        console.log(`[Bibliographic Service] GEMINI FALLBACK: No authors in Gemini result (good - we don't want them)`);
      }
      
      // Validate other fields - reject if they look made up
      if (geminiResult && Object.keys(geminiResult).length > 0) {
        // Remove any fields that look suspicious
        Object.keys(geminiResult).forEach(key => {
          const value = (geminiResult as any)[key];
          if (typeof value === 'string') {
            const lowerVal = value.toLowerCase().trim();
            // Reject placeholder-like values
            if (lowerVal === 'unknown' || lowerVal === 'n/a' || lowerVal === 'none' || 
                lowerVal.includes('placeholder') || lowerVal.includes('example') ||
                /^test\s/.test(lowerVal)) {
              delete (geminiResult as any)[key];
            }
          }
        });

        // Only return if we have some valid non-author data after validation
        if (Object.keys(geminiResult).length > 0) {
          console.log(`[Bibliographic Service] ========== HYBRID ENRICHMENT RESULT ==========`);
          console.log(`[Bibliographic Service] Source: Gemini (Fallback - No Authors, Verify Other Fields)`);
          console.log(`[Bibliographic Service] Final result creators: NONE (rejected from Gemini)`);
          console.log(`[Bibliographic Service] Final result keys:`, Object.keys(geminiResult));
          console.log(`[Bibliographic Service] ========== END HYBRID ENRICHMENT ==========`);
          return { result: geminiResult, source: 'Gemini (Fallback - No Authors, Verify Other Fields)' };
        } else {
          console.log(`[Bibliographic Service] GEMINI FALLBACK: No valid data after validation`);
        }
      } else {
        console.log(`[Bibliographic Service] GEMINI FALLBACK: Gemini returned empty result`);
      }
    } catch (error) {
      // Log error but don't crash
      console.warn('[Bibliographic Service] GEMINI FALLBACK FAILED:', error instanceof Error ? error.message : String(error));
      console.warn('[Bibliographic Service] GEMINI FALLBACK: Error details:', error);
    }
  } else {
    console.log(`[Bibliographic Service] GEMINI FALLBACK: Skipped (no Gemini API key)`);
  }

  // No results from APIs or Gemini
  console.log(`[Bibliographic Service] ========== HYBRID ENRICHMENT RESULT ==========`);
  console.log(`[Bibliographic Service] FINAL RESULT: No metadata found from any source`);
  console.log(`[Bibliographic Service] ========== END HYBRID ENRICHMENT ==========`);
  return null;
}

/**
 * Find papers that cite a given paper
 * Uses Crossref and OpenAlex to find citing works
 */
export interface CitingPaper {
  title: string;
  authors: ZoteroCreator[];
  date?: string;
  DOI?: string;
  publicationTitle?: string;
  abstract?: string;
  url?: string;
  source: 'Crossref' | 'OpenAlex';
}

export async function findCitingPapers(
  item: ZoteroItem,
  maxResults: number = 10
): Promise<CitingPaper[]> {
  const results: CitingPaper[] = [];
  const doi = item.data.DOI;
  const title = item.data.title;

  if (!doi && !title) {
    console.warn('[Bibliographic Service] Cannot find citing papers: no DOI or title');
    return [];
  }

  // Try Crossref first (if we have a DOI)
  if (doi) {
    try {
      // Crossref uses reverse DOI lookup for citations
      const response = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Zotero-Cleanup-App/1.0 (mailto:support@example.com)'
          }
        }
      );

      if (response.ok) {
        const data: CrossrefResponse = await response.json();
        const work = data.message as CrossrefWork;
        
        // Crossref doesn't directly provide citing papers in the work endpoint
        // We need to use the references endpoint or search for works that reference this DOI
        // For now, we'll search OpenAlex which has better citation data
      }
    } catch (error) {
      console.warn('[Bibliographic Service] Crossref citation lookup failed:', error);
    }
  }

  // Try OpenAlex - it has better citation data
  try {
    let workId = '';
    
    // First, find the work in OpenAlex
    if (doi) {
      // OpenAlex uses DOI format: https://api.openalex.org/works/doi:10.1234/example
      const cleanDOI = doi.replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:/i, '');
      const workResponse = await fetch(
        `https://api.openalex.org/works/doi:${encodeURIComponent(cleanDOI)}`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (workResponse.ok) {
        const workData: OpenAlexWork = await workResponse.json();
        workId = workData.id || '';
      }
    } else if (title) {
      // Search by title and then get citations
      const titleQuery = encodeURIComponent(title.substring(0, 100));
      const searchResponse = await fetch(
        `https://api.openalex.org/works?search=${titleQuery}&per_page=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (searchResponse.ok) {
        const searchData: OpenAlexResponse = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          workId = searchData.results[0].id || '';
        }
      }
    }

    // Now get citing papers using the work ID
    if (workId) {
      // Extract the work ID from the full URL (format: https://openalex.org/W1234567890)
      const workIdShort = workId.replace(/^https?:\/\/openalex\.org\//i, '');
      const citedByUrl = `https://api.openalex.org/works?filter=cites:${workIdShort}&per_page=${maxResults}`;
      
      const response = await fetch(citedByUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data: OpenAlexResponse = await response.json();
        const citingWorks = data.results || [];

        for (const work of citingWorks.slice(0, maxResults)) {
          const citingPaper: CitingPaper = {
            title: work.title || 'Untitled',
            authors: [],
            source: 'OpenAlex'
          };

          // Extract authors
          if (work.authorships && work.authorships.length > 0) {
            citingPaper.authors = work.authorships.map(auth => {
              const nameParts = (auth.author.display_name || '').split(' ');
              return {
                creatorType: 'author',
                firstName: nameParts.slice(0, -1).join(' '),
                lastName: nameParts[nameParts.length - 1] || ''
              };
            });
          }

          // Extract date
          if (work.publication_date) {
            const year = work.publication_date.substring(0, 4);
            citingPaper.date = year;
          }

          // Extract DOI
          if (work.doi) {
            citingPaper.DOI = work.doi.replace(/^https?:\/\/doi\.org\//i, '');
          } else if (work.ids?.doi) {
            citingPaper.DOI = work.ids.doi.replace(/^https?:\/\/doi\.org\//i, '');
          }

          // Extract publication
          if (work.primary_location?.source?.display_name) {
            citingPaper.publicationTitle = work.primary_location.source.display_name;
          }

          // Extract URL
          if (work.primary_location?.landing_page_url) {
            citingPaper.url = work.primary_location.landing_page_url;
          }

          // Extract abstract (reconstruct from inverted index if available)
          if (work.abstract_inverted_index) {
            const positions: Array<{ word: string; pos: number }> = [];
            Object.entries(work.abstract_inverted_index).forEach(([word, posList]) => {
              posList.forEach(pos => positions.push({ word, pos }));
            });
            positions.sort((a, b) => a.pos - b.pos);
            citingPaper.abstract = positions.map(p => p.word).join(' ');
          }

          results.push(citingPaper);
        }
      }
    }
  } catch (error) {
    console.warn('[Bibliographic Service] OpenAlex citation lookup failed:', error);
  }

  return results;
}

