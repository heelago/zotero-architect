export interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ZoteroTag {
  tag: string;
  type?: number;
}

export interface ZoteroItemData {
  key: string;
  version: number;
  itemType: string;
  title: string;
  creators: ZoteroCreator[];
  date: string;
  DOI?: string;
  ISBN?: string;
  publisher?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstractNote?: string;
  url?: string;
  tags: ZoteroTag[];
  collections?: string[];
  [key: string]: any;
}

export interface ZoteroItem {
  key: string;
  version: number;
  library: {
    type: string;
    id: number;
  };
  data: ZoteroItemData;
  meta: {
    creatorSummary: string;
    parsedDate: string;
    numChildren: number;
  };
}

export interface LibraryStats {
  totalItems: number;
  untaggedItems: number;
  uncollectedItems: number;
  missingAbstracts: number;
  duplicateGroups: number;
}

export interface OrganizationSuggestion {
  itemKey: string;
  itemTitle?: string;
  suggestedCollection: string;
  suggestedTags: string[];
  reasoning: string;
}

export interface TagCluster {
  canonicalTag: string;
  similarTags: string[];
  reason: string;
}

export interface Config {
  zoteroApiKey: string;
  libraryId: string;
  libraryType: 'user' | 'group';
}

export interface EnrichmentResult {
  title?: string;
  date?: string;
  DOI?: string;
  ISBN?: string;
  publisher?: string;
  publicationTitle?: string;
  bookTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstractNote?: string;
  url?: string;
  conferenceName?: string;
  university?: string;
  institution?: string;
  creators?: ZoteroCreator[];
}

export interface Issue {
  field: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface ItemWithIssues {
  item: ZoteroItem;
  issues: Issue[];
}

export interface DuplicateGroup {
  id: string;
  reason: string;
  items: ZoteroItem[];
}

export interface VerificationTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface VerificationReport {
  itemKey: string;
  tasks: VerificationTask[];
  overallStatus: 'success' | 'partial' | 'failed' | 'warning';
  findings: {
    publicationExists: boolean;
    authorsValid: boolean;
    dataQuality: 'good' | 'needs_review' | 'poor';
    missingFields: string[];
    warnings: string[];
    errors: string[];
  };
  recommendations: string[];
  manualEdits?: {
    timestamp: number;
    fields: string[];
    citationStyle?: string;
  }[];
}
