import { ZoteroItem, ZoteroCreator } from './types';

/**
 * Citation Formatter
 * Formats Zotero items in APA, MLA, and Chicago styles
 * Based on official style guide rules
 */

export type CitationStyle = 'apa' | 'mla' | 'chicago';

interface FormattedCitation {
  formatted: string;
  editableFields: Record<string, string>;
}

/**
 * Format author names for citations
 */
function formatAuthorName(creator: ZoteroCreator, style: CitationStyle): string {
  if (creator.name) {
    // If full name provided, try to parse it
    const parts = creator.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(' ');
      if (style === 'apa' || style === 'chicago') {
        return `${lastName}, ${firstName.charAt(0)}.`;
      } else {
        return `${lastName}, ${firstName}`;
      }
    }
    return creator.name;
  }
  
  const firstName = creator.firstName || '';
  const lastName = creator.lastName || '';
  
  if (!lastName && !firstName) return '';
  if (!lastName) return firstName;
  
  switch (style) {
    case 'apa':
    case 'chicago':
      // APA/Chicago: Last, F.
      const firstInitial = firstName ? firstName.charAt(0).toUpperCase() + '.' : '';
      return firstInitial ? `${lastName}, ${firstInitial}` : lastName;
    case 'mla':
      // MLA: Last, First
      return firstName ? `${lastName}, ${firstName}` : lastName;
    default:
      return lastName;
  }
}

/**
 * Format author list for citations
 */
function formatAuthors(creators: ZoteroCreator[], style: CitationStyle): string {
  if (!creators || creators.length === 0) {
    return '';
  }
  
  const authors = creators
    .filter(c => c.creatorType === 'author')
    .map(c => formatAuthorName(c, style))
    .filter(Boolean);
  
  if (authors.length === 0) return '';
  
  if (authors.length === 1) {
    return authors[0];
  } else if (authors.length === 2) {
    return style === 'apa' 
      ? `${authors[0]} & ${authors[1]}`
      : `${authors[0]}, and ${authors[1]}`;
  } else if (authors.length <= 7) {
    const lastAuthor = authors[authors.length - 1];
    const otherAuthors = authors.slice(0, -1).join(', ');
    return style === 'apa'
      ? `${otherAuthors}, & ${lastAuthor}`
      : `${otherAuthors}, and ${lastAuthor}`;
  } else {
    // More than 7 authors - use et al.
    const firstAuthor = authors[0];
    return style === 'apa'
      ? `${firstAuthor}, et al.`
      : `${firstAuthor}, et al.`;
  }
}

/**
 * Extract year from date string
 */
function extractYear(date: string | undefined): string {
  if (!date) return '';
  const yearMatch = date.match(/\d{4}/);
  return yearMatch ? yearMatch[0] : '';
}

/**
 * Format APA citation
 */
function formatAPA(item: ZoteroItem): FormattedCitation {
  const data = item.data;
  const authors = formatAuthors(data.creators || [], 'apa');
  const year = extractYear(data.date);
  const title = data.title || '';
  
  let citation = '';
  
  if (data.itemType === 'journalArticle') {
    // APA Journal Article: Author, A. A. (Year). Title of article. Title of Periodical, Volume(Issue), pages. https://doi.org/xx.xxx/yyyy
    if (authors) {
      citation += `${authors} `;
    }
    if (year) {
      citation += `(${year}). `;
    }
    if (title) {
      citation += `${title}. `;
    }
    if (data.publicationTitle) {
      citation += `${data.publicationTitle}`;
    }
    if (data.volume) {
      citation += `, ${data.volume}`;
    }
    if (data.issue) {
      citation += `(${data.issue})`;
    }
    if (data.pages) {
      citation += `, ${data.pages}`;
    }
    if (data.DOI) {
      citation += `. https://doi.org/${data.DOI.replace(/^https?:\/\/dx\.doi\.org\//, '').replace(/^https?:\/\/doi\.org\//, '')}`;
    } else if (data.url) {
      citation += `. ${data.url}`;
    }
  } else if (data.itemType === 'book') {
    // APA Book: Author, A. A. (Year). Title of work. Publisher.
    if (authors) {
      citation += `${authors} `;
    }
    if (year) {
      citation += `(${year}). `;
    }
    if (title) {
      citation += `${title}. `;
    }
    if (data.publisher) {
      citation += data.publisher;
    }
  } else if (data.itemType === 'bookChapter') {
    // APA Book Chapter: Author, A. A. (Year). Title of chapter. In Editor, E. E. (Ed.), Title of book (pp. pages). Publisher.
    if (authors) {
      citation += `${authors} `;
    }
    if (year) {
      citation += `(${year}). `;
    }
    if (title) {
      citation += `${title}. `;
    }
    citation += 'In ';
    const editors = (data.creators || []).filter(c => c.creatorType === 'editor');
    if (editors.length > 0) {
      const editorNames = editors.map(e => formatAuthorName(e, 'apa')).join(', ');
      citation += `${editorNames} `;
      if (editors.length === 1) {
        citation += '(Ed.), ';
      } else {
        citation += '(Eds.), ';
      }
    }
    if (data.bookTitle) {
      citation += `${data.bookTitle} `;
    }
    if (data.pages) {
      citation += `(pp. ${data.pages}). `;
    }
    if (data.publisher) {
      citation += data.publisher;
    }
  } else {
    // Generic APA format
    if (authors) {
      citation += `${authors} `;
    }
    if (year) {
      citation += `(${year}). `;
    }
    if (title) {
      citation += `${title}. `;
    }
    if (data.publisher) {
      citation += data.publisher;
    }
  }
  
  citation = citation.trim();
  if (!citation.endsWith('.')) {
    citation += '.';
  }
  
  return {
    formatted: citation,
    editableFields: {
      authors: authors,
      year: year,
      title: title,
      publicationTitle: data.publicationTitle || '',
      volume: data.volume || '',
      issue: data.issue || '',
      pages: data.pages || '',
      DOI: data.DOI || '',
      publisher: data.publisher || '',
      bookTitle: (data as any).bookTitle || ''
    }
  };
}

/**
 * Format MLA citation
 */
function formatMLA(item: ZoteroItem): FormattedCitation {
  const data = item.data;
  const authors = formatAuthors(data.creators || [], 'mla');
  const year = extractYear(data.date);
  const title = data.title || '';
  
  let citation = '';
  
  if (data.itemType === 'journalArticle') {
    // MLA Journal Article: Author, First Name. "Title of Article." Title of Journal, vol. Volume, no. Issue, Year, pp. Pages, DOI.
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `"${title}." `;
    }
    if (data.publicationTitle) {
      citation += `${data.publicationTitle}, `;
    }
    if (data.volume) {
      citation += `vol. ${data.volume}`;
    }
    if (data.issue) {
      citation += `, no. ${data.issue}`;
    }
    if (year) {
      citation += `, ${year}`;
    }
    if (data.pages) {
      citation += `, pp. ${data.pages}`;
    }
    if (data.DOI) {
      const doi = data.DOI.replace(/^https?:\/\/dx\.doi\.org\//, '').replace(/^https?:\/\/doi\.org\//, '');
      citation += `, https://doi.org/${doi}`;
    } else if (data.url) {
      citation += `, ${data.url}`;
    }
  } else if (data.itemType === 'book') {
    // MLA Book: Author, First Name. Title of Book. Publisher, Year.
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `${title}. `;
    }
    if (data.publisher) {
      citation += `${data.publisher}`;
    }
    if (year) {
      citation += `, ${year}`;
    }
  } else if (data.itemType === 'bookChapter') {
    // MLA Book Chapter: Author, First Name. "Title of Chapter." Title of Book, edited by Editor Name, Publisher, Year, pp. Pages.
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `"${title}." `;
    }
    if (data.bookTitle) {
      citation += `${data.bookTitle}, `;
    }
    const editors = (data.creators || []).filter(c => c.creatorType === 'editor');
    if (editors.length > 0) {
      const editorNames = editors.map(e => formatAuthorName(e, 'mla')).join(', ');
      citation += `edited by ${editorNames}, `;
    }
    if (data.publisher) {
      citation += `${data.publisher}`;
    }
    if (year) {
      citation += `, ${year}`;
    }
    if (data.pages) {
      citation += `, pp. ${data.pages}`;
    }
  } else {
    // Generic MLA format
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `"${title}." `;
    }
    if (data.publisher) {
      citation += data.publisher;
    }
    if (year) {
      citation += `, ${year}`;
    }
  }
  
  citation = citation.trim();
  if (!citation.endsWith('.')) {
    citation += '.';
  }
  
  return {
    formatted: citation,
    editableFields: {
      authors: authors,
      year: year,
      title: title,
      publicationTitle: data.publicationTitle || '',
      volume: data.volume || '',
      issue: data.issue || '',
      pages: data.pages || '',
      DOI: data.DOI || '',
      publisher: data.publisher || '',
      bookTitle: (data as any).bookTitle || ''
    }
  };
}

/**
 * Format Chicago citation
 */
function formatChicago(item: ZoteroItem): FormattedCitation {
  const data = item.data;
  const authors = formatAuthors(data.creators || [], 'chicago');
  const year = extractYear(data.date);
  const title = data.title || '';
  
  let citation = '';
  
  if (data.itemType === 'journalArticle') {
    // Chicago Journal Article: Author, First Name. "Title of Article." Title of Journal Volume, no. Issue (Year): Pages. https://doi.org/xx.xxx/yyyy
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `"${title}." `;
    }
    if (data.publicationTitle) {
      citation += `${data.publicationTitle} `;
    }
    if (data.volume) {
      citation += `${data.volume}`;
    }
    if (data.issue) {
      citation += `, no. ${data.issue}`;
    }
    if (year) {
      citation += ` (${year})`;
    }
    if (data.pages) {
      citation += `: ${data.pages}`;
    }
    if (data.DOI) {
      const doi = data.DOI.replace(/^https?:\/\/dx\.doi\.org\//, '').replace(/^https?:\/\/doi\.org\//, '');
      citation += `. https://doi.org/${doi}`;
    } else if (data.url) {
      citation += `. ${data.url}`;
    }
  } else if (data.itemType === 'book') {
    // Chicago Book: Author, First Name. Title of Book. Place: Publisher, Year.
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `${title}. `;
    }
    const place = (data as any).place;
    if (place) {
      citation += `${place}: `;
    }
    if (data.publisher) {
      citation += `${data.publisher}`;
    }
    if (year) {
      citation += `, ${year}`;
    }
  } else if (data.itemType === 'bookChapter') {
    // Chicago Book Chapter: Author, First Name. "Title of Chapter." In Title of Book, edited by Editor Name, Pages. Place: Publisher, Year.
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `"${title}." `;
    }
    citation += 'In ';
    if (data.bookTitle) {
      citation += `${data.bookTitle}, `;
    }
    const editors = (data.creators || []).filter(c => c.creatorType === 'editor');
    if (editors.length > 0) {
      const editorNames = editors.map(e => formatAuthorName(e, 'chicago')).join(', ');
      citation += `edited by ${editorNames}, `;
    }
    if (data.pages) {
      citation += `${data.pages}. `;
    }
    const place = (data as any).place;
    if (place) {
      citation += `${place}: `;
    }
    if (data.publisher) {
      citation += `${data.publisher}`;
    }
    if (year) {
      citation += `, ${year}`;
    }
  } else {
    // Generic Chicago format
    if (authors) {
      citation += `${authors}. `;
    }
    if (title) {
      citation += `"${title}." `;
    }
    if (data.publisher) {
      citation += data.publisher;
    }
    if (year) {
      citation += `, ${year}`;
    }
  }
  
  citation = citation.trim();
  if (!citation.endsWith('.')) {
    citation += '.';
  }
  
  return {
    formatted: citation,
    editableFields: {
      authors: authors,
      year: year,
      title: title,
      publicationTitle: data.publicationTitle || '',
      volume: data.volume || '',
      issue: data.issue || '',
      pages: data.pages || '',
      DOI: data.DOI || '',
      publisher: data.publisher || '',
      bookTitle: (data as any).bookTitle || ''
    }
  };
}

/**
 * Format citation in specified style
 */
export function formatCitation(item: ZoteroItem, style: CitationStyle): FormattedCitation {
  switch (style) {
    case 'apa':
      return formatAPA(item);
    case 'mla':
      return formatMLA(item);
    case 'chicago':
      return formatChicago(item);
    default:
      return formatAPA(item);
  }
}

/**
 * Parse edited citation fields back to Zotero format
 */
export function parseCitationEdits(
  editedFields: Record<string, string>,
  originalItem: ZoteroItem
): Partial<ZoteroItem['data']> {
  const updates: Partial<ZoteroItem['data']> = {};
  
  // Map citation field names to Zotero field names
  if (editedFields.title && editedFields.title !== originalItem.data.title) {
    updates.title = editedFields.title;
  }
  
  if (editedFields.publicationTitle && editedFields.publicationTitle !== originalItem.data.publicationTitle) {
    updates.publicationTitle = editedFields.publicationTitle;
  }
  
  if (editedFields.volume && editedFields.volume !== originalItem.data.volume) {
    updates.volume = editedFields.volume;
  }
  
  if (editedFields.issue && editedFields.issue !== originalItem.data.issue) {
    updates.issue = editedFields.issue;
  }
  
  if (editedFields.pages && editedFields.pages !== originalItem.data.pages) {
    updates.pages = editedFields.pages;
  }
  
  if (editedFields.DOI && editedFields.DOI !== originalItem.data.DOI) {
    updates.DOI = editedFields.DOI;
  }
  
  if (editedFields.publisher && editedFields.publisher !== originalItem.data.publisher) {
    updates.publisher = editedFields.publisher;
  }
  
  if (editedFields.year && editedFields.year !== extractYear(originalItem.data.date)) {
    // Extract year from date string
    const yearMatch = editedFields.year.match(/\d{4}/);
    if (yearMatch) {
      updates.date = yearMatch[0];
    }
  }
  
  if (editedFields.bookTitle && editedFields.bookTitle !== (originalItem.data as any).bookTitle) {
    (updates as any).bookTitle = editedFields.bookTitle;
  }
  
  // Authors are more complex - would need parsing logic
  // For now, we'll skip author editing from citation format
  
  return updates;
}
