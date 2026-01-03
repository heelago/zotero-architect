import { ZoteroItem, ZoteroItemData } from './types';
import { callGemini } from './geminiService';
import { checkMissingCitationFields, generateExport, ExportFormat } from './utils';

// Expanded action types
export type ChatActionType = 
  // Navigation & Filtering
  | 'navigate' 
  | 'filter' 
  | 'search'
  // Information
  | 'statistics'
  | 'library_insights'
  | 'show'
  // Item Operations
  | 'verify'
  | 'tag'
  | 'reading_status'
  // Analysis
  | 'summarize'
  | 'compare'
  | 'author_analysis'
  | 'tag_analysis'
  // Discovery (future - stub for now)
  | 'find_similar'
  | 'find_citing'
  // Export
  | 'export'
  // Help
  | 'explain'
  | 'help'
  // Feature Request
  | 'feature_request';

export interface ChatAction {
  type: ChatActionType;
  params: Record<string, any>;
  reasoning?: string;
}

export interface ChatItem {
  key: string;
  title: string;
  authors?: string;
  year?: string;
  relevance?: string;
  missingFields?: string[];
  tags?: string[];
  readingStatus?: 'unread' | 'reading' | 'read';
}

export interface ChatResponse {
  action: ChatAction;
  message: string;
  confidence: 'high' | 'medium' | 'low';
  items?: ChatItem[];
  count?: number;
  summary?: string;
  followUp?: string[];
  data?: Record<string, any>; // For statistics, insights, etc.
}

// Helper functions
function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function countOccurrences(arr: string[]): Record<string, number> {
  return arr.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function extractYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0]) : null;
}

function selectDiverseSample(items: ZoteroItem[], count: number): ZoteroItem[] {
  // Get items from different types and time periods
  const byType = groupBy(items, i => i.data.itemType);
  const types = Object.keys(byType);
  const perType = Math.ceil(count / types.length);
  
  const sample: ZoteroItem[] = [];
  for (const type of types) {
    const typeItems = byType[type];
    // Sort by date, take recent ones
    const sorted = [...typeItems].sort((a, b) => 
      new Date(b.data.dateAdded || 0).getTime() - new Date(a.data.dateAdded || 0).getTime()
    );
    sample.push(...sorted.slice(0, perType));
    if (sample.length >= count) break;
  }
  return sample.slice(0, count);
}

// Simple string similarity (Dice coefficient)
function calculateSimilarity(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  
  const bigrams1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }
  
  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    if (bigrams1.has(s2.substring(i, i + 2))) {
      intersection++;
    }
  }
  
  return (2 * intersection) / (s1.length + s2.length - 2);
}

export function generateLibraryInsights(items: ZoteroItem[]): {
  overview: {
    total: number;
    completenessScore: number;
    recentlyAdded: number;
  };
  metadata: {
    withDOI: number;
    withAbstract: number;
    incomplete: number;
    untagged: number;
  };
  temporal: {
    yearRange: string;
    peakYears: { year: string; count: number }[];
    oldestYear: number | null;
    newestYear: number | null;
  };
  authors: {
    total: number;
    top: { name: string; count: number }[];
    potentialDuplicates: { name1: string; name2: string; similarity: number }[];
  };
  tags: {
    total: number;
    top: { tag: string; count: number }[];
    singleUse: number;
    avgPerItem: number;
  };
  types: {
    distribution: { type: string; count: number }[];
  };
  recommendations: string[];
} {
  const total = items.length;
  
  // Metadata completeness
  const withDOI = items.filter(i => i.data.DOI).length;
  const withAbstract = items.filter(i => i.data.abstractNote).length;
  const untagged = items.filter(i => !i.data.tags?.length).length;
  const incomplete = items.filter(i => {
    const missing = checkMissingCitationFields(i);
    return missing.required.length > 0;
  }).length;
  const completenessScore = total > 0 ? Math.round(((total - incomplete) / total) * 100) : 0;
  
  // Recent additions
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentlyAdded = items.filter(i => 
    new Date(i.data.dateAdded || 0).getTime() > thirtyDaysAgo
  ).length;
  
  // Year analysis
  const years = items
    .map(i => extractYear(i.data.date))
    .filter((y): y is number => y !== null);
  const yearCounts = countOccurrences(years.map(String));
  const peakYears = Object.entries(yearCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([year, count]) => ({ year, count }));
  
  // Author analysis
  const authorList = items.flatMap(i => 
    i.data.creators?.filter(c => c.creatorType === 'author')
      .map(c => c.lastName || c.name || '') || []
  ).filter(Boolean);
  const authorCounts = countOccurrences(authorList);
  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
  
  // Find potential author duplicates (simple similarity check)
  const authorNames = Object.keys(authorCounts);
  const potentialDuplicates: { name1: string; name2: string; similarity: number }[] = [];
  for (let i = 0; i < authorNames.length; i++) {
    for (let j = i + 1; j < authorNames.length; j++) {
      const similarity = calculateSimilarity(authorNames[i], authorNames[j]);
      if (similarity > 0.7 && similarity < 1) {
        potentialDuplicates.push({
          name1: authorNames[i],
          name2: authorNames[j],
          similarity
        });
      }
    }
    if (potentialDuplicates.length >= 5) break; // Limit for performance
  }
  
  // Tag analysis
  const allTags = items.flatMap(i => i.data.tags?.map(t => t.tag) || []);
  const tagCounts = countOccurrences(allTags);
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  const singleUseTags = Object.values(tagCounts).filter(c => c === 1).length;
  const avgTagsPerItem = total > 0 ? allTags.length / total : 0;
  
  // Type distribution
  const typeGroups = groupBy(items, i => i.data.itemType);
  const typeDistribution = Object.entries(typeGroups)
    .map(([type, items]) => ({ type, count: items.length }))
    .sort((a, b) => b.count - a.count);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (total > 0 && incomplete > total * 0.1) {
    recommendations.push(`${incomplete} items have incomplete metadata - consider using "Verify" to find missing DOIs and abstracts`);
  }
  if (total > 0 && untagged > total * 0.2) {
    recommendations.push(`${untagged} items have no tags - consider using "Suggest Tags" to organize them`);
  }
  if (Object.keys(tagCounts).length > 0 && singleUseTags > Object.keys(tagCounts).length * 0.3) {
    recommendations.push(`${singleUseTags} tags are used only once - consider consolidating similar tags`);
  }
  if (potentialDuplicates.length > 0) {
    recommendations.push(`Found ${potentialDuplicates.length} potential author name variants that might need merging`);
  }
  if (total > 0 && withDOI < total * 0.5) {
    recommendations.push(`Only ${Math.round(withDOI/total*100)}% of items have DOIs - DOIs help with citation tracking and discovery`);
  }
  
  return {
    overview: { total, completenessScore, recentlyAdded },
    metadata: { withDOI, withAbstract, incomplete, untagged },
    temporal: {
      yearRange: years.length > 0 ? `${Math.min(...years)}-${Math.max(...years)}` : 'unknown',
      peakYears,
      oldestYear: years.length > 0 ? Math.min(...years) : null,
      newestYear: years.length > 0 ? Math.max(...years) : null,
    },
    authors: {
      total: authorNames.length,
      top: topAuthors,
      potentialDuplicates,
    },
    tags: {
      total: Object.keys(tagCounts).length,
      top: topTags,
      singleUse: singleUseTags,
      avgPerItem: Math.round(avgTagsPerItem * 10) / 10,
    },
    types: { distribution: typeDistribution },
    recommendations,
  };
}

export function formatInsightsMessage(insights: ReturnType<typeof generateLibraryInsights>): string {
  const { overview, metadata, temporal, authors, tags, types, recommendations } = insights;
  
  let message = `**Your Library at a Glance**\n\n`;
  
  message += `📚 **${overview.total} items** | `;
  message += `${overview.completenessScore}% complete | `;
  message += `${overview.recentlyAdded} added recently\n\n`;
  
  message += `**Metadata Health:**\n`;
  const doiPercentage = overview.total > 0 ? Math.round(metadata.withDOI/overview.total*100) : 0;
  message += `• ${metadata.withDOI} have DOIs (${doiPercentage}%)\n`;
  message += `• ${metadata.withAbstract} have abstracts\n`;
  message += `• ${metadata.incomplete} need attention\n\n`;
  
  message += `**Publication Years:** ${temporal.yearRange}\n`;
  if (temporal.peakYears.length > 0) {
    message += `Peak: ${temporal.peakYears.slice(0, 3).map(y => y.year).join(', ')}\n\n`;
  }
  
  message += `**Top Authors:** ${authors.top.slice(0, 5).map(a => a.name).join(', ')}\n\n`;
  
  message += `**Tags:** ${tags.total} unique (avg ${tags.avgPerItem}/item)`;
  if (tags.singleUse > 0) {
    message += `, ${tags.singleUse} used only once`;
  }
  message += `\n\n`;
  
  if (recommendations.length > 0) {
    message += `**Suggestions:**\n`;
    recommendations.forEach(rec => {
      message += `• ${rec}\n`;
    });
  }
  
  return message;
}

export function analyzeAuthors(items: ZoteroItem[]): {
  totalAuthors: number;
  topAuthors: { name: string; count: number; items: string[] }[];
  potentialVariants: { names: string[]; itemKeys: string[] }[];
  singleAuthorItems: number;
  avgAuthorsPerItem: number;
} {
  // Build author -> items map
  const authorItems: Record<string, string[]> = {};
  let totalAuthorships = 0;
  let singleAuthorItems = 0;
  
  for (const item of items) {
    const authors = item.data.creators?.filter(c => c.creatorType === 'author') || [];
    if (authors.length === 1) singleAuthorItems++;
    
    for (const author of authors) {
      const name = author.lastName || author.name || '';
      if (!name) continue;
      
      if (!authorItems[name]) authorItems[name] = [];
      authorItems[name].push(item.key);
      totalAuthorships++;
    }
  }
  
  const authorNames = Object.keys(authorItems);
  
  // Top authors
  const topAuthors = Object.entries(authorItems)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15)
    .map(([name, keys]) => ({ name, count: keys.length, items: keys }));
  
  // Find potential variants
  const variants: { names: string[]; itemKeys: string[] }[] = [];
  const checked = new Set<string>();
  
  for (const name1 of authorNames) {
    if (checked.has(name1)) continue;
    
    const similarNames = [name1];
    const relatedKeys = new Set(authorItems[name1]);
    
    for (const name2 of authorNames) {
      if (name1 === name2 || checked.has(name2)) continue;
      
      const similarity = calculateSimilarity(name1, name2);
      if (similarity > 0.6 && similarity < 1) {
        similarNames.push(name2);
        authorItems[name2].forEach(k => relatedKeys.add(k));
        checked.add(name2);
      }
    }
    
    if (similarNames.length > 1) {
      variants.push({
        names: similarNames,
        itemKeys: Array.from(relatedKeys)
      });
    }
    checked.add(name1);
  }
  
  return {
    totalAuthors: authorNames.length,
    topAuthors,
    potentialVariants: variants.slice(0, 10),
    singleAuthorItems,
    avgAuthorsPerItem: Math.round((totalAuthorships / items.length) * 10) / 10,
  };
}

export function formatAuthorAnalysisMessage(analysis: ReturnType<typeof analyzeAuthors>): string {
  let message = `**Author Analysis**\n\n`;
  
  message += `📊 **${analysis.totalAuthors} unique authors** across your library\n`;
  message += `Average ${analysis.avgAuthorsPerItem} authors per item\n\n`;
  
  message += `**Most Frequent Authors:**\n`;
  analysis.topAuthors.slice(0, 10).forEach((a, i) => {
    message += `${i + 1}. ${a.name} (${a.count} items)\n`;
  });
  
  if (analysis.potentialVariants.length > 0) {
    message += `\n**Potential Name Variants:**\n`;
    message += `These might be the same person:\n`;
    analysis.potentialVariants.slice(0, 5).forEach(v => {
      message += `• ${v.names.join(' / ')} (${v.itemKeys.length} items)\n`;
    });
  }
  
  return message;
}

export function analyzeTags(items: ZoteroItem[]): {
  totalTags: number;
  topTags: { tag: string; count: number }[];
  singleUseTags: string[];
  potentialDuplicates: { tags: string[]; similarity: number }[];
  suggestedHierarchy: { parent: string; children: string[] }[];
  untaggedCount: number;
  avgTagsPerItem: number;
} {
  const allTags = items.flatMap(i => i.data.tags?.map(t => t.tag) || []);
  const tagCounts = countOccurrences(allTags);
  const tagNames = Object.keys(tagCounts);
  
  // Top tags
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));
  
  // Single-use tags
  const singleUseTags = Object.entries(tagCounts)
    .filter(([_, count]) => count === 1)
    .map(([tag]) => tag);
  
  // Find similar tags
  const potentialDuplicates: { tags: string[]; similarity: number }[] = [];
  const checked = new Set<string>();
  
  for (const tag1 of tagNames) {
    if (checked.has(tag1)) continue;
    
    const similar: string[] = [tag1];
    for (const tag2 of tagNames) {
      if (tag1 === tag2 || checked.has(tag2)) continue;
      
      const similarity = calculateSimilarity(
        tag1.toLowerCase().replace(/[-_]/g, ' '),
        tag2.toLowerCase().replace(/[-_]/g, ' ')
      );
      
      if (similarity > 0.7 && similarity < 1) {
        similar.push(tag2);
        checked.add(tag2);
      }
    }
    
    if (similar.length > 1) {
      potentialDuplicates.push({
        tags: similar,
        similarity: 0.8 // Approximate
      });
    }
    checked.add(tag1);
  }
  
  // Suggest hierarchy based on common prefixes/suffixes
  const suggestedHierarchy: { parent: string; children: string[] }[] = [];
  const words = tagNames.flatMap(t => t.toLowerCase().split(/[\s\-_]+/));
  const wordCounts = countOccurrences(words);
  
  const commonWords = Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3 && word.length > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
  
  for (const word of commonWords) {
    const children = tagNames.filter(t => 
      t.toLowerCase().includes(word) && t.toLowerCase() !== word
    );
    if (children.length >= 2) {
      suggestedHierarchy.push({ parent: word, children: children.slice(0, 5) });
    }
  }
  
  const untaggedCount = items.filter(i => !i.data.tags?.length).length;
  
  return {
    totalTags: tagNames.length,
    topTags,
    singleUseTags: singleUseTags.slice(0, 20),
    potentialDuplicates: potentialDuplicates.slice(0, 10),
    suggestedHierarchy,
    untaggedCount,
    avgTagsPerItem: items.length > 0 ? Math.round((allTags.length / items.length) * 10) / 10 : 0,
  };
}

export function formatTagAnalysisMessage(analysis: ReturnType<typeof analyzeTags>): string {
  let message = `**Tag Analysis**\n\n`;
  
  message += `🏷️ **${analysis.totalTags} unique tags** | `;
  message += `avg ${analysis.avgTagsPerItem}/item | `;
  message += `${analysis.untaggedCount} untagged items\n\n`;
  
  message += `**Most Used:**\n`;
  analysis.topTags.slice(0, 8).forEach(t => {
    message += `• ${t.tag} (${t.count})\n`;
  });
  
  if (analysis.singleUseTags.length > 0) {
    message += `\n**${analysis.singleUseTags.length} tags used only once** `;
    message += `(e.g., ${analysis.singleUseTags.slice(0, 3).join(', ')}...)\n`;
  }
  
  if (analysis.potentialDuplicates.length > 0) {
    message += `\n**Potential duplicates to merge:**\n`;
    analysis.potentialDuplicates.slice(0, 3).forEach(d => {
      message += `• ${d.tags.join(' ↔ ')}\n`;
    });
  }
  
  if (analysis.suggestedHierarchy.length > 0) {
    message += `\n**Suggested groupings:**\n`;
    analysis.suggestedHierarchy.slice(0, 2).forEach(h => {
      message += `• "${h.parent}": ${h.children.slice(0, 3).join(', ')}\n`;
    });
  }
  
  return message;
}

export function buildLibraryContext(items: ZoteroItem[]): string {
  // Basic counts
  const total = items.length;
  const withDOI = items.filter(i => i.data.DOI).length;
  const withAbstract = items.filter(i => i.data.abstractNote).length;
  const untagged = items.filter(i => !i.data.tags?.length).length;
  
  // Item types
  const typeGroups = groupBy(items, i => i.data.itemType);
  const typeStats = Object.entries(typeGroups)
    .map(([type, items]) => `${type}: ${items.length}`)
    .slice(0, 10)
    .join(', ');
  
  // Tags analysis
  const allTags = items.flatMap(i => i.data.tags?.map(t => t.tag) || []);
  const tagCounts = countOccurrences(allTags);
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag, count]) => `${tag} (${count})`)
    .join(', ');
  const singleUseTags = Object.values(tagCounts).filter(c => c === 1).length;
  
  // Author analysis
  const allAuthors = items.flatMap(i => 
    i.data.creators?.map(c => c.lastName || c.name || '') || []
  ).filter(Boolean);
  const authorCounts = countOccurrences(allAuthors);
  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([author, count]) => `${author} (${count})`)
    .join(', ');
  
  // Year distribution
  const years = items
    .map(i => extractYear(i.data.date))
    .filter(Boolean) as number[];
  const yearCounts = countOccurrences(years.map(String));
  const yearRange = years.length > 0 
    ? `${Math.min(...years)}-${Math.max(...years)}`
    : 'unknown';
  const recentYears = Object.entries(yearCounts)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 10)
    .map(([year, count]) => `${year}: ${count}`)
    .join(', ');
  
  // Completeness analysis
  const incomplete = items.filter(i => {
    const missing = checkMissingCitationFields(i);
    return missing.required?.length > 0 || missing.recommended?.length > 0;
  }).length;
  const completenessScore = Math.round(((total - incomplete) / total) * 100);
  
  // Recent additions
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentlyAdded = items.filter(i => 
    new Date(i.data.dateAdded || 0).getTime() > thirtyDaysAgo
  ).length;
  
  // Reading status (if using tag-based tracking)
  const readItems = items.filter(i => 
    i.data.tags?.some(t => t.tag === '_status:read')
  ).length;
  const unreadItems = items.filter(i => 
    !i.data.tags?.some(t => t.tag.startsWith('_status:'))
  ).length;
  
  // Sample items for context (diverse selection)
  const sampleItems = selectDiverseSample(items, 15);
  const sampleText = sampleItems.map(i => {
    const authors = i.data.creators?.map(c => c.lastName || c.name).join(', ') || 'Unknown';
    const year = extractYear(i.data.date) || 'n.d.';
    const tags = i.data.tags?.map(t => t.tag).join(', ') || 'none';
    return `- "${i.data.title}" by ${authors} (${year}) [tags: ${tags}]`;
  }).join('\n');

  return `
LIBRARY OVERVIEW:
- Total items: ${total}
- With DOI: ${withDOI} (${total > 0 ? Math.round(withDOI/total*100) : 0}%)
- With abstract: ${withAbstract} (${total > 0 ? Math.round(withAbstract/total*100) : 0}%)
- Untagged: ${untagged}
- Incomplete metadata: ${incomplete}
- Metadata completeness score: ${completenessScore}%
- Recently added (30 days): ${recentlyAdded}

READING STATUS:
- Read: ${readItems}
- Unread/Untracked: ${unreadItems}

ITEM TYPES:
${typeStats}

PUBLICATION YEARS: ${yearRange}
Recent distribution: ${recentYears}

TOP TAGS (${Object.keys(tagCounts).length} total, ${singleUseTags} used only once):
${topTags || 'No tags'}

TOP AUTHORS:
${topAuthors || 'No authors'}

SAMPLE ITEMS:
${sampleText}
`.trim();
}

/**
 * Build conversation context from recent chat history
 */
export function buildConversationContext(
  history: Array<{ role: 'user' | 'assistant'; content: string; action?: string; results?: any }>,
  maxTurns: number = 5
): string {
  const recentHistory = history.slice(-maxTurns);
  
  return recentHistory.map(turn => {
    if (turn.role === 'user') {
      return `User: ${turn.content}`;
    } else {
      let context = `Assistant: ${turn.content}`;
      if (turn.results?.items?.length) {
        context += ` [Showed ${turn.results.items.length} items]`;
      }
      if (turn.action) {
        context += ` [Action: ${turn.action}]`;
      }
      return context;
    }
  }).join('\n');
}

/**
 * Parse a user query and determine what action to take, with actual library data
 */
export async function parseChatQuery(
  query: string,
  items: ZoteroItem[],
  apiKey: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; action?: string; results?: any }>
): Promise<ChatResponse> {
  // Build detailed item data for context
  const itemsData = items.map(item => ({
    key: item.key,
    title: item.data.title || 'Untitled',
    authors: item.data.creators?.map(c => c.lastName || c.name).filter(Boolean).join(', ') || 'Unknown',
    year: item.data.date?.match(/\d{4}/)?.[0] || '',
    tags: item.data.tags?.map(t => t.tag) || [],
    doi: item.data.DOI || null,
    abstract: item.data.abstractNote || null,
    publication: item.data.publicationTitle || item.data.bookTitle || null,
    missingFields: checkMissingCitationFields(item).required.concat(checkMissingCitationFields(item).recommended)
  }));

  // Build enhanced library context
  const libraryContextString = buildLibraryContext(items);
  
  // Build conversation context if history is provided
  const conversationContextStr = conversationHistory && conversationHistory.length > 0
    ? `\n\nRECENT CONVERSATION:\n${buildConversationContext(conversationHistory)}\n`
    : '';

  const APP_CAPABILITIES_GUIDE = `APP CAPABILITIES GUIDE - How to use this app for common tasks:

ADDING DOIs AND METADATA:
- To add DOIs/metadata: Go to Library tab → Filter by "Incomplete metadata" or search for items → Click item to expand → Click "Verify" button → Review suggested metadata → Click "Apply" on fields or "Accept All"
- Batch processing: Select multiple items → Click "Verify Selected" in batch actions bar
- The app uses real bibliographic APIs (Crossref, OpenAlex) to find missing metadata

FINDING ITEMS:
- Use search bar in Library tab (searches titles, authors, abstracts, DOIs, tags)
- Use filter dropdown: All items, Incomplete metadata, Untagged items, Duplicates, Recent, By tag
- Chat can find items: Ask "Show me items about [topic]" or "Which items are missing DOIs?"

FIXING MISSING METADATA:
- Filter by "Incomplete metadata" → Expand item card → Click "Verify" to search automatically → Review suggestions → Click "Apply" on fields

TAGGING ITEMS:
- Expand item card → Click "Suggest Tags" → Review AI suggestions → Click "Apply Tags"
- Batch: Select items → Click "Tag Selected" in batch actions bar

DUPLICATES:
- Filter by "Duplicates" → Click duplicate group → Compare items side-by-side → Select master → Click "Continue to Merge" → Review merged data → Click "Merge & Delete Duplicates"

ANALYZING LIBRARY:
- Ask chat: "Show me library statistics", "Analyze my authors", "Analyze my tags"

EXPORTING:
- Settings tab → "View Change Log" → Copy to clipboard or export
- IMPORTANT: Export change log before disconnecting

WHAT THE APP CANNOT DO:
- Create new items (use Zotero directly)
- Delete items individually (only through duplicate merging)
- Edit items through chat (use the UI)
- Manage attachments/PDFs
- Sync with Zotero in real-time (refresh library)
- Manage collections
- Export to citation formats (BibTeX, etc.)

IMPORTANT: When users ask "how to" questions, provide step-by-step instructions based on the app's actual interface and workflow, not general Zotero advice. Reference specific buttons, tabs, and UI elements.`;

  const CHAT_SYSTEM_PROMPT = `You are an intelligent research assistant helping a user manage their Zotero bibliographic library using the Zotero Architect app. You have deep knowledge of how to use this specific app's features and interface.

${APP_CAPABILITIES_GUIDE}

CRITICAL INSTRUCTIONS:
- When users ask "how to add DOIs", "how can I add DOIs", "can you help me add DOIs", "please help me add metadata", or similar variations, provide step-by-step instructions using the app's interface (Library tab → Filter → Expand item → Click Verify → Apply suggestions)
- Understand that these phrasings are equivalent: "how to" = "how can I" = "can you" = "help me" = "please help" = "I need to" = "show me how to"
- When users ask "how to" questions (in any phrasing), give app-specific instructions, not general Zotero advice
- Reference specific UI elements: buttons ("Verify", "Apply", "Suggest Tags"), tabs ("Library", "Settings"), filters, etc.
- If a user asks for something the app CANNOT do (see "WHAT THE APP CANNOT DO" above), use action type "feature_request"

CAPABILITIES:
1. QUERY: Find items by topic, author, date, tags, missing fields, reading status
2. ANALYZE: Library statistics, author analysis, tag analysis, completeness assessment
3. EXPLAIN: Help users understand metadata issues, suggest improvements (with app-specific steps)
4. ORGANIZE: Suggest tags, identify cleanup opportunities
5. NAVIGATE: Direct users to specific views or items in the interface

RESPONSE STYLE:
- Be conversational but concise
- Always include specific counts when relevant
- When showing items, include title, author, year
- Offer 2-3 relevant follow-up suggestions
- Use markdown formatting sparingly (bold for emphasis, not headers)
- Give app-specific instructions with UI element names

AVAILABLE ACTIONS:
- filter: Set library filter (all, incomplete, duplicates, untagged, recent, reviewed, tag)
- search: Search by text query
- show: Display specific items
- statistics: Return library overview statistics
- library_insights: Detailed library analysis
- tag: Suggest or apply tags
- tag_analysis: Analyze tag usage and suggest cleanup
- author_analysis: Analyze authors in library
- reading_status: Query or suggest reading status changes
- verify: Suggest metadata verification
- explain: Explain a concept or issue (with app-specific steps)
- help: List available capabilities
- feature_request: User asked for unsupported feature (provide feature request template)

RESPONSE FORMAT (JSON):
{
  "action": { "type": "string", "params": {}, "reasoning": "why this action" },
  "message": "Conversational response to user",
  "confidence": "high|medium|low",
  "items": [{ "key": "string", "title": "string", "authors": "string", "year": "string", "missingFields": [], "tags": [] }],
  "count": number,
  "followUp": ["suggested follow-up 1", "suggested follow-up 2"],
  "data": {} // Optional structured data for statistics/insights
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- For statistics/insights, put structured data in the "data" field
- Items array should have max 10-15 items
- Follow-up suggestions should be actual queries the user could ask`;

  const prompt = `${CHAT_SYSTEM_PROMPT}

${libraryContextString}${conversationContextStr}

User Query: "${query}"

Analyze the query and determine the appropriate action. Return ONLY valid JSON - no markdown, no explanatory text.`;

  try {
    const result = await callGemini(apiKey, prompt, true);
    
    if (result && result.action && result.message) {
      // Trust the AI's response - use items it returned if any
      let chatItems: ChatItem[] = [];
      let itemCount = 0;
      
      // If AI returned items, use those (map keys to actual items)
      if (result.items && Array.isArray(result.items) && result.items.length > 0) {
        // Map AI's item keys to actual library items
        const itemKeys = result.items.map((item: any) => item.key).filter(Boolean);
        const matchingItems = items.filter(i => itemKeys.includes(i.key));
        
        chatItems = matchingItems.slice(0, 15).map(item => {
          const aiItem = result.items.find((ai: any) => ai.key === item.key);
          return {
            key: item.key,
            title: item.data.title || 'Untitled',
            authors: item.data.creators?.map((c: any) => c.lastName || c.name).filter(Boolean).join(', ') || 'Unknown',
            year: extractYear(item.data.date)?.toString() || '',
            relevance: aiItem?.relevance,
            missingFields: checkMissingCitationFields(item).required.concat(checkMissingCitationFields(item).recommended),
            tags: item.data.tags?.map((t: any) => t.tag) || [],
            readingStatus: item.data.tags?.some((t: any) => t.tag === '_status:read') ? 'read' :
                          item.data.tags?.some((t: any) => t.tag === '_status:reading') ? 'reading' : 'unread'
          };
        });
        itemCount = matchingItems.length;
      } 
      // If AI didn't return items but action suggests we should find items, do intelligent matching
      else if (result.action.type === 'show' || result.action.type === 'search' || result.action.type === 'filter' || result.action.type === 'reading_status') {
        // Use action params to find items intelligently
        const params = result.action.params || {};
        
        if (params.itemKeys && Array.isArray(params.itemKeys)) {
          // AI specified specific item keys
          const matching = items.filter(i => params.itemKeys.includes(i.key));
          chatItems = matching.slice(0, 15).map(item => ({
            key: item.key,
            title: item.data.title || 'Untitled',
            authors: item.data.creators?.map((c: any) => c.lastName || c.name).filter(Boolean).join(', ') || 'Unknown',
            year: extractYear(item.data.date)?.toString() || '',
            missingFields: checkMissingCitationFields(item).required.concat(checkMissingCitationFields(item).recommended),
            tags: item.data.tags?.map((t: any) => t.tag) || []
          }));
          itemCount = matching.length;
        } else if (params.query || params.filter) {
          // AI specified a query or filter - do intelligent search
          const searchQuery = (params.query || query).toLowerCase();
          const searchTerms = searchQuery.split(/\s+/).filter((t: string) => t.length > 2);
          
          const matching = itemsData.filter(item => {
            const titleLower = item.title.toLowerCase();
            const authorsLower = item.authors.toLowerCase();
            const abstractLower = (item.abstract || '').toLowerCase();
            const tagsLower = item.tags.join(' ').toLowerCase();
            
            return searchTerms.some((term: string) => 
              titleLower.includes(term) || 
              authorsLower.includes(term) || 
              abstractLower.includes(term) ||
              tagsLower.includes(term)
            );
          });
          
          itemCount = matching.length;
          chatItems = matching.slice(0, 15).map(item => ({
            key: item.key,
            title: item.title,
            authors: item.authors,
            year: item.year,
            missingFields: item.missingFields,
            tags: item.tags
          }));
        }
      }
      
      // If still no items but the message suggests items should be shown, try to find them from the query
      if (chatItems.length === 0 && result.message) {
        const messageLower = result.message.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Check if message mentions items that should be shown
        const mentionsItems = messageLower.includes('item') || 
                             messageLower.includes('here are') || 
                             messageLower.includes('showing') ||
                             messageLower.includes('found') ||
                             messageLower.includes('unread') ||
                             messageLower.includes('untracked') ||
                             messageLower.includes('reading');
        
        if (mentionsItems) {
          // Try to extract what the user is asking for from the query
          if (queryLower.includes('unread') || queryLower.includes('untracked') || queryLower.includes('reading')) {
            // Find unread/untracked items
            const unreadItems = items.filter(i => 
              !i.data.tags?.some((t: any) => t.tag.startsWith('_status:'))
            );
            chatItems = unreadItems.slice(0, 15).map(item => ({
              key: item.key,
              title: item.data.title || 'Untitled',
              authors: item.data.creators?.map((c: any) => c.lastName || c.name).filter(Boolean).join(', ') || 'Unknown',
              year: extractYear(item.data.date)?.toString() || '',
              missingFields: checkMissingCitationFields(item).required.concat(checkMissingCitationFields(item).recommended),
              tags: item.data.tags?.map((t: any) => t.tag) || [],
              readingStatus: 'unread' as const
            }));
            itemCount = unreadItems.length;
          } else if (queryLower.includes('untagged') || queryLower.includes('no tags')) {
            // Find untagged items
            const untaggedItems = items.filter(i => !i.data.tags?.length);
            chatItems = untaggedItems.slice(0, 15).map(item => ({
              key: item.key,
              title: item.data.title || 'Untitled',
              authors: item.data.creators?.map((c: any) => c.lastName || c.name).filter(Boolean).join(', ') || 'Unknown',
              year: extractYear(item.data.date)?.toString() || '',
              missingFields: checkMissingCitationFields(item).required.concat(checkMissingCitationFields(item).recommended),
              tags: []
            }));
            itemCount = untaggedItems.length;
          } else if (queryLower.includes('missing doi') || queryLower.includes('no doi') || queryLower.includes('without doi')) {
            // Find items missing DOIs specifically
            const missingDOIItems = items.filter(i => !i.data.DOI);
            chatItems = missingDOIItems.slice(0, 15).map(item => ({
              key: item.key,
              title: item.data.title || 'Untitled',
              authors: item.data.creators?.map((c: any) => c.lastName || c.name).filter(Boolean).join(', ') || 'Unknown',
              year: extractYear(item.data.date)?.toString() || '',
              missingFields: ['DOI'],
              tags: item.data.tags?.map((t: any) => t.tag) || []
            }));
            itemCount = missingDOIItems.length;
          } else if (queryLower.includes('missing') || queryLower.includes('incomplete')) {
            // Find items with missing fields
            const incompleteItems = items.filter(i => {
              const missing = checkMissingCitationFields(i);
              return missing.required.length > 0 || missing.recommended.length > 0;
            });
            chatItems = incompleteItems.slice(0, 15).map(item => ({
              key: item.key,
              title: item.data.title || 'Untitled',
              authors: item.data.creators?.map((c: any) => c.lastName || c.name).filter(Boolean).join(', ') || 'Unknown',
              year: extractYear(item.data.date)?.toString() || '',
              missingFields: checkMissingCitationFields(item).required.concat(checkMissingCitationFields(item).recommended),
              tags: item.data.tags?.map((t: any) => t.tag) || []
            }));
            itemCount = incompleteItems.length;
          } else {
            // General search - find items matching query terms
            const searchTerms = queryLower.split(/\s+/).filter((t: string) => t.length > 2);
            if (searchTerms.length > 0) {
              const matching = itemsData.filter(item => {
                const titleLower = item.title.toLowerCase();
                const authorsLower = item.authors.toLowerCase();
                const abstractLower = (item.abstract || '').toLowerCase();
                const tagsLower = item.tags.join(' ').toLowerCase();
                
                return searchTerms.some((term: string) => 
                  titleLower.includes(term) || 
                  authorsLower.includes(term) || 
                  abstractLower.includes(term) ||
                  tagsLower.includes(term)
                );
              });
              
              itemCount = matching.length;
              chatItems = matching.slice(0, 15).map(item => ({
                key: item.key,
                title: item.title,
                authors: item.authors,
                year: item.year,
                missingFields: item.missingFields,
                tags: item.tags
              }));
            }
          }
        }
      }
      
      // Use count from AI if provided, otherwise use our calculated count
      const finalCount = result.count !== undefined ? result.count : itemCount;
      
      return {
        action: result.action,
        message: result.message,
        confidence: result.confidence || 'medium',
        items: chatItems.length > 0 ? chatItems : undefined,
        count: finalCount,
        summary: result.summary,
        followUp: result.followUp,
        data: result.data
      };
    }
    
    // Fallback parsing
    throw new Error('Invalid response format');
  } catch (e) {
    // Fallback: try to parse simple queries
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('untagged') || lowerQuery.includes('no tags')) {
      const matching = itemsData.filter(i => i.tags.length === 0);
      return {
        action: {
          type: 'navigate',
          params: { view: 'library', filter: 'untagged' },
          reasoning: 'User wants to see untagged items'
        },
        message: `You have ${matching.length} untagged items.`,
        confidence: 'high',
        count: matching.length,
        items: matching.slice(0, 10).map(i => ({
          key: i.key,
          title: i.title,
          authors: i.authors,
          year: i.year,
          missingFields: i.missingFields
        }))
      };
    }
    
    if (lowerQuery.includes('missing doi') || lowerQuery.includes('no doi') || lowerQuery.includes('without doi')) {
      const matching = itemsData.filter(i => !i.doi);
      return {
        action: {
          type: 'show',
          params: { query: 'missing DOI' },
          reasoning: 'User wants to see items missing DOIs'
        },
        message: `You have ${matching.length} items missing DOIs. Here are the first ${Math.min(10, matching.length)}:`,
        confidence: 'high',
        count: matching.length,
        items: matching.slice(0, 10).map(i => ({
          key: i.key,
          title: i.title,
          authors: i.authors,
          year: i.year,
          missingFields: ['DOI']
        }))
      };
    }
    
    if (lowerQuery.includes('incomplete') || lowerQuery.includes('missing')) {
      const matching = itemsData.filter(i => i.missingFields.length > 0);
      return {
        action: {
          type: 'navigate',
          params: { view: 'library', filter: 'incomplete' },
          reasoning: 'User wants to see items with incomplete metadata'
        },
        message: `You have ${matching.length} items with incomplete metadata.`,
        confidence: 'high',
        count: matching.length,
        items: matching.slice(0, 10).map(i => ({
          key: i.key,
          title: i.title,
          authors: i.authors,
          year: i.year,
          missingFields: i.missingFields
        }))
      };
    }
    
    if (lowerQuery.includes('duplicate')) {
      return {
        action: {
          type: 'navigate',
          params: { view: 'library', filter: 'duplicates' },
          reasoning: 'User wants to see duplicates'
        },
        message: 'Showing duplicate items',
        confidence: 'high'
      };
    }
    
    // Default: treat as search
    const searchTerms = lowerQuery.split(/\s+/).filter(t => t.length > 2);
    const matching = itemsData.filter(item => {
      const titleLower = item.title.toLowerCase();
      const authorsLower = item.authors.toLowerCase();
      const tagsLower = item.tags.join(' ').toLowerCase();
      return searchTerms.some(term => 
        titleLower.includes(term) || 
        authorsLower.includes(term) ||
        tagsLower.includes(term)
      );
    });
    
    return {
      action: {
        type: 'search',
        params: { query },
        reasoning: 'Treating query as search'
      },
      message: `Found ${matching.length} items matching "${query}"`,
      confidence: 'low',
      count: matching.length,
      items: matching.slice(0, 10).map(i => ({
        key: i.key,
        title: i.title,
        authors: i.authors,
        year: i.year,
        missingFields: i.missingFields
      }))
    };
  }
}

/**
 * Execute a chat action and return results
 */
export function executeChatAction(
  action: ChatAction,
  items: ZoteroItem[],
  setSearchQuery?: (q: string) => void,
  setFilterMode?: (mode: any) => void,
  setActiveTab?: (tab: any) => void,
  setSelectedTag?: (tag: string | null) => void
): { success: boolean; message: string; results?: any; itemKeys?: string[] } {
  try {
    switch (action.type) {
      case 'navigate':
        if (action.params.view && setActiveTab) {
          setActiveTab(action.params.view);
        }
        if (action.params.filter && setFilterMode) {
          setFilterMode(action.params.filter);
        }
        return {
          success: true,
          message: `Navigated to ${action.params.view || 'library'}`,
          results: { view: action.params.view, filter: action.params.filter }
        };
      
      case 'filter':
        if (action.params.filter && setFilterMode) {
          setFilterMode(action.params.filter);
        }
        if (action.params.query && setSearchQuery) {
          setSearchQuery(action.params.query);
        }
        return {
          success: true,
          message: `Applied filter: ${action.params.filter || 'search'}`,
          results: { filter: action.params.filter, query: action.params.query }
        };
      
      case 'search':
        if (action.params.query && setSearchQuery) {
          setSearchQuery(action.params.query);
        }
        if (setFilterMode) {
          setFilterMode('all');
        }
        return {
          success: true,
          message: `Searching for: ${action.params.query}`,
          results: { query: action.params.query }
        };
      
      case 'statistics':
        const stats = {
          total: items.length,
          untagged: items.filter(i => !i.data.tags || i.data.tags.length === 0).length,
          incomplete: items.filter(i => {
            const missing = checkMissingCitationFields(i);
            return missing.required.length > 0;
          }).length,
          withTags: items.filter(i => i.data.tags && i.data.tags.length > 0).length,
          itemTypes: items.reduce((acc, i) => {
            acc[i.data.itemType] = (acc[i.data.itemType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        };
        return {
          success: true,
          message: `Your library has ${stats.total} items. ${stats.untagged} are untagged, ${stats.incomplete} have incomplete metadata.`,
          results: stats
        };
      
      case 'tag':
        // This will be handled by the calling component
        const matchingItems = action.params.itemKeys
          ? items.filter(i => action.params.itemKeys!.includes(i.key))
          : items.filter(i => {
              if (action.params.query) {
                const query = action.params.query.toLowerCase();
                const title = (i.data.title || '').toLowerCase();
                const abstract = (i.data.abstractNote || '').toLowerCase();
                return title.includes(query) || abstract.includes(query);
              }
              return true;
            });
        
        return {
          success: true,
          message: `Found ${matchingItems.length} items to tag`,
          results: { items: matchingItems.length, tags: action.params.tags },
          itemKeys: matchingItems.map(i => i.key)
        };
      
      case 'show':
        const showItems = action.params.itemKeys
          ? items.filter(i => action.params.itemKeys!.includes(i.key))
          : items.filter(i => {
              if (action.params.query) {
                const query = action.params.query.toLowerCase();
                const title = (i.data.title || '').toLowerCase();
                const abstract = (i.data.abstractNote || '').toLowerCase();
                const authors = (i.data.creators || [])
                  .map(c => `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.toLowerCase())
                  .join(' ');
                return title.includes(query) || abstract.includes(query) || authors.includes(query);
              }
              return false;
            });
        
        return {
          success: true,
          message: `Found ${showItems.length} items matching "${action.params.query}"`,
          results: { items: showItems.length },
          itemKeys: showItems.map(i => i.key)
        };
      
      case 'tag_analysis':
        const tagAnalysis = analyzeTags(items);
        return {
          success: true,
          message: formatTagAnalysisMessage(tagAnalysis),
          results: { analysis: tagAnalysis }
        };
      
      case 'author_analysis':
        const authorAnalysis = analyzeAuthors(items);
        return {
          success: true,
          message: formatAuthorAnalysisMessage(authorAnalysis),
          results: { analysis: authorAnalysis }
        };
      
      case 'compare':
        // Compare two items - return structured comparison data
        if (action.params.itemKeys && action.params.itemKeys.length === 2) {
          const item1 = items.find(i => i.key === action.params.itemKeys[0]);
          const item2 = items.find(i => i.key === action.params.itemKeys[1]);
          if (item1 && item2) {
            const missing1 = checkMissingCitationFields(item1);
            const missing2 = checkMissingCitationFields(item2);
            return {
              success: true,
              message: `Comparing "${item1.data.title}" and "${item2.data.title}"`,
              results: {
                item1: { key: item1.key, title: item1.data.title, missing: missing1 },
                item2: { key: item2.key, title: item2.data.title, missing: missing2 }
              }
            };
          }
        }
        return {
          success: false,
          message: 'Please specify two items to compare'
        };
      
      case 'explain':
        // Provide explanations about metadata concepts
        const topic = action.params.topic || 'metadata';
        const explanations: Record<string, string> = {
          'metadata': 'Metadata is information about your library items (title, authors, DOI, abstract, etc.). Complete metadata helps with citations and organization.',
          'doi': 'A DOI (Digital Object Identifier) is a unique identifier for academic publications. DOIs help track citations and verify publications.',
          'abstract': 'An abstract is a brief summary of a publication. It helps you quickly understand what the work is about.',
          'tags': 'Tags are labels you can add to items to organize and find them. Use descriptive tags that reflect topics, themes, or categories.',
          'verification': 'Verification checks your metadata against external databases (Crossref, OpenAlex) to find missing information like DOIs and abstracts.',
          'duplicates': 'Duplicate items are entries that refer to the same publication. They can cause confusion in citations and should be merged or removed.'
        };
        return {
          success: true,
          message: explanations[topic] || explanations['metadata'],
          results: { topic }
        };
      
      case 'help':
        return {
          success: true,
          message: `I can help you:\n\n• Find items: "Show items about X", "Find items by author Y"\n• Analyze your library: "What topics does my library cover?", "Analyze my authors"\n• Fix issues: "Which items are missing DOIs?", "Show untagged items"\n• Organize: "Suggest tags for items about X", "Find duplicates"\n• Get insights: "How complete is my metadata?", "What needs attention?"\n\nTry asking me anything about your library!`,
          results: { type: 'help' }
        };
      
      case 'export':
        // Export assistance - identify items to export
        const exportItems = action.params.itemKeys
          ? items.filter(i => action.params.itemKeys!.includes(i.key))
          : items.filter(i => {
              if (action.params.filter) {
                const filter = action.params.filter.toLowerCase();
                if (filter.includes('doi') || filter.includes('missing')) {
                  return !i.data.DOI;
                }
                if (filter.includes('untagged')) {
                  return !i.data.tags?.length;
                }
                if (filter.includes('incomplete')) {
                  const missing = checkMissingCitationFields(i);
                  return missing.required.length > 0;
                }
              }
              return true;
            });
        
        const format: ExportFormat = action.params.format || 'rdf';
        const exportData = generateExport(format, exportItems, new Map(), true);
        
        return {
          success: true,
          message: `Prepared ${exportItems.length} items for export as ${format.toUpperCase()}. Ready to download.`,
          results: {
            itemCount: exportItems.length,
            format,
            exportData,
            itemKeys: exportItems.map(i => i.key)
          }
        };
      
      default:
        return {
          success: false,
          message: 'Unknown action type'
        };
    }
  } catch (e: any) {
    return {
      success: false,
      message: `Error executing action: ${e.message}`
    };
  }
}
