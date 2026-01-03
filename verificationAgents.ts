import { ZoteroItem, EnrichmentResult, ZoteroCreator, VerificationTask, VerificationReport } from './types';
import { callGemini } from './geminiService';

export type { VerificationReport };

/**
 * Agent 1: Publication Existence Checker
 * Verifies if the publication actually exists in academic databases
 */
export async function checkPublicationExistence(
  item: ZoteroItem,
  apiKey: string
): Promise<VerificationTask> {
  const task: VerificationTask = {
    id: 'publication-existence',
    name: 'Publication Existence Check',
    description: 'Verifying if this publication exists in academic databases',
    status: 'running'
  };

  try {
    const itemData = item.data;
    const prompt = `You are a scholarly database verification specialist. Check if this publication actually exists.

Title: ${itemData.title}
Authors: ${item.meta.creatorSummary || 'Unknown'}
Year: ${itemData.date || 'Unknown'}
DOI: ${itemData.DOI || 'Missing'}
ISBN: ${itemData.ISBN || 'Missing'}
Publication: ${itemData.publicationTitle || itemData.bookTitle || 'Missing'}

CRITICAL: Search Crossref, PubMed, Google Scholar, and other academic databases to verify this publication exists.

Respond with ONLY a JSON object:
{
  "exists": true/false,
  "confidence": "high"/"medium"/"low",
  "foundVia": "DOI"/"title_author"/"ISBN"/"not_found",
  "matchedTitle": "exact title if found",
  "matchedDOI": "DOI if found",
  "warnings": ["any warnings about the publication"],
  "reason": "brief explanation"
}

If the publication does NOT exist or cannot be verified, set exists to false and explain why.`;

    try {
      const result = await callGemini(apiKey, prompt, true);
      task.status = 'completed';
      task.result = result;
      return task;
    } catch (error: any) {
      // If JSON parsing failed, try to recover partial data from raw response
      if (error.rawText) {
        const recoveryTask = await recoverJSONData(error.rawText, 'publication-existence');
        if (recoveryTask.status === 'completed' && recoveryTask.result?.recovered) {
          task.status = 'completed';
          task.result = { ...recoveryTask.result, recoveryWarning: 'Partial data recovered from truncated JSON' };
          return task;
        }
      }
      task.status = 'failed';
      task.error = error.message || 'Unknown error';
      return task;
    }
  } catch (error: any) {
    task.status = 'failed';
    task.error = error.message || 'Unknown error';
    return task;
  }
}

/**
 * Agent 2: Author Validation Agent
 * Validates author names, detects placeholders, checks against publication
 */
export async function validateAuthors(
  item: ZoteroItem,
  apiKey: string
): Promise<VerificationTask> {
  const task: VerificationTask = {
    id: 'author-validation',
    name: 'Author Validation',
    description: 'Validating author names and checking for placeholders',
    status: 'running'
  };

  try {
    const itemData = item.data;
    const creators = itemData.creators || [];
    
    // Quick local check for obvious placeholders
    const hasPlaceholders = creators.some(c => {
      const name = [c.lastName, c.firstName, c.name].filter(Boolean).join(' ').toLowerCase();
      return name.includes('last1') || name.includes('last2') || /last\d+/i.test(name) ||
             name.includes('test') || name.includes('placeholder') || name.includes('example');
    });

    if (hasPlaceholders) {
      task.status = 'completed';
      task.result = {
        valid: false,
        hasPlaceholders: true,
        needsCorrection: true,
        message: 'Placeholder author names detected'
      };
      return task;
    }

    // If no obvious placeholders, verify against publication
    const prompt = `You are an author verification specialist. Validate the authors listed for this publication.

Title: ${itemData.title}
Current Authors: ${item.meta.creatorSummary || 'None listed'}
Year: ${itemData.date || 'Unknown'}
DOI: ${itemData.DOI || 'Missing'}
Publication: ${itemData.publicationTitle || itemData.bookTitle || 'Missing'}

CRITICAL TASKS:
1. Search for this publication in academic databases
2. Verify if the listed authors match the actual publication authors
3. Check if author names are properly formatted (not placeholders like "Last1, F.; Last2")
4. If authors don't match or are missing, provide the correct authors

Respond with ONLY a JSON object:
{
  "valid": true/false,
  "authorsMatch": true/false,
  "hasPlaceholders": true/false,
  "correctAuthors": [{"creatorType": "author", "firstName": "...", "lastName": "..."}],
  "confidence": "high"/"medium"/"low",
  "warnings": ["any warnings"],
  "recommendations": ["what should be done"]
}`;

    try {
      console.log(`[Verification Agents] validateAuthors: Calling Gemini for author validation`);
      const result = await callGemini(apiKey, prompt, true);
      console.log(`[Verification Agents] validateAuthors: Gemini returned:`, JSON.stringify(result, null, 2));
      if (result.correctAuthors) {
        console.log(`[Verification Agents] validateAuthors: Gemini suggests ${result.correctAuthors.length} author(s):`, JSON.stringify(result.correctAuthors, null, 2));
      }
      task.status = 'completed';
      task.result = result;
      return task;
    } catch (error: any) {
      // If JSON parsing failed, try to recover partial data from raw response
      if (error.rawText) {
        const recoveryTask = await recoverJSONData(error.rawText, 'publication-existence');
        if (recoveryTask.status === 'completed' && recoveryTask.result?.recovered) {
          task.status = 'completed';
          task.result = { ...recoveryTask.result, recoveryWarning: 'Partial data recovered from truncated JSON' };
          return task;
        }
      }
      task.status = 'failed';
      task.error = error.message || 'Unknown error';
      return task;
    }
  } catch (error: any) {
    task.status = 'failed';
    task.error = error.message || 'Unknown error';
    return task;
  }
}

/**
 * Agent 3: Data Quality Agent
 * Checks for malformed data, inconsistencies, and data quality issues
 */
export async function checkDataQuality(
  item: ZoteroItem,
  apiKey: string
): Promise<VerificationTask> {
  const task: VerificationTask = {
    id: 'data-quality',
    name: 'Data Quality Check',
    description: 'Checking for malformed data and inconsistencies',
    status: 'running'
  };

  try {
    const itemData = item.data;
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for malformed creators
    if (itemData.creators && itemData.creators.length > 0) {
      const malformed = itemData.creators.filter(c => {
        const hasName = c.lastName || c.firstName || c.name;
        if (!hasName) {
          issues.push('Creator missing name');
          return true;
        }
        // Check for placeholder patterns
        const nameStr = [c.lastName, c.firstName, c.name].filter(Boolean).join(' ').toLowerCase();
        if (/last\d+/i.test(nameStr) || nameStr.includes('test') || nameStr.includes('placeholder')) {
          issues.push(`Placeholder author detected: ${nameStr}`);
          return true;
        }
        return false;
      });
    }

    // Check for inconsistent dates
    if (itemData.date) {
      const yearMatch = itemData.date.match(/\d{4}/);
      if (!yearMatch) {
        warnings.push('Date format may be inconsistent');
      }
    }

    // Check for incomplete DOIs
    if (itemData.DOI && !itemData.DOI.startsWith('10.')) {
      warnings.push('DOI format may be incorrect');
    }

    task.status = 'completed';
    task.result = {
      quality: issues.length === 0 ? (warnings.length === 0 ? 'good' : 'needs_review') : 'poor',
      issues,
      warnings
    };
    
    return task;
  } catch (error: any) {
    task.status = 'failed';
    task.error = error.message || 'Unknown error';
    return task;
  }
}

/**
 * Agent 4: Comprehensive Metadata Enrichment
 * Enhanced version that provides detailed feedback
 */
export async function enrichMetadataComprehensive(
  item: ZoteroItem,
  apiKey: string
): Promise<VerificationTask> {
  const task: VerificationTask = {
    id: 'metadata-enrichment',
    name: 'Metadata Enrichment',
    description: 'Searching for missing metadata',
    status: 'running'
  };

  try {
    // Use the hybrid bibliographic service that tries real APIs first
    console.log(`[Verification Agents] enrichMetadataComprehensive: Starting for item ${item.key}`);
    const { enrichItemMetadataHybrid } = await import('./bibliographicService');
    const enrichmentResult = await enrichItemMetadataHybrid(item, apiKey);
    
    if (enrichmentResult) {
      console.log(`[Verification Agents] enrichMetadataComprehensive: Got enrichment result from source: ${enrichmentResult.source}`);
      console.log(`[Verification Agents] enrichMetadataComprehensive: Result includes creators:`, enrichmentResult.result.creators ? JSON.stringify(enrichmentResult.result.creators, null, 2) : 'none');
      console.log(`[Verification Agents] enrichMetadataComprehensive: Full result keys:`, Object.keys(enrichmentResult.result));
      
      task.status = 'completed';
      task.result = enrichmentResult.result;
      // Store source info in task metadata if available
      (task as any).source = enrichmentResult.source;
    } else {
      console.log(`[Verification Agents] enrichMetadataComprehensive: No enrichment result returned`);
      task.status = 'completed';
      task.result = {};
    }
    
    console.log(`[Verification Agents] enrichMetadataComprehensive: Final task result creators:`, task.result.creators ? JSON.stringify(task.result.creators, null, 2) : 'none');
    return task;
  } catch (error: any) {
    task.status = 'failed';
    task.error = error.message || 'Unknown error';
    return task;
  }
}

/**
 * Agent 5: JSON Recovery Agent
 * Extracts partial data from truncated or malformed JSON responses
 * This agent tries to salvage usable data even when JSON parsing fails
 */
export async function recoverJSONData(
  rawResponse: string,
  expectedStructure: 'author-validation' | 'publication-existence' | 'metadata-enrichment' | 'general'
): Promise<VerificationTask> {
  const task: VerificationTask = {
    id: 'json-recovery',
    name: 'JSON Data Recovery',
    description: 'Attempting to extract data from truncated JSON',
    status: 'running'
  };

  try {
    const recovered: any = {};
    
    // Try to extract creators/authors from truncated JSON
    if (expectedStructure === 'author-validation' || expectedStructure === 'general') {
      // Look for partial creator arrays
      const creatorArrayMatch = rawResponse.match(/"correctAuthors"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
      if (creatorArrayMatch) {
        const arrayContent = creatorArrayMatch[1];
        // Try to extract complete creator objects
        const creatorPattern = /\{\s*"creatorType"\s*:\s*"([^"]+)"\s*,\s*"firstName"\s*:\s*"([^"]+)"\s*,\s*"lastName"\s*:\s*"([^"]+)"\s*\}/g;
        const creators: any[] = [];
        let match;
        while ((match = creatorPattern.exec(arrayContent)) !== null) {
          creators.push({
            creatorType: match[1],
            firstName: match[2],
            lastName: match[3]
          });
        }
        
        // Also try to find incomplete creators (cut off mid-field)
        const incompletePattern = /\{\s*"creatorType"\s*:\s*"([^"]+)"\s*,\s*"firstName"\s*:\s*"([^"]+)"\s*,\s*"lastName"\s*:\s*"([^"]*)"/g;
        while ((match = incompletePattern.exec(arrayContent)) !== null) {
          // Only add if lastName exists (even if incomplete)
          if (match[3]) {
            creators.push({
              creatorType: match[1],
              firstName: match[2],
              lastName: match[3]
            });
          }
        }
        
        if (creators.length > 0) {
          recovered.correctAuthors = creators;
          recovered.partialRecovery = true;
        }
      }
    }
    
    // Try to extract other common fields
    const fieldPatterns = [
      { name: 'exists', pattern: /"exists"\s*:\s*(true|false)/ },
      { name: 'valid', pattern: /"valid"\s*:\s*(true|false)/ },
      { name: 'authorsMatch', pattern: /"authorsMatch"\s*:\s*(true|false)/ },
      { name: 'hasPlaceholders', pattern: /"hasPlaceholders"\s*:\s*(true|false)/ },
      { name: 'confidence', pattern: /"confidence"\s*:\s*"([^"]+)"/ },
      { name: 'DOI', pattern: /"DOI"\s*:\s*"([^"]+)"/ },
      { name: 'title', pattern: /"title"\s*:\s*"([^"]+)"/ },
    ];
    
    for (const { name, pattern } of fieldPatterns) {
      const match = rawResponse.match(pattern);
      if (match) {
        if (match[1] === 'true' || match[1] === 'false') {
          recovered[name] = match[1] === 'true';
        } else if (match[1]) {
          recovered[name] = match[1];
        }
      }
    }
    
    if (Object.keys(recovered).length > 0) {
      task.status = 'completed';
      task.result = { ...recovered, recovered: true };
    } else {
      task.status = 'failed';
      task.error = 'Could not recover any data from truncated JSON';
    }
    
    return task;
  } catch (error: any) {
    task.status = 'failed';
    task.error = error.message || 'Unknown error';
    return task;
  }
}

/**
 * Main Verification Orchestrator
 * Runs all agents and compiles a comprehensive report
 */
export async function runComprehensiveVerification(
  item: ZoteroItem,
  apiKey: string
): Promise<VerificationReport> {
  const tasks: VerificationTask[] = [];
  const findings = {
    publicationExists: false,
    authorsValid: false,
    dataQuality: 'good' as 'good' | 'needs_review' | 'poor',
    missingFields: [] as string[],
    warnings: [] as string[],
    errors: [] as string[]
  };
  const recommendations: string[] = [];

  // Run all agents in parallel for speed
  const [existenceTask, authorTask, qualityTask, enrichmentTask] = await Promise.all([
    checkPublicationExistence(item, apiKey),
    validateAuthors(item, apiKey),
    checkDataQuality(item, apiKey),
    enrichMetadataComprehensive(item, apiKey)
  ]);

  tasks.push(existenceTask, authorTask, qualityTask, enrichmentTask);

  // Process results
  if (existenceTask.status === 'completed' && existenceTask.result) {
    findings.publicationExists = existenceTask.result.exists === true;
    if (!findings.publicationExists) {
      findings.errors.push(`Publication not found: ${existenceTask.result.reason || 'Could not verify existence'}`);
      recommendations.push('Verify the title and authors are correct. This publication may not exist in academic databases.');
    } else if (existenceTask.result.warnings) {
      findings.warnings.push(...existenceTask.result.warnings);
    }
  }

  if (authorTask.status === 'completed' && authorTask.result) {
    findings.authorsValid = authorTask.result.valid === true && authorTask.result.authorsMatch === true;
    if (!findings.authorsValid) {
      if (authorTask.result.hasPlaceholders) {
        findings.errors.push('Placeholder author names detected');
        recommendations.push('Replace placeholder authors with actual author names.');
      } else if (!authorTask.result.authorsMatch) {
        findings.warnings.push('Authors may not match the publication');
        recommendations.push('Verify authors match the actual publication.');
      }
      if (authorTask.result.correctAuthors && authorTask.result.correctAuthors.length > 0) {
        recommendations.push('Correct authors have been identified and can be applied.');
      }
    }
  }

  if (qualityTask.status === 'completed' && qualityTask.result) {
    findings.dataQuality = qualityTask.result.quality;
    if (qualityTask.result.issues) {
      findings.errors.push(...qualityTask.result.issues);
    }
    if (qualityTask.result.warnings) {
      findings.warnings.push(...qualityTask.result.warnings);
    }
  }

  if (enrichmentTask.status === 'completed' && enrichmentTask.result) {
    // Check what fields are still missing
    const enrichedFields = Object.keys(enrichmentTask.result);
    // This would need to be enhanced with field requirements
  }

  // Determine overall status
  let overallStatus: 'success' | 'partial' | 'failed' | 'warning' = 'success';
  if (findings.errors.length > 0) {
    overallStatus = 'failed';
  } else if (findings.warnings.length > 0 || !findings.publicationExists || !findings.authorsValid) {
    overallStatus = 'warning';
  } else if (findings.dataQuality !== 'good') {
    overallStatus = 'partial';
  }

  return {
    itemKey: item.key,
    tasks,
    overallStatus,
    findings,
    recommendations
  };
}

