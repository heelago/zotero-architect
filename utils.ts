import { ZoteroItem, DuplicateGroup, ItemWithIssues, Issue, ZoteroItemData } from './types';
import { IMPORTANT_FIELDS_MAP, REQUIRED_CITATION_FIELDS, RECOMMENDED_CITATION_FIELDS } from './constants';

// Official Zotero field mappings for common types to prevent 400 errors
const VALID_ZOTERO_FIELDS: Record<string, string[]> = {
  book: ['title', 'creators', 'abstractNote', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'date', 'numPages', 'language', 'ISBN', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra'],
  journalArticle: ['title', 'creators', 'abstractNote', 'publicationTitle', 'volume', 'issue', 'pages', 'date', 'series', 'seriesTitle', 'seriesText', 'journalAbbreviation', 'language', 'DOI', 'ISSN', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra'],
  bookChapter: ['title', 'creators', 'abstractNote', 'bookTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'date', 'pages', 'language', 'ISBN', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra'],
  conferencePaper: ['title', 'creators', 'abstractNote', 'conferenceName', 'proceedingsTitle', 'volume', 'pages', 'place', 'publisher', 'date', 'language', 'DOI', 'ISBN', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra'],
  thesis: ['title', 'creators', 'abstractNote', 'thesisType', 'university', 'place', 'date', 'numPages', 'language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra'],
  webpage: ['title', 'creators', 'abstractNote', 'websiteTitle', 'websiteType', 'date', 'language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra'],
  report: ['title', 'creators', 'abstractNote', 'reportNumber', 'reportType', 'institution', 'place', 'date', 'pages', 'language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra']
};

export function filterValidFields(itemType: string, data: any): any {
  const validFields = VALID_ZOTERO_FIELDS[itemType] || IMPORTANT_FIELDS_MAP.default;
  const filtered: any = {};
  
  Object.keys(data).forEach(key => {
    if (validFields.includes(key)) {
      filtered[key] = data[key];
    }
  });
  
  return filtered;
}

function normalizeTitle(title: string): string {
  if (!title) return '';
  return title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function getCreatorString(item: ZoteroItem): string {
  if (!item.data.creators) return '';
  return item.data.creators
    .map(c => c.lastName || c.name || '')
    .filter(Boolean)
    .sort()
    .join(',')
    .toLowerCase();
}

export function findDuplicates(items: ZoteroItem[]): DuplicateGroup[] {
  const groups: Record<string, ZoteroItem[]> = {};
  
  items.forEach(item => {
    const data = item.data;
    if (data.itemType === 'attachment' || data.itemType === 'note') return;
    
    const titleNorm = normalizeTitle(data.title);
    const creators = getCreatorString(item);
    const doi = (data.DOI || '').toLowerCase().trim();
    const isbn = (data.ISBN || '').replace(/[-\s]/g, '');

    // DOI match (strongest signal)
    if (doi && doi.length > 5) {
      const key = `doi:${doi}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    } 
    // ISBN match
    else if (isbn && isbn.length > 8) {
      const key = `isbn:${isbn}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    } 
    // Title + creators match
    else if (titleNorm && titleNorm.length > 15) {
      const key = `title:${titleNorm.substring(0, 60)}|${creators}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
  });

  const finalDuplicates: DuplicateGroup[] = [];
  const seenGroupKeys = new Set<string>();

  Object.entries(groups).forEach(([reasonKey, group]) => {
    if (group.length > 1) {
      const groupKey = group.map(i => i.key).sort().join(',');
      if (!seenGroupKeys.has(groupKey)) {
        seenGroupKeys.add(groupKey);
        finalDuplicates.push({
          id: groupKey,
          reason: reasonKey.split(':')[0].toUpperCase(),
          items: group
        });
      }
    }
  });

  return finalDuplicates;
}

export function findIssues(items: ZoteroItem[]): ItemWithIssues[] {
  const result: ItemWithIssues[] = [];

  items.forEach(item => {
    const data = item.data;
    if (data.itemType === 'attachment' || data.itemType === 'note') return;
    
    const itemIssues: Issue[] = [];
    const fields = IMPORTANT_FIELDS_MAP[data.itemType] || IMPORTANT_FIELDS_MAP.default;

    fields.forEach(field => {
      if (field === 'creators') {
        if (!data.creators || data.creators.length === 0) {
          itemIssues.push({ field: 'Authors', severity: 'high', message: 'Missing authors' });
        } else {
          // Validate creator names for malformed entries
          const malformedCreators = data.creators.filter(c => {
            const lastName = (c.lastName || '').trim();
            const firstName = (c.firstName || '').trim();
            const fullName = (c.name || '').trim();
            
            // Combine all name parts to check for concatenated malformed data
            const combinedName = [lastName, firstName, fullName].filter(Boolean).join(' ');
            
            // Check each field individually and the combined string
            const fieldsToCheck = [lastName, firstName, fullName, combinedName].filter(Boolean);
            
            for (const nameToCheck of fieldsToCheck) {
              if (!nameToCheck) continue;
              
              // Patterns that indicate malformed data:
              // 1. Contains semicolons or colons (except at very end, which might be valid punctuation)
              const hasSemicolonOrColon = /[;:]/.test(nameToCheck.replace(/[;:]\s*$/, ''));
              
              // 2. Pattern like "last1, F; :Last2" - digit, comma, letter, semicolon, colon
              const hasConcatenatedPattern = /\d+\s*,\s*[A-Z]\s*;\s*:/.test(nameToCheck) ||
                                             /[a-zA-Z0-9]+\s*,\s*[A-Z]\s*;\s*:/.test(nameToCheck);
              
              // 3. Multiple consecutive separators
              const hasMultipleSeparators = /[;:]{2,}/.test(nameToCheck) ||
                                            /\s*[;:]\s*[;:]/.test(nameToCheck);
              
              // 4. Pattern with semicolon followed by colon (like "; :")
              const hasSemicolonColon = /;\s*:/.test(nameToCheck);
              
              // 5. Names that are mostly numbers/symbols (but allow single initials)
              const isMostlyNumbers = /^[\d\s,;:]+$/.test(nameToCheck) && nameToCheck.length > 2;
              
              // 6. Contains suspicious patterns like ":Last" (colon before name)
              const hasLeadingColon = /^\s*:/.test(nameToCheck);
              
              if (hasSemicolonOrColon || hasConcatenatedPattern || hasMultipleSeparators || 
                  hasSemicolonColon || isMostlyNumbers || hasLeadingColon) {
                return true;
              }
            }
            
            return false;
          });
          
          if (malformedCreators.length > 0) {
            itemIssues.push({ 
              field: 'Authors', 
              severity: 'high', 
              message: `Malformed author names detected (${malformedCreators.length} creator(s) need fixing)` 
            });
          }
          
          if (data.itemType === 'bookChapter') {
            // For book chapters, check if editors exist
            const hasEditors = data.creators.some(c => c.creatorType === 'editor');
            if (!hasEditors) {
              itemIssues.push({ field: 'Editors', severity: 'high', message: 'Missing editors (book editors)' });
            }
          }
        }
      } else {
        const value = data[field];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          const severity: 'high' | 'medium' | 'low' = 
            ['title', 'date'].includes(field) ? 'high' : 
            ['DOI', 'ISBN', 'abstractNote'].includes(field) ? 'medium' : 'low';
          itemIssues.push({ field, severity, message: `Missing ${field}` });
        }
      }
    });

    // Check for malformed date
    if (data.date && !/\d{4}/.test(data.date)) {
      itemIssues.push({ field: 'Date', severity: 'medium', message: 'Invalid year format' });
    }

    if (itemIssues.length > 0) {
      result.push({ item, issues: itemIssues });
    }
  });

  // Sort by severity (high issues first)
  return result.sort((a, b) => {
    const aHigh = a.issues.filter(i => i.severity === 'high').length;
    const bHigh = b.issues.filter(i => i.severity === 'high').length;
    return bHigh - aHigh;
  });
}

export interface MissingFieldsReport {
  required: string[];
  recommended: string[];
}

export function checkMissingCitationFields(item: ZoteroItem, enrichedData?: any): MissingFieldsReport {
  const itemType = item.data.itemType;
  const data = enrichedData ? { ...item.data, ...enrichedData } : item.data;
  
  const requiredFields = REQUIRED_CITATION_FIELDS[itemType] || REQUIRED_CITATION_FIELDS.default;
  const recommendedFields = RECOMMENDED_CITATION_FIELDS[itemType] || RECOMMENDED_CITATION_FIELDS.default;
  
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  
  requiredFields.forEach(field => {
    const value = data[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingRequired.push(field);
    }
  });
  
  // Special handling for journalArticle - check DOI/URL together
  let checkedDOIURL = false;
  if (itemType === 'journalArticle' && recommendedFields.includes('DOI') && recommendedFields.includes('url')) {
    const hasDOI = data.DOI && data.DOI.trim() !== '';
    const hasURL = data.url && data.url.trim() !== '';
    if (!hasDOI && !hasURL) {
      missingRecommended.push('DOI or URL');
    }
    checkedDOIURL = true;
  }
  
  recommendedFields.forEach(field => {
    // Skip DOI and URL for journalArticle since we already checked them together
    if (itemType === 'journalArticle' && checkedDOIURL && (field === 'DOI' || field === 'url')) {
      return;
    }
    
    const value = data[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingRecommended.push(field);
    }
  });
  
  return { required: missingRequired, recommended: missingRecommended };
}

// RDF Export Functions
export function generateRDFExport(
  items: ZoteroItem[],
  changes: Map<string, Partial<ZoteroItemData>>,
  exportAll: boolean = false
): string {
  // If exportAll, include all items with changes applied
  // If not exportAll, include only changed items
  
  const itemsToExport = exportAll 
    ? items.map(item => ({
        ...item,
        data: { ...item.data, ...(changes.get(item.key) || {}) }
      }))
    : items
        .filter(item => changes.has(item.key))
        .map(item => ({
          ...item,
          data: { ...item.data, ...changes.get(item.key)! }
        }));
  
  // Generate RDF/XML
  let rdf = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    xmlns:z="http://www.zotero.org/namespaces/export#"
    xmlns:dcterms="http://purl.org/dc/terms/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:bib="http://purl.org/net/biblio#"
    xmlns:foaf="http://xmlns.com/foaf/0.1/">
`;

  for (const item of itemsToExport) {
    rdf += generateItemRDF(item);
  }

  rdf += `</rdf:RDF>`;
  
  return rdf;
}

function generateItemRDF(item: ZoteroItem): string {
  const d = item.data;
  const type = mapZoteroTypeToRDF(d.itemType);
  
  let xml = `
    <${type} rdf:about="#${item.key}">
        <z:itemType>${d.itemType}</z:itemType>`;
  
  if (d.title) {
    xml += `
        <dc:title>${escapeXML(d.title)}</dc:title>`;
  }
  
  if (d.creators && d.creators.length > 0) {
    xml += `
        <bib:authors>
            <rdf:Seq>`;
    for (const creator of d.creators) {
      xml += `
                <rdf:li>
                    <foaf:Person>
                        <foaf:surname>${escapeXML(creator.lastName || '')}</foaf:surname>
                        <foaf:givenName>${escapeXML(creator.firstName || '')}</foaf:givenName>
                    </foaf:Person>
                </rdf:li>`;
    }
    xml += `
            </rdf:Seq>
        </bib:authors>`;
  }
  
  if (d.date) {
    xml += `
        <dc:date>${escapeXML(d.date)}</dc:date>`;
  }
  
  if (d.DOI) {
    xml += `
        <dc:identifier>DOI ${escapeXML(d.DOI)}</dc:identifier>`;
  }
  
  if (d.abstractNote) {
    xml += `
        <dcterms:abstract>${escapeXML(d.abstractNote)}</dcterms:abstract>`;
  }
  
  if (d.publicationTitle) {
    xml += `
        <dcterms:isPartOf>
            <bib:Journal>
                <dc:title>${escapeXML(d.publicationTitle)}</dc:title>`;
    if (d.volume) xml += `
                <bib:volume>${escapeXML(d.volume)}</bib:volume>`;
    if (d.issue) xml += `
                <bib:number>${escapeXML(d.issue)}</bib:number>`;
    xml += `
            </bib:Journal>
        </dcterms:isPartOf>`;
  }
  
  if (d.pages) {
    xml += `
        <bib:pages>${escapeXML(d.pages)}</bib:pages>`;
  }
  
  xml += `
    </${type}>
`;
  
  return xml;
}

function mapZoteroTypeToRDF(itemType: string): string {
  const mapping: Record<string, string> = {
    journalArticle: 'bib:Article',
    book: 'bib:Book',
    bookSection: 'bib:BookSection',
    report: 'bib:Report',
    thesis: 'bib:Thesis',
    document: 'bib:Document',
  };
  return mapping[itemType] || 'bib:Document';
}

function escapeXML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT FORMAT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type ExportFormat = 'rdf' | 'bibtex' | 'ris' | 'json' | 'csv';

/**
 * Generate BibTeX export
 */
export function generateBibTeXExport(
  items: ZoteroItem[],
  pendingChanges: Map<string, Partial<ZoteroItemData>>,
  exportAll: boolean = false
): string {
  const itemsToExport = exportAll 
    ? items.map(item => {
        const changes = pendingChanges.get(item.key);
        return changes ? { ...item, data: { ...item.data, ...changes } } : item;
      })
    : items.filter(item => pendingChanges.has(item.key)).map(item => {
        const changes = pendingChanges.get(item.key);
        return { ...item, data: { ...item.data, ...changes } };
      });

  let bibtex = '';
  
  for (const item of itemsToExport) {
    if (item.data.itemType === 'attachment' || item.data.itemType === 'note') continue;
    
    const d = item.data;
    const entryType = mapZoteroTypeToBibTeX(d.itemType);
    const citeKey = generateCiteKey(d);
    
    bibtex += `@${entryType}{${citeKey},\n`;
    
    // Title
    if (d.title) {
      bibtex += `  title = {${escapeBibTeX(d.title)}},\n`;
    }
    
    // Authors
    if (d.creators && d.creators.length > 0) {
      const authors = d.creators
        .filter(c => c.creatorType === 'author' || !c.creatorType)
        .map(c => {
          if (c.lastName && c.firstName) {
            return `${c.lastName}, ${c.firstName}`;
          } else if (c.lastName) {
            return c.lastName;
          } else if (c.name) {
            return c.name;
          }
          return '';
        })
        .filter(Boolean)
        .join(' and ');
      if (authors) {
        bibtex += `  author = {${escapeBibTeX(authors)}},\n`;
      }
    }
    
    // Year
    if (d.date) {
      const year = d.date.match(/\d{4}/)?.[0];
      if (year) {
        bibtex += `  year = {${year}},\n`;
      }
    }
    
    // Journal/Publication
    if (d.itemType === 'journalArticle' && d.publicationTitle) {
      bibtex += `  journal = {${escapeBibTeX(d.publicationTitle)}},\n`;
    } else if (d.itemType === 'book' && d.publisher) {
      bibtex += `  publisher = {${escapeBibTeX(d.publisher)}},\n`;
    } else if (d.itemType === 'bookChapter' && d.bookTitle) {
      bibtex += `  booktitle = {${escapeBibTeX(d.bookTitle)}},\n`;
    }
    
    // Volume, Issue, Pages
    if (d.volume) {
      bibtex += `  volume = {${escapeBibTeX(d.volume)}},\n`;
    }
    if (d.issue) {
      bibtex += `  number = {${escapeBibTeX(d.issue)}},\n`;
    }
    if (d.pages) {
      bibtex += `  pages = {${escapeBibTeX(d.pages)}},\n`;
    }
    
    // DOI
    if (d.DOI) {
      bibtex += `  doi = {${escapeBibTeX(d.DOI)}},\n`;
    }
    
    // ISBN
    if (d.ISBN) {
      bibtex += `  isbn = {${escapeBibTeX(d.ISBN)}},\n`;
    }
    
    // URL
    if (d.url) {
      bibtex += `  url = {${escapeBibTeX(d.url)}},\n`;
    }
    
    // Abstract
    if (d.abstractNote) {
      bibtex += `  abstract = {${escapeBibTeX(d.abstractNote)}},\n`;
    }
    
    bibtex = bibtex.slice(0, -2); // Remove trailing comma and newline
    bibtex += '\n}\n\n';
  }
  
  return bibtex;
}

function mapZoteroTypeToBibTeX(itemType: string): string {
  const mapping: Record<string, string> = {
    'journalArticle': 'article',
    'book': 'book',
    'bookSection': 'incollection',
    'conferencePaper': 'inproceedings',
    'thesis': 'phdthesis',
    'report': 'techreport',
    'webpage': 'misc',
    'document': 'misc'
  };
  return mapping[itemType] || 'misc';
}

function generateCiteKey(data: ZoteroItemData): string {
  const firstAuthor = data.creators?.[0];
  const lastName = firstAuthor?.lastName || firstAuthor?.name || 'unknown';
  const year = data.date?.match(/\d{4}/)?.[0] || 'nodate';
  const titleWord = (data.title || 'notitle').split(/\s+/)[0].toLowerCase().replace(/[^\w]/g, '');
  return `${lastName.toLowerCase()}${year}${titleWord}`.substring(0, 50);
}

function escapeBibTeX(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&/g, '\\&')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\~{}');
}

/**
 * Generate RIS export
 */
export function generateRISExport(
  items: ZoteroItem[],
  pendingChanges: Map<string, Partial<ZoteroItemData>>,
  exportAll: boolean = false
): string {
  const itemsToExport = exportAll 
    ? items.map(item => {
        const changes = pendingChanges.get(item.key);
        return changes ? { ...item, data: { ...item.data, ...changes } } : item;
      })
    : items.filter(item => pendingChanges.has(item.key)).map(item => {
        const changes = pendingChanges.get(item.key);
        return { ...item, data: { ...item.data, ...changes } };
      });

  let ris = '';
  
  for (const item of itemsToExport) {
    if (item.data.itemType === 'attachment' || item.data.itemType === 'note') continue;
    
    const d = item.data;
    const type = mapZoteroTypeToRIS(d.itemType);
    
    ris += `TY  - ${type}\n`;
    
    // Title
    if (d.title) {
      ris += `T1  - ${d.title}\n`;
    }
    
    // Authors
    if (d.creators && d.creators.length > 0) {
      d.creators.forEach(c => {
        if (c.lastName && c.firstName) {
          ris += `AU  - ${c.lastName}, ${c.firstName}\n`;
        } else if (c.lastName) {
          ris += `AU  - ${c.lastName}\n`;
        } else if (c.name) {
          ris += `AU  - ${c.name}\n`;
        }
      });
    }
    
    // Year
    if (d.date) {
      const year = d.date.match(/\d{4}/)?.[0];
      if (year) {
        ris += `PY  - ${year}\n`;
      }
    }
    
    // Journal/Publication
    if (d.itemType === 'journalArticle' && d.publicationTitle) {
      ris += `JO  - ${d.publicationTitle}\n`;
    } else if (d.itemType === 'book' && d.publisher) {
      ris += `PB  - ${d.publisher}\n`;
    } else if (d.itemType === 'bookChapter' && d.bookTitle) {
      ris += `T2  - ${d.bookTitle}\n`;
    }
    
    // Volume, Issue, Pages
    if (d.volume) {
      ris += `VL  - ${d.volume}\n`;
    }
    if (d.issue) {
      ris += `IS  - ${d.issue}\n`;
    }
    if (d.pages) {
      ris += `SP  - ${d.pages}\n`;
    }
    
    // DOI
    if (d.DOI) {
      ris += `DO  - ${d.DOI}\n`;
    }
    
    // ISBN
    if (d.ISBN) {
      ris += `SN  - ${d.ISBN}\n`;
    }
    
    // URL
    if (d.url) {
      ris += `UR  - ${d.url}\n`;
    }
    
    // Abstract
    if (d.abstractNote) {
      ris += `AB  - ${d.abstractNote}\n`;
    }
    
    // Tags
    if (d.tags && d.tags.length > 0) {
      d.tags.forEach(tag => {
        ris += `KW  - ${tag.tag}\n`;
      });
    }
    
    ris += `ER  - \n\n`;
  }
  
  return ris;
}

function mapZoteroTypeToRIS(itemType: string): string {
  const mapping: Record<string, string> = {
    'journalArticle': 'JOUR',
    'book': 'BOOK',
    'bookSection': 'CHAP',
    'conferencePaper': 'CONF',
    'thesis': 'THES',
    'report': 'RPRT',
    'webpage': 'WEB',
    'document': 'GEN'
  };
  return mapping[itemType] || 'GEN';
}

/**
 * Generate JSON export
 */
export function generateJSONExport(
  items: ZoteroItem[],
  pendingChanges: Map<string, Partial<ZoteroItemData>>,
  exportAll: boolean = false
): string {
  const itemsToExport = exportAll 
    ? items.map(item => {
        const changes = pendingChanges.get(item.key);
        return changes ? { ...item, data: { ...item.data, ...changes } } : item;
      })
    : items.filter(item => pendingChanges.has(item.key)).map(item => {
        const changes = pendingChanges.get(item.key);
        return { ...item, data: { ...item.data, ...changes } };
      });

  return JSON.stringify(itemsToExport, null, 2);
}

/**
 * Generate CSV export
 */
export function generateCSVExport(
  items: ZoteroItem[],
  pendingChanges: Map<string, Partial<ZoteroItemData>>,
  exportAll: boolean = false
): string {
  const itemsToExport = exportAll 
    ? items.map(item => {
        const changes = pendingChanges.get(item.key);
        return changes ? { ...item, data: { ...item.data, ...changes } } : item;
      })
    : items.filter(item => pendingChanges.has(item.key)).map(item => {
        const changes = pendingChanges.get(item.key);
        return { ...item, data: { ...item.data, ...changes } };
      });

  const headers = ['Title', 'Authors', 'Year', 'Type', 'Publication', 'DOI', 'ISBN', 'URL', 'Tags'];
  const rows: string[][] = [headers];
  
  for (const item of itemsToExport) {
    if (item.data.itemType === 'attachment' || item.data.itemType === 'note') continue;
    
    const d = item.data;
    const authors = (d.creators || [])
      .map(c => c.lastName || c.name || '')
      .filter(Boolean)
      .join('; ');
    const year = d.date?.match(/\d{4}/)?.[0] || '';
    const publication = d.publicationTitle || d.bookTitle || d.publisher || '';
    const tags = (d.tags || []).map(t => t.tag).join('; ');
    
    rows.push([
      escapeCSV(d.title || ''),
      escapeCSV(authors),
      escapeCSV(year),
      escapeCSV(d.itemType),
      escapeCSV(publication),
      escapeCSV(d.DOI || ''),
      escapeCSV(d.ISBN || ''),
      escapeCSV(d.url || ''),
      escapeCSV(tags)
    ]);
  }
  
  return rows.map(row => row.join(',')).join('\n');
}

function escapeCSV(str: string): string {
  if (!str) return '';
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Main export function that routes to the appropriate format
 */
export function generateExport(
  format: ExportFormat,
  items: ZoteroItem[],
  pendingChanges: Map<string, Partial<ZoteroItemData>>,
  exportAll: boolean = false
): string {
  switch (format) {
    case 'rdf':
      return generateRDFExport(items, pendingChanges, exportAll);
    case 'bibtex':
      return generateBibTeXExport(items, pendingChanges, exportAll);
    case 'ris':
      return generateRISExport(items, pendingChanges, exportAll);
    case 'json':
      return generateJSONExport(items, pendingChanges, exportAll);
    case 'csv':
      return generateCSVExport(items, pendingChanges, exportAll);
    default:
      return generateRDFExport(items, pendingChanges, exportAll);
  }
}

/**
 * Get file extension for export format
 */
export function getExportFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'rdf':
      return 'rdf';
    case 'bibtex':
      return 'bib';
    case 'ris':
      return 'ris';
    case 'json':
      return 'json';
    case 'csv':
      return 'csv';
    default:
      return 'rdf';
  }
}

/**
 * Get MIME type for export format
 */
export function getExportMimeType(format: ExportFormat): string {
  switch (format) {
    case 'rdf':
      return 'application/rdf+xml';
    case 'bibtex':
      return 'application/x-bibtex';
    case 'ris':
      return 'application/x-research-info-systems';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/rdf+xml';
  }
}
