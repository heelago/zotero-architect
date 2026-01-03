import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Config, ZoteroItem, LibraryStats, OrganizationSuggestion, 
  TagCluster, EnrichmentResult, ItemWithIssues, DuplicateGroup, ZoteroItemData, ZoteroCreator
} from './types';
import { fetchAllItems, fetchItem, updateItem, deleteItem, createNote, createItem } from './zoteroService';
import { suggestOrganization, standardizeTags, enrichItemMetadata } from './geminiService';
import { enrichItemMetadataHybrid, findCitingPapers, CitingPaper } from './bibliographicService';
import { runComprehensiveVerification } from './verificationAgents';
import { VerificationReport, VerificationTask } from './types';
import { findDuplicates, findIssues, filterValidFields, checkMissingCitationFields, MissingFieldsReport, generateExport, getExportFileExtension, getExportMimeType, ExportFormat } from './utils';
import { Icons } from './constants';
import { formatCitation, parseCitationEdits, CitationStyle } from './citationFormatter';
import { parseChatQuery, executeChatAction, ChatResponse } from './chatService';

// Help Box Component
const HelpBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <details className="help-box">
      <summary className="help-box-header">
        <Icons.Info />
        <span>{title}</span>
        <Icons.Chevron />
      </summary>
      <div className="help-box-content">
        {children}
      </div>
    </details>
  );
};

type AppTab = 'home' | 'library' | 'chat' | 'citations' | 'settings';

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP PANEL - Dark themed with both API keys
// ═══════════════════════════════════════════════════════════════════════════════

const SetupPanel: React.FC<{ onComplete: (cfg: Config, geminiKey: string, readOnly?: boolean) => void; error: string | null }> = ({ onComplete, error }) => {
  const [zoteroKey, setZoteroKey] = useState('');
  const [libraryId, setLibraryId] = useState('');
  const [libraryType, setLibraryType] = useState<'user' | 'group'>('user');
  const [geminiKey, setGeminiKey] = useState('');
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    if (!zoteroKey || !libraryId) return;
    setLoading(true);
    try {
    onComplete({ zoteroApiKey: zoteroKey, libraryId, libraryType }, geminiKey, readOnlyMode);
    } catch (err) {
      console.error('Connection error:', err);
      setLoading(false);
    }
  };

  return (
    <div className="setup-panel">
      <div className="setup-header">
        <div className="logo">
          <Icons.Library />
        </div>
        <h1>Zotero Architect</h1>
        <p>AI-powered library cleanup &amp; organization</p>
      </div>
      
      <div className="setup-form">
        <div className="form-section">
          <h3>Zotero Connection</h3>
          <p className="hint">
            Get credentials from <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer">zotero.org/settings/keys</a>
            <br />
            <strong>Note:</strong> Only <strong>library access</strong> is required. Write access is optional - the app works in read-only mode with RDF export.
          </p>
          
          <div className="input-group">
            <label>API Key</label>
            <div className="input-with-icon">
              <Icons.Key />
              <input
                type="password"
                value={zoteroKey}
                onChange={e => setZoteroKey(e.target.value)}
                placeholder="Your Zotero API key"
              />
            </div>
          </div>
          
          <div className="input-row">
            <div className="input-group">
              <label>Library ID</label>
              <input
                type="text"
                value={libraryId}
                onChange={e => setLibraryId(e.target.value)}
                placeholder="User or Group ID"
              />
            </div>
            
            <div className="input-group">
              <label>Library Type</label>
              <div className="toggle-group">
                <button 
                  className={libraryType === 'user' ? 'active' : ''}
                  onClick={() => setLibraryType('user')}
                >
                  User
                </button>
                <button 
                  className={libraryType === 'group' ? 'active' : ''}
                  onClick={() => setLibraryType('group')}
                >
                  Group
                </button>
              </div>
            </div>
          </div>
          
          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={readOnlyMode}
                onChange={e => setReadOnlyMode(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <span>Use read-only mode</span>
            </label>
            <div style={{ marginTop: '0.5rem', paddingLeft: '1.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Read-only mode</strong> prevents direct changes to your Zotero library. Instead, all changes are staged for export.
              </p>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Use this if:</strong>
              </p>
              <ul style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                <li>Your API key doesn't have write permissions</li>
                <li>You want to review changes before applying them</li>
                <li>You prefer to import changes manually via RDF export</li>
              </ul>
              <p style={{ marginBottom: 0, fontStyle: 'italic' }}>
                Changes will be exported as an RDF file that you can import into Zotero. You can always switch modes later in Settings.
              </p>
            </div>
          </div>
        </div>
        
        <div className="form-section optional">
          <h3>AI Enhancement <span className="badge">Recommended</span></h3>
          <p className="hint">Gemini 3 Flash Preview for metadata lookup, categorization &amp; tag standardization</p>
          
          <div className="input-group">
            <label>Gemini API Key</label>
            <div className="input-with-icon">
              <Icons.Sparkles />
              <input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIza..."
              />
            </div>
          </div>
        </div>
        
        <div className="privacy-notice">
          <div className="privacy-notice-header">
            <Icons.Info />
            <span>Privacy & Security</span>
          </div>
          <div className="privacy-notice-content">
            <p><strong>Your API keys stay private:</strong></p>
            <ul>
              <li>All API keys are stored <strong>only in your browser</strong> - they never leave your device</li>
              <li><strong>We don't have access</strong> to your keys, library data, or any information you enter</li>
              <li>All processing happens in your browser - no data is sent to our servers</li>
              <li>API calls are made directly from your browser to Zotero, Crossref, OpenAlex, and Google Gemini</li>
            </ul>
            <p className="privacy-note">This is a client-side application. Your credentials are never transmitted to or stored by us.</p>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
              <p>
                <strong>🔓 Open Source:</strong> This app is fully open source. 
                <a href="https://github.com/heelago/zotero-architect" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem' }}>View source code</a> · 
                <a href="/PRIVACY.md" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem' }}>Full privacy details</a>
              </p>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            <strong>Connection Error:</strong> {error}
            <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <p>Please check:</p>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                <li>Your API key is correct and has <strong>library access</strong> enabled (write access is optional - app works in read-only mode)</li>
                <li>Your Library ID is correct (found at <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer">zotero.org/settings/keys</a>)</li>
                <li>You selected the correct library type (User vs Group)</li>
              </ul>
            </div>
          </div>
        )}
        
        <button 
          className="connect-btn" 
          onClick={handleConnect}
          disabled={loading || !zoteroKey || !libraryId}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Connecting...
            </>
          ) : (
            <>
              <Icons.Search />
              Initialize Workspace
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const ProgressPanel: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const percent = total ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className="progress-panel">
      <div className="progress-content">
        <div className="progress-icon">
          <Icons.Library />
        </div>
        <h2>Syncing Library</h2>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }}></div>
        </div>
        <p>{current.toLocaleString()} / {total.toLocaleString()} items</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  CONFIG: 'zotero-architect-config',
  GEMINI_KEY: 'zotero-architect-gemini-key',
  CHANGE_LOG: 'zotero-architect-changelog',
  PENDING_EXPORT: 'zotero-architect-pending-export',
  REVIEWED_ITEMS: 'zotero-architect-reviewed-items',
  EXPANDED_CARDS: 'zotero-architect-expanded-cards',
  FILTER_STATE: 'zotero-architect-filter-state',
  CHAT_MESSAGES: 'zotero-architect-chat-messages',
  READ_ONLY_MODE: 'zotero-architect-readonly-mode',
  ACTIVE_TAB: 'zotero-architect-active-tab',
  PENDING_REPAIRS: 'zotero-architect-pending-repairs',
  VERIFICATION_REPORTS: 'zotero-architect-verification-reports',
  EXPORT_TYPE: 'zotero-architect-export-type',
  EXPORT_FORMAT: 'zotero-architect-export-format',
};

// Helper to safely parse JSON from localStorage
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item);
    // Handle Date objects in change log
    if (key === STORAGE_KEYS.CHANGE_LOG && Array.isArray(parsed)) {
      return parsed.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      })) as T;
    }
    return parsed;
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e);
    return defaultValue;
  }
}

// Helper to safely save to localStorage
function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}

// Helper to convert Set to array for storage
function setToArray<T>(set: Set<T>): T[] {
  return Array.from(set);
}

// Helper to convert array to Set
function arrayToSet<T>(arr: T[]): Set<T> {
  return new Set(arr);
}

// Helper to convert Map to object for storage
function mapToObject<K extends string, V>(map: Map<K, V>): Record<K, V> {
  const obj = {} as Record<K, V>;
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

// Helper to convert object to Map
function objectToMap<K extends string, V>(obj: Record<K, V>): Map<K, V> {
  const map = new Map<K, V>();
  Object.entries(obj).forEach(([key, value]) => {
    map.set(key as K, value as V);
  });
  return map;
}

const App: React.FC = () => {
  // Core state
  const [config, setConfig] = useState<Config | null>(() => 
    loadFromStorage<Config | null>(STORAGE_KEYS.CONFIG, null)
  );
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => 
    loadFromStorage<string>(STORAGE_KEYS.GEMINI_KEY, '')
  );
  const [allItems, setAllItems] = useState<ZoteroItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>(() => 
    loadFromStorage<AppTab>(STORAGE_KEYS.ACTIVE_TAB, 'home')
  );
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; action?: string; results?: any }>>(() => 
    loadFromStorage<Array<{ role: 'user' | 'assistant'; content: string; action?: string; results?: any }>>(STORAGE_KEYS.CHAT_MESSAGES, [])
  );
  const [chatInput, setChatInput] = useState('');
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  
  // Processing state
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [processingItemKey, setProcessingItemKey] = useState<string | null>(null);
  
  // UI state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => 
    arrayToSet(loadFromStorage<string[]>(STORAGE_KEYS.EXPANDED_CARDS, []))
  );
  const [expandedSections, setExpandedSections] = useState<Set<'categorizer' | 'tags' | 'metadata' | 'overview'>>(new Set());
  
  // Feature-specific state
  // AI Categorizer and Tag Standardizer state removed - service functions still available in geminiService.ts
  const [pendingRepairs, setPendingRepairs] = useState<Record<string, EnrichmentResult>>({});
  const [metadataSources, setMetadataSources] = useState<Record<string, string>>({}); // Track source of metadata for each item
  const [verificationReports, setVerificationReports] = useState<Record<string, VerificationReport>>({});
  const [citationStyles, setCitationStyles] = useState<Record<string, CitationStyle>>({}); // Track selected citation style per item (defaults to 'apa')
  const [editingCitations, setEditingCitations] = useState<Record<string, { style: CitationStyle; fields: Record<string, string> }>>({}); // Track edited citation fields
  
  // Batch review state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [batchProcessingItems, setBatchProcessingItems] = useState<Set<string>>(new Set());
  
  // Merge modal state
  const [activeMergeGroup, setActiveMergeGroup] = useState<DuplicateGroup | null>(null);
  const [mergeMaster, setMergeMaster] = useState<ZoteroItem | null>(null);
  const [mergeDraft, setMergeDraft] = useState<Partial<ZoteroItemData> | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, number>>({});
  const [streamlinedMode, setStreamlinedMode] = useState(false);
  const [streamlinedVerification, setStreamlinedVerification] = useState<EnrichmentResult | null>(null);
  const [streamlinedFlags, setStreamlinedFlags] = useState<string[]>([]);
  
  // Verification report state
  const [verificationReport, setVerificationReport] = useState<string | null>(null);
  const [showVerificationReport, setShowVerificationReport] = useState(false);
  
  // Library tab filter and search state
  const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());
  const [readOnlyMode, setReadOnlyMode] = useState(() => 
    loadFromStorage<boolean>(STORAGE_KEYS.READ_ONLY_MODE, false)
  );
  const [pendingExportChanges, setPendingExportChanges] = useState<Map<string, Partial<ZoteroItemData>>>(() => 
    objectToMap(loadFromStorage<Record<string, Partial<ZoteroItemData>>>(STORAGE_KEYS.PENDING_EXPORT, {}))
  );
  
  // Load filter state once
  const savedFilterState = loadFromStorage<{ searchQuery: string; filterMode: string; selectedTag: string | null; sortBy: string; sortOrder: string }>(STORAGE_KEYS.FILTER_STATE, { searchQuery: '', filterMode: 'all', selectedTag: null, sortBy: 'dateAdded', sortOrder: 'desc' });
  
  const [searchQuery, setSearchQuery] = useState(savedFilterState.searchQuery);
  const [filterMode, setFilterMode] = useState<'all' | 'incomplete' | 'duplicates' | 'recent' | 'reviewed' | 'untagged' | 'tag'>(savedFilterState.filterMode as typeof filterMode);
  const [selectedTag, setSelectedTag] = useState<string | null>(savedFilterState.selectedTag);
  const [tagSuggestions, setTagSuggestions] = useState<Record<string, OrganizationSuggestion>>({});
  const [selectedSuggestedTags, setSelectedSuggestedTags] = useState<Record<string, Set<string>>>({});
  const [tagsToRemove, setTagsToRemove] = useState<Record<string, Set<string>>>({});
  const [isTagging, setIsTagging] = useState(false);
  const [sortBy, setSortBy] = useState<'dateAdded' | 'title' | 'author' | 'completeness'>(savedFilterState.sortBy as typeof sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(savedFilterState.sortOrder as typeof sortOrder);
  const [inlineConfirmations, setInlineConfirmations] = useState<Record<string, string>>({});
  const [showExportReview, setShowExportReview] = useState(false);
  const [exportType, setExportType] = useState<'changedOnly' | 'all'>(() => 
    loadFromStorage<'changedOnly' | 'all'>(STORAGE_KEYS.EXPORT_TYPE, 'changedOnly')
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>(() => 
    loadFromStorage<ExportFormat>(STORAGE_KEYS.EXPORT_FORMAT, 'rdf')
  );
  
  // Change log state - track all changes made to the library
  interface ChangeLogEntry {
    timestamp: Date;
    itemKey: string;
    itemTitle: string;
    action: 'update' | 'delete' | 'create' | 'tag';
    fields: string[];
    oldValues?: Record<string, any>;
    newValues: Record<string, any>;
    mode: 'direct' | 'staged';
  }
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(() => 
    loadFromStorage<ChangeLogEntry[]>(STORAGE_KEYS.CHANGE_LOG, [])
  );
  const [showChangeLog, setShowChangeLog] = useState(false);
  
  // Confirmation modal state
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    itemKey: string;
    itemTitle: string;
    changes: Record<string, { old: any; new: any }>;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  
  // Reviewed items state - track items that have been accepted/declined
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(() => 
    arrayToSet(loadFromStorage<string[]>(STORAGE_KEYS.REVIEWED_ITEMS, []))
  );
  // Editable suggestions - allow users to edit values before applying
  const [editableSuggestions, setEditableSuggestions] = useState<Record<string, Record<string, any>>>({});
  
  // Citations tab state
  const [selectedItemForCitations, setSelectedItemForCitations] = useState<ZoteroItem | null>(null);
  const [citingPapers, setCitingPapers] = useState<CitingPaper[]>([]);
  const [isLoadingCitations, setIsLoadingCitations] = useState(false);
  const [editingTags, setEditingTags] = useState<Record<string, boolean>>({});
  const [tagEditValues, setTagEditValues] = useState<Record<string, string[]>>({});
  
  // Auto-tagging settings
  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(false);
  const [autoTaggingMaxResults, setAutoTaggingMaxResults] = useState(10);

  // ─────────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  }, []);

  // Monitor all large state objects to detect memory accumulation
  // Use stable primitive values in dependency array to avoid React warning about changing array size
  const verificationReportsKeyCount = Object.keys(verificationReports).length;
  const allItemsCount = allItems.length;
  const pendingRepairsKeyCount = Object.keys(pendingRepairs).length;
  
  useEffect(() => {
    // Access state directly inside effect - this is safe and avoids dependency array issues
    const keysCount = Object.keys(verificationReports).length;
    try {
      // Memory monitoring removed for production
    } catch (e) {
      // Error handling - memory monitoring removed for production
    }
    // Only depend on primitive counts - accessing state objects directly is safe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationReportsKeyCount, allItemsCount, pendingRepairsKeyCount]);

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSISTENCE - Save state to localStorage
  // ─────────────────────────────────────────────────────────────────────────────

  // Persist config
  useEffect(() => {
    if (config) {
      saveToStorage(STORAGE_KEYS.CONFIG, config);
    }
  }, [config]);

  // Persist Gemini API key (user choice - they can clear it)
  useEffect(() => {
    if (geminiApiKey) {
      saveToStorage(STORAGE_KEYS.GEMINI_KEY, geminiApiKey);
    }
  }, [geminiApiKey]);

  // Persist change log
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CHANGE_LOG, changeLog);
  }, [changeLog]);

  // Persist pending export changes
  useEffect(() => {
    const exportObj = mapToObject(pendingExportChanges);
    saveToStorage(STORAGE_KEYS.PENDING_EXPORT, exportObj);
  }, [pendingExportChanges]);

  // Persist reviewed items
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.REVIEWED_ITEMS, setToArray(reviewedItems));
  }, [reviewedItems]);

  // Persist expanded cards
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.EXPANDED_CARDS, setToArray(expandedCards));
  }, [expandedCards]);

  // Persist filter/search state
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.FILTER_STATE, {
      searchQuery,
      filterMode,
      selectedTag,
      sortBy,
      sortOrder
    });
  }, [searchQuery, filterMode, selectedTag, sortBy, sortOrder]);

  // Persist chat messages
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CHAT_MESSAGES, chatMessages);
  }, [chatMessages]);

  // Persist read-only mode
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.READ_ONLY_MODE, readOnlyMode);
  }, [readOnlyMode]);

  // Persist active tab
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  // Persist export preferences
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.EXPORT_TYPE, exportType);
  }, [exportType]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.EXPORT_FORMAT, exportFormat);
  }, [exportFormat]);

  // Clear config from storage when disconnected
  useEffect(() => {
    if (!config) {
      localStorage.removeItem(STORAGE_KEYS.CONFIG);
    }
  }, [config]);

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────────

  const loadItems = useCallback(async (cfg: Config, gKey: string, readOnly?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      let fetched: ZoteroItem[] = [];
      
      // Try with the specified library type first
      try {
        fetched = await fetchAllItems(cfg, (current, total) => {
          setProgress({ current, total });
        });
      } catch (err: any) {
        // If 404 and library type is 'user', try 'group' instead
        if (err?.message?.includes('404') || err?.message?.includes('not found')) {
          const altType: 'user' | 'group' = cfg.libraryType === 'user' ? 'group' : 'user';
          const altConfig = { ...cfg, libraryType: altType };
          try {
            fetched = await fetchAllItems(altConfig, (current, total) => {
              setProgress({ current, total });
            });
            // Update config with correct library type
            cfg = altConfig;
            addNotification(`Library found as ${altType} library`, 'info');
          } catch (altErr: any) {
            throw err; // Throw original error
          }
        } else {
          throw err;
        }
      }
      
      setAllItems(fetched);
      setConfig(cfg);
      setGeminiApiKey(gKey);
      
      // Set read-only mode if specified
      if (readOnly !== undefined) {
        setReadOnlyMode(readOnly);
        if (readOnly) {
          addNotification('Read-only mode enabled. Changes will be staged for export.', 'info');
        }
      }
      
      if (fetched.length === 0) {
        addNotification('Library connected but no items found. Make sure your library has items.', 'info');
      }
    } catch (err: any) {
      console.error('Error loading items:', err);
      const errorMessage = err?.message || 'Failed to load items from Zotero';
      setError(errorMessage);
      addNotification(`Error: ${errorMessage}`, 'error');
      // Reset config so setup panel shows again with error
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  const refreshLibrary = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const fetched = await fetchAllItems(config, (current, total) => {
        setProgress({ current, total });
      });
      setAllItems(fetched);
      addNotification('Library refreshed', 'success');
    } catch (err: any) {
      addNotification(`Refresh failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [config, addNotification]);

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED DATA
  // ─────────────────────────────────────────────────────────────────────────────

  const bibItems = useMemo(() => {
    return allItems.filter(item => 
      item.data.itemType !== 'attachment' && 
      item.data.itemType !== 'note'
    );
  }, [allItems]);

  const stats: LibraryStats = useMemo(() => {
    const duplicates = findDuplicates(bibItems);
    return {
      totalItems: bibItems.length,
      untaggedItems: bibItems.filter(i => !i.data.tags || i.data.tags.length === 0).length,
      uncollectedItems: bibItems.filter(i => !i.data.collections || i.data.collections.length === 0).length,
      missingAbstracts: bibItems.filter(i => !i.data.abstractNote).length,
      duplicateGroups: duplicates.length
    };
  }, [bibItems]);

  const duplicatesList = useMemo(() => findDuplicates(bibItems), [bibItems]);
  const allIssuesList = useMemo(() => findIssues(bibItems), [bibItems]);
  
  // New filtered items for Library tab
  const filteredItems = useMemo(() => {
    let items = [...bibItems];
    const issueKeys = new Set(allIssuesList.map(i => i.item.key));
    
    // Filter by mode
    switch (filterMode) {
      case 'incomplete':
        items = items.filter(item => issueKeys.has(item.key) && !reviewedItems.has(item.key));
        break;
      case 'recent':
        // Items modified in last 7 days
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        items = items.filter(item => {
          const modified = new Date(item.data.dateModified || 0).getTime();
          return modified > weekAgo && !reviewedItems.has(item.key);
        });
        break;
      case 'reviewed':
        // Only show reviewed items
        items = items.filter(item => reviewedItems.has(item.key));
        break;
      case 'untagged':
        // Items with no tags
        items = items.filter(item => !item.data.tags || item.data.tags.length === 0);
        break;
      case 'tag':
        // Items with a specific tag
        if (selectedTag) {
          items = items.filter(item => 
            item.data.tags?.some(t => t.tag.toLowerCase() === selectedTag.toLowerCase())
          );
        } else {
          items = [];
        }
        break;
      case 'duplicates':
        // Handled separately - return empty here, duplicates shown in separate view
        return [];
      case 'all':
      default:
        // Exclude reviewed items from default view
        items = items.filter(item => !reviewedItems.has(item.key));
        break;
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => {
        const title = (item.data.title || '').toLowerCase();
        const creators = (item.data.creators || [])
          .map(c => `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.toLowerCase())
          .join(' ');
        const doi = (item.data.DOI || '').toLowerCase();
        const abstract = (item.data.abstractNote || '').toLowerCase();
        
        return title.includes(query) || 
               creators.includes(query) || 
               doi.includes(query) ||
               abstract.includes(query);
      });
    }
    
    // Sort
    items.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = (a.data.title || '').localeCompare(b.data.title || '');
          break;
        case 'author':
          const authorA = a.data.creators?.[0]?.lastName || '';
          const authorB = b.data.creators?.[0]?.lastName || '';
          comparison = authorA.localeCompare(authorB);
          break;
        case 'completeness':
          const missingA = checkMissingCitationFields(a).required.length + checkMissingCitationFields(a).recommended.length;
          const missingB = checkMissingCitationFields(b).required.length + checkMissingCitationFields(b).recommended.length;
          comparison = missingA - missingB;
          break;
        case 'dateAdded':
        default:
          const dateA = new Date(a.data.dateAdded || 0).getTime();
          const dateB = new Date(b.data.dateAdded || 0).getTime();
          comparison = dateA - dateB;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return items;
  }, [bibItems, filterMode, searchQuery, sortBy, sortOrder, allIssuesList, reviewedItems, selectedTag]);
  
  // Legacy issuesList for compatibility (items with issues)
  const issuesList = useMemo(() => {
    return filteredItems
      .filter(item => allIssuesList.some(issue => issue.item.key === item.key))
      .map(item => {
        const issue = allIssuesList.find(i => i.item.key === item.key);
        return { item, issues: issue?.issues || [] };
      });
  }, [filteredItems, allIssuesList]);
  
  // Get available filter options
  const availableMissingFields = useMemo(() => {
    const fields = new Set<string>();
    allIssuesList.forEach(({ issues }) => {
      issues.forEach(issue => fields.add(issue.field));
    });
    return Array.from(fields).sort();
  }, [allIssuesList]);
  
  const availableItemTypes = useMemo(() => {
    const types = new Set<string>();
    allIssuesList.forEach(({ item }) => {
      types.add(item.data.itemType);
    });
    return Array.from(types).sort();
  }, [allIssuesList]);
  
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allIssuesList.forEach(({ item }) => {
      const year = item.data.date ? item.data.date.match(/\d{4}/)?.[0] : null;
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allIssuesList]);
  
  const toggleItemFlag = useCallback((itemKey: string) => {
    setFlaggedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  }, []);
  
  const clearAllFlags = useCallback(() => {
    setFlaggedItems(new Set());
  }, []);
  
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    bibItems.forEach(item => {
      item.data.tags?.forEach(t => tagSet.add(t.tag));
    });
    return Array.from(tagSet).sort();
  }, [bibItems]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SAFE UPDATE WITH VERSION RETRY
  // ─────────────────────────────────────────────────────────────────────────────

  const safeUpdate = async (item: ZoteroItem, enrichment: any): Promise<ZoteroItem> => {
    if (!config) throw new Error("No config");
    
    // If in read-only mode, don't attempt to update
    if (readOnlyMode) {
      throw new Error("READ_ONLY_MODE");
    }
    
    try {
      const proposedItem = { ...item, data: { ...item.data, ...enrichment } };
      return await updateItem(config, proposedItem);
    } catch (err: any) {
      // If we get a 403 (forbidden), it means no write access - enable read-only mode
      if (err.message && err.message.includes('403') || err.message.includes('insufficient permissions')) {
        console.warn('Write access not available, enabling read-only mode');
        setReadOnlyMode(true);
        addNotification('Write access not available. Changes will be staged for export.', 'info');
        throw new Error("READ_ONLY_MODE");
      }
      
      if (err.message === "VERSION_MISMATCH") {
        console.warn(`Version mismatch for ${item.key}, retrying...`);
        const latestItem = await fetchItem(config, item.key);
        const retryItem = { ...latestItem, data: { ...latestItem.data, ...enrichment } };
        return await updateItem(config, retryItem);
      }
      throw err;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AI CATEGORIZER
  // ─────────────────────────────────────────────────────────────────────────────

  const runCategorizer = async () => {
    if (!geminiApiKey) {
      addNotification('Gemini API key required for AI features', 'error');
      return;
    }
    
    const untagged = bibItems.filter(i => !i.data.tags || i.data.tags.length === 0).slice(0, 20);
    if (untagged.length === 0) {
      addNotification('No untagged items to categorize', 'info');
      return;
    }
    
    setIsProcessingAI(true);
    try {
      addNotification(`Analyzing ${untagged.length} items with Gemini...`, 'info');
      const suggestions = await suggestOrganization(untagged, geminiApiKey);
      // AI Categorizer removed - suggestions no longer stored
      // setOrgSuggestions(suggestions);
      addNotification(`Generated ${suggestions.length} categorization suggestions`, 'success');
    } catch (e: any) {
      addNotification(`Categorization failed: ${e.message}`, 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const applyCategorySuggestion = async (suggestion: OrganizationSuggestion) => {
    if (!config) return;
    
    const item = bibItems.find(i => i.key === suggestion.itemKey);
    if (!item) return;
    
    setProcessingItemKey(item.key);
    try {
      const newTags = suggestion.suggestedTags.map(tag => ({ tag }));
      const combinedTags = [...(item.data.tags || []), ...newTags];
      const uniqueTags = Array.from(
        new Map(combinedTags.map(t => [t.tag.toLowerCase(), t])).values()
      );
      
      if (readOnlyMode) {
        setPendingExportChanges(prev => {
          const next = new Map(prev);
          const existing = next.get(item.key) || {};
          next.set(item.key, { ...existing, tags: uniqueTags });
          return next;
        });
        addNotification(`Tags staged for export: ${item.data.title.substring(0, 30)}...`, 'success');
      } else {
        try {
          const updated = await safeUpdate(item, { tags: uniqueTags });
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
          addNotification(`Tagged: ${item.data.title.substring(0, 30)}...`, 'success');
        } catch (err: any) {
          if (err.message === "READ_ONLY_MODE" || err.message.includes('403') || err.message.includes('Write access')) {
            setPendingExportChanges(prev => {
              const next = new Map(prev);
              const existing = next.get(item.key) || {};
              next.set(item.key, { ...existing, tags: uniqueTags });
              return next;
            });
            addNotification(`Tags staged for export: ${item.data.title.substring(0, 30)}...`, 'success');
          } else {
            throw err;
          }
        }
      }
    } catch (e: any) {
      addNotification(`Failed to apply tags: ${e.message}`, 'error');
    } finally {
      setProcessingItemKey(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAG STANDARDIZER
  // ─────────────────────────────────────────────────────────────────────────────

  const runTagStandardizer = async () => {
    if (!geminiApiKey) {
      addNotification('Gemini API key required for AI features', 'error');
      return;
    }
    
    if (allTags.length < 5) {
      addNotification('Need more tags to analyze patterns', 'info');
      return;
    }
    
    setIsProcessingAI(true);
    try {
      addNotification(`Analyzing ${allTags.length} tags for duplicates...`, 'info');
      const clusters = await standardizeTags(allTags, geminiApiKey);
      // Tag Standardizer removed - clusters no longer stored
      // setTagClusters(clusters.filter(c => c.similarTags.length > 1));
      addNotification(`Found ${clusters.length} tag clusters to merge`, 'success');
    } catch (e: any) {
      addNotification(`Tag analysis failed: ${e.message}`, 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const applyTagMerge = async (cluster: TagCluster) => {
    if (!config) return;
    
    setIsProcessingAI(true);
    try {
      let updateCount = 0;
      for (const item of bibItems) {
        const hasOldTag = item.data.tags?.some(t => cluster.similarTags.includes(t.tag));
        if (hasOldTag) {
          const newTags = item.data.tags
            .filter(t => !cluster.similarTags.includes(t.tag))
            .concat([{ tag: cluster.canonicalTag }]);
          
          const updated = await safeUpdate(item, { tags: newTags });
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
          updateCount++;
        }
      }
      // Tag Standardizer removed - no longer tracking clusters
      // setTagClusters(prev => prev.filter(c => c.canonicalTag !== cluster.canonicalTag));
      addNotification(`Merged tags in ${updateCount} items`, 'success');
    } catch (e: any) {
      addNotification(`Tag merge failed: ${e.message}`, 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA DOCTOR
  // ─────────────────────────────────────────────────────────────────────────────

  const startVerifyingMetadata = async (item: ZoteroItem) => {
    if (!geminiApiKey) {
      addNotification('Gemini API key required for AI features', 'error');
      return;
    }
    
    setProcessingItemKey(item.key);
    setIsProcessingAI(true);
    try {
      addNotification(`Running comprehensive verification: ${item.data.title.substring(0, 30)}...`, 'info');
      
      // Run comprehensive multi-agent verification
      const report = await runComprehensiveVerification(item, geminiApiKey);
      setVerificationReports(prev => {
        const newReports = { ...prev, [item.key]: report };
        return newReports;
      });
      
      // Extract enrichment from the metadata enrichment task
      const enrichmentTask = report.tasks.find(t => t.id === 'metadata-enrichment');
      let enrichmentSource = '';
      if (enrichmentTask?.status === 'completed' && enrichmentTask.result) {
        const validEnrichment = filterValidFields(item.data.itemType, enrichmentTask.result);
        
        if (Object.keys(validEnrichment).length > 0) {
          setPendingRepairs(prev => ({ ...prev, [item.key]: validEnrichment }));
          // Track source from verification task if available
          if ((enrichmentTask as any)?.source) {
            enrichmentSource = (enrichmentTask as any).source;
            setMetadataSources(prev => ({ ...prev, [item.key]: enrichmentSource }));
          }
        }
      }
      
      // Apply author corrections if found
      // BUT: Only if enrichment didn't already provide authors from a verified source
      const authorTask = report.tasks.find(t => t.id === 'author-validation');
      if (authorTask?.status === 'completed' && authorTask.result?.correctAuthors) {
        // Check if enrichment already provided authors from a verified source (Crossref, OpenAlex)
        const hasVerifiedAuthors = enrichmentSource && (
          enrichmentSource.includes('Crossref') || 
          enrichmentSource.includes('OpenAlex')
        ) && enrichmentTask?.result?.creators && enrichmentTask.result.creators.length > 0;
        
        if (!hasVerifiedAuthors) {
        const currentRepairs = pendingRepairs[item.key] || {};
        setPendingRepairs(prev => ({
          ...prev,
          [item.key]: { ...currentRepairs, creators: authorTask.result.correctAuthors }
        }));
        }
      }
      
      setExpandedCards(prev => new Set(prev).add(item.key));
      
      // Show comprehensive results
      let notificationMsg = '';
      let notificationType: 'success' | 'error' | 'info' = 'info';
      
      if (report.overallStatus === 'failed') {
        notificationType = 'error';
        notificationMsg = `Verification found critical issues: ${report.findings.errors.join('; ')}`;
      } else if (report.overallStatus === 'warning') {
        notificationType = 'info';
        notificationMsg = `Verification complete with warnings: ${report.findings.warnings.join('; ')}`;
      } else if (report.overallStatus === 'partial') {
        notificationType = 'info';
        notificationMsg = 'Verification complete. Some data quality issues detected.';
      } else {
        notificationType = 'success';
        notificationMsg = 'Verification complete! All checks passed.';
      }
      
      if (report.recommendations.length > 0) {
        notificationMsg += ` Recommendations: ${report.recommendations.slice(0, 2).join('; ')}`;
      }
      
      addNotification(notificationMsg, notificationType);
      
    } catch (e: any) {
      const errorMsg = e.message || 'Unknown error';
      // Check if it's an API error (404, etc.)
      if (errorMsg.includes('404') || errorMsg.includes('NOT_FOUND')) {
        addNotification('API Error: Model not found. Please check your Gemini API key and model configuration.', 'error');
      } else if (errorMsg.includes('API error')) {
        addNotification(`API Error: ${errorMsg}`, 'error');
      } else {
        addNotification(`Verification failed: ${errorMsg}`, 'error');
      }
    } finally {
      setIsProcessingAI(false);
      setProcessingItemKey(null);
    }
  };

  const applyRepairs = async (item: ZoteroItem) => {
    const repairs = pendingRepairs[item.key];
    if (!config) {
      addNotification('Configuration missing. Please check your setup.', 'error');
      return;
    }
    // Allow saving if repairs exist (even if only creators)
    if (!repairs || Object.keys(repairs).length === 0) {
      addNotification('No changes to save.', 'info');
      return;
    }
    
    setIsProcessingAI(true);
    setProcessingItemKey(item.key);
    try {
      const updated = await safeUpdate(item, repairs);
      setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
      
      // Check for missing citation fields after update
      const missing = checkMissingCitationFields(updated);
      if (missing.required.length > 0 || missing.recommended.length > 0) {
        const requiredMsg = missing.required.length > 0 ? `Missing required: ${missing.required.join(', ')}. ` : '';
        const recommendedMsg = missing.recommended.length > 0 ? `Missing recommended: ${missing.recommended.join(', ')}.` : '';
        addNotification(`Record updated. ${requiredMsg}${recommendedMsg}`, 'info');
      } else {
        addNotification('Record updated successfully! All citation fields complete.', 'success');
      }
      
      setPendingRepairs(prev => {
        const next = { ...prev };
        delete next[item.key];
        return next;
      });
      setMetadataSources(prev => {
        const next = { ...prev };
        delete next[item.key];
        return next;
      });
      // Clean up verification reports after successful save to prevent memory leak
      setVerificationReports(prev => {
        const next = { ...prev };
        delete next[item.key];
        return next;
      });
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
    } catch (e: any) {
      addNotification(`Update failed: ${e.message}`, 'error');
    } finally {
      setIsProcessingAI(false);
      setProcessingItemKey(null);
    }
  };

  const markAsVerified = async (item: ZoteroItem) => {
    if (!config) return;
    
    setIsProcessingAI(true);
    setProcessingItemKey(item.key);
    try {
      const now = new Date();
      const timestamp = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
      const noteContent = `Verified\n${timestamp}`;
      
      await createNote(config, item.key, noteContent);
      addNotification('Item marked as verified', 'success');
    } catch (e: any) {
      addNotification(`Failed to mark as verified: ${e.message}`, 'error');
    } finally {
      setIsProcessingAI(false);
      setProcessingItemKey(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH REVIEW
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleBatchMode = () => {
    setBatchMode(!batchMode);
    if (batchMode) {
      setSelectedItems(new Set());
    }
  };

  const toggleItemSelection = (itemKey: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const selectAllItems = () => {
    if (selectedItems.size === issuesList.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(issuesList.map(({ item }) => item.key)));
    }
  };

  const batchVerify = async () => {
    if (!geminiApiKey) {
      addNotification('Gemini API key required for AI features', 'error');
      return;
    }

    if (selectedItems.size === 0) {
      addNotification('Please select items to verify', 'info');
      return;
    }

    setIsProcessingAI(true);
    const itemsToProcess = issuesList
      .filter(({ item }) => selectedItems.has(item.key))
      .slice(0, 20); // Limit to 20 items at a time
    
    const processingSet = new Set(itemsToProcess.map(({ item }) => item.key));
    setBatchProcessingItems(processingSet);
    
    let successCount = 0;
    let failCount = 0;

    try {
      addNotification(`Verifying ${itemsToProcess.length} items...`, 'info');
      
      for (const { item } of itemsToProcess) {
        try {
          const enrichmentResult = await enrichItemMetadataHybrid(item, geminiApiKey);
          if (enrichmentResult) {
            const validEnrichment = filterValidFields(item.data.itemType, enrichmentResult.result);
          
          if (Object.keys(validEnrichment).length > 0) {
            setPendingRepairs(prev => ({ ...prev, [item.key]: validEnrichment }));
              setMetadataSources(prev => ({ ...prev, [item.key]: enrichmentResult.source }));
            setExpandedCards(prev => new Set(prev).add(item.key));
            successCount++;
              // Only show notification for first few items to avoid spam
              if (successCount <= 3) {
                addNotification(`Found metadata from ${enrichmentResult.source}`, 'success');
              }
            }
          }
          
          // Check what's still missing after enrichment
          if (enrichmentResult) {
            const validEnrichment = filterValidFields(item.data.itemType, enrichmentResult.result);
          const missing = checkMissingCitationFields(item, validEnrichment);
          if (missing.required.length > 0) {
            // Item still has missing required fields
            }
          }
          
          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e: any) {
          console.error(`Failed to verify ${item.key}:`, e);
          failCount++;
          // Delay even on error to maintain rate limit
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      addNotification(
        `Batch verification complete: ${successCount} found, ${failCount} failed`,
        successCount > 0 ? 'success' : 'info'
      );
    } finally {
      setIsProcessingAI(false);
      setBatchProcessingItems(new Set());
    }
  };

  const batchApplyRepairs = async () => {
    if (!config) return;
    
    const itemsToApply = issuesList.filter(({ item }) => 
      selectedItems.has(item.key) && pendingRepairs[item.key]
    );

    if (itemsToApply.length === 0) {
      addNotification('No items with pending repairs selected', 'info');
      return;
    }

    setIsProcessingAI(true);
    let successCount = 0;
    let failCount = 0;

    try {
      addNotification(`Applying repairs to ${itemsToApply.length} items...`, 'info');

      for (const { item } of itemsToApply) {
        try {
          const repairs = pendingRepairs[item.key];
          if (!repairs) continue;

          const updated = await safeUpdate(item, repairs);
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
          
          // Track missing fields
          const missing = checkMissingCitationFields(updated);
          if (missing.required.length > 0) {
            failCount++; // Count as failure if required fields missing
          } else {
            successCount++;
          }
          
          setPendingRepairs(prev => {
            const next = { ...prev };
            delete next[item.key];
            return next;
          });
          setMetadataSources(prev => {
            const next = { ...prev };
            delete next[item.key];
            return next;
          });
          
          // Clean up verification reports after successful batch apply
          setVerificationReports(prev => {
            const next = { ...prev };
            delete next[item.key];
            return next;
          });
        } catch (e: any) {
          console.error(`Failed to apply repairs to ${item.key}:`, e);
          failCount++;
        }
      }

      setSelectedItems(new Set());
      const message = failCount > 0
        ? `Batch apply complete: ${successCount} updated successfully, ${failCount} have missing required citation fields`
        : `Batch apply complete: ${successCount} items updated successfully with complete citation metadata`;
      addNotification(message, successCount > 0 ? (failCount > 0 ? 'info' : 'success') : 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const batchDiscardRepairs = () => {
    const itemsToDiscard = Array.from(selectedItems).filter(key => pendingRepairs[key]);
    
    setPendingRepairs(prev => {
      const next = { ...prev };
      itemsToDiscard.forEach(key => delete next[key]);
      return next;
    });
    setMetadataSources(prev => {
      const next = { ...prev };
      itemsToDiscard.forEach(key => delete next[key]);
      return next;
    });
    
    // Clean up verification reports for discarded items
    setVerificationReports(prev => {
      const next = { ...prev };
      itemsToDiscard.forEach(key => delete next[key]);
      return next;
    });
    
    setSelectedItems(new Set());
    addNotification(`Discarded repairs for ${itemsToDiscard.length} items`, 'info');
  };

  const updatePendingRepairField = (itemKey: string, field: string, value: string) => {
    setPendingRepairs(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], [field]: value }
    }));
  };

  const applySingleField = async (itemKey: string, field: string, value: any) => {
    const item = allItems.find(i => i.key === itemKey);
    if (!config || !item) {
      return;
    }

    // Get old value for change log
    const oldValue = field === 'creators' 
      ? (item.data.creators || []).map(c => `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.trim()).join(', ') || 'None'
      : (item.data as any)[field] || '(empty)';
    
    const newValue = field === 'creators' && Array.isArray(value)
      ? value.map((c: any) => `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.trim()).join(', ') || 'None'
      : value;

    try {
      if (readOnlyMode) {
        // Stage for export instead of saving
        setPendingExportChanges(prev => {
          const next = new Map(prev);
          const existing = next.get(itemKey) || {};
          next.set(itemKey, { ...existing, [field]: value });
          return next;
        });
        setInlineConfirmations(prev => ({ ...prev, [`${itemKey}-${field}`]: 'Staged' }));
        
        // Log to change log
        setChangeLog(prev => [...prev, {
          timestamp: new Date(),
          itemKey,
          itemTitle: item.data.title || 'Untitled',
          action: 'update',
          fields: [field],
          oldValues: { [field]: oldValue },
          newValues: { [field]: newValue },
          mode: 'staged'
        }]);
      } else {
        // Prepare the update - handle creators specially
        let updateData: any = {};
        if (field === 'creators') {
          updateData.creators = value;
        } else {
          updateData[field] = value;
        }

        // Apply the change to Zotero
        try {
          const updated = await safeUpdate(item, updateData);
          
          // Update the item in allItems FIRST so UI reflects the change immediately
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
          
          setInlineConfirmations(prev => ({ ...prev, [`${itemKey}-${field}`]: 'Saved' }));
          
          // Log to change log
          setChangeLog(prev => [...prev, {
            timestamp: new Date(),
            itemKey,
            itemTitle: item.data.title || 'Untitled',
            action: 'update',
            fields: [field],
            oldValues: { [field]: oldValue },
            newValues: { [field]: newValue },
            mode: 'direct'
          }]);
        } catch (err: any) {
          // If write failed due to read-only, stage for export instead
          if (err.message === "READ_ONLY_MODE" || err.message.includes('403') || err.message.includes('Write access')) {
            setPendingExportChanges(prev => {
              const next = new Map(prev);
              const existing = next.get(itemKey) || {};
              next.set(itemKey, { ...existing, [field]: value });
              return next;
            });
            setInlineConfirmations(prev => ({ ...prev, [`${itemKey}-${field}`]: 'Staged' }));
            
            // Log to change log
            setChangeLog(prev => [...prev, {
              timestamp: new Date(),
              itemKey,
              itemTitle: item.data.title || 'Untitled',
              action: 'update',
              fields: [field],
              oldValues: { [field]: oldValue },
              newValues: { [field]: newValue },
              mode: 'staged'
            }]);
          } else {
            throw err; // Re-throw other errors
          }
        }
      }
      
      // Remove this field from pendingRepairs (this will hide the suggestion)
      setPendingRepairs(prev => {
        const next = { ...prev };
        if (next[itemKey]) {
          // Remove the applied field
          const repairs = { ...next[itemKey] } as any;
          delete repairs[field];
          
          // If no more pending repairs, remove the entire entry
          if (Object.keys(repairs).length === 0) {
            delete next[itemKey];
          } else {
            next[itemKey] = repairs;
          }
        }
        return next;
      });
      
      // Ensure the card stays expanded (don't close it)
      setExpandedCards(prev => {
        const next = new Set(prev);
        next.add(itemKey);
        return next;
      });
      
      // Clear inline confirmation after 2 seconds
      setTimeout(() => {
        setInlineConfirmations(prev => {
          const next = { ...prev };
          delete next[`${itemKey}-${field}`];
          return next;
        });
      }, 2000);
    } catch (e: any) {
      console.error(`Failed to apply ${field}:`, e);
    }
  };

  const applyAllSuggestions = async (itemKey: string, customRepair?: EnrichmentResult, skipConfirmation: boolean = false) => {
    const item = allItems.find(i => i.key === itemKey);
    const repair = customRepair || pendingRepairs[itemKey];
    if (!config || !item || !repair) return;

    // Build change summary for confirmation
    const changes: Record<string, { old: any; new: any }> = {};
    Object.entries(repair).forEach(([field, newValue]) => {
      if (field === 'creators' && Array.isArray(newValue)) {
        const oldCreators = item.data.creators || [];
        if (JSON.stringify(oldCreators) !== JSON.stringify(newValue)) {
          changes[field] = {
            old: oldCreators.map(c => `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.trim()).join(', ') || 'None',
            new: newValue.map((c: any) => `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.trim()).join(', ') || 'None'
          };
        }
      } else if (newValue !== undefined && newValue !== null && newValue !== '') {
        const oldValue = (item.data as any)[field];
        if (oldValue !== newValue && (oldValue || newValue)) {
          changes[field] = {
            old: oldValue || '(empty)',
            new: newValue
          };
        }
      }
    });

    // Show confirmation if there are changes and not skipping
    if (!skipConfirmation && Object.keys(changes).length > 0) {
      setPendingConfirmation({
        itemKey,
        itemTitle: item.data.title || 'Untitled',
        changes,
        onConfirm: () => {
          setPendingConfirmation(null);
          applyAllSuggestions(itemKey, repair, true); // Recursive call with skipConfirmation
        },
        onCancel: () => {
          setPendingConfirmation(null);
        }
      });
      return;
    }

    try {
      const fieldsChanged = Object.keys(changes);
      
      if (readOnlyMode) {
        // Stage all for export
        setPendingExportChanges(prev => {
          const next = new Map(prev);
          const existing = next.get(itemKey) || {};
          next.set(itemKey, { ...existing, ...repair });
          return next;
        });
        
        // Log to change log
        setChangeLog(prev => [...prev, {
          timestamp: new Date(),
          itemKey,
          itemTitle: item.data.title || 'Untitled',
          action: 'update',
          fields: fieldsChanged,
          oldValues: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
          newValues: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
          mode: 'staged'
        }]);
      } else {
        try {
          const updated = await safeUpdate(item, repair);
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
          
          // Log to change log
          setChangeLog(prev => [...prev, {
            timestamp: new Date(),
            itemKey,
            itemTitle: item.data.title || 'Untitled',
            action: 'update',
            fields: fieldsChanged,
            oldValues: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
            newValues: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
            mode: 'direct'
          }]);
        } catch (err: any) {
          // If write failed due to read-only, stage for export instead
          if (err.message === "READ_ONLY_MODE" || err.message.includes('403') || err.message.includes('Write access')) {
            setPendingExportChanges(prev => {
              const next = new Map(prev);
              const existing = next.get(itemKey) || {};
              next.set(itemKey, { ...existing, ...repair });
              return next;
            });
            
            // Log to change log
            setChangeLog(prev => [...prev, {
              timestamp: new Date(),
              itemKey,
              itemTitle: item.data.title || 'Untitled',
              action: 'update',
              fields: fieldsChanged,
              oldValues: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
              newValues: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
              mode: 'staged'
            }]);
          } else {
            throw err; // Re-throw other errors
          }
        }
      }
      
      setPendingRepairs(prev => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
      
      setInlineConfirmations(prev => ({ ...prev, [`${itemKey}-all`]: readOnlyMode ? 'Staged' : 'Saved' }));
      setTimeout(() => {
        setInlineConfirmations(prev => {
          const next = { ...prev };
          delete next[`${itemKey}-all`];
          return next;
        });
      }, 2000);
    } catch (e: any) {
      console.error(`Failed to apply all suggestions:`, e);
    }
  };

  const clearSuggestions = (itemKey: string) => {
    setPendingRepairs(prev => {
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
  };

  const handleTagItem = async (item: ZoteroItem) => {
    if (!geminiApiKey) {
      addNotification('Gemini API key required for AI tagging', 'error');
      return;
    }
    
    setIsTagging(true);
    setProcessingItemKey(item.key);
    
    try {
      const suggestions = await suggestOrganization([item], geminiApiKey);
      
      if (suggestions.length > 0) {
        // Find suggestion that matches this item (by itemKey or take first if only one item)
        const matchingSuggestion = suggestions.find(s => s.itemKey === item.key) || suggestions[0];
        
        if (matchingSuggestion && matchingSuggestion.suggestedTags && matchingSuggestion.suggestedTags.length > 0) {
          setTagSuggestions(prev => ({
            ...prev,
            [item.key]: matchingSuggestion
          }));
          // Initialize all suggested tags as selected by default
          setSelectedSuggestedTags(prev => ({
            ...prev,
            [item.key]: new Set(matchingSuggestion.suggestedTags.map(t => t.toLowerCase()))
          }));
          setExpandedCards(prev => new Set(prev).add(item.key));
          addNotification(`Generated ${matchingSuggestion.suggestedTags.length} tag suggestions`, 'success');
        } else {
          addNotification('No tag suggestions in response. Try again.', 'info');
        }
      } else {
        addNotification('No tag suggestions generated. Try again.', 'info');
      }
    } catch (e: any) {
      console.error('[App] Failed to get tag suggestions:', e);
      const errorMsg = e?.message || 'Failed to generate tag suggestions';
      addNotification(`Tagging failed: ${errorMsg}`, 'error');
    } finally {
      setIsTagging(false);
      setProcessingItemKey(null);
    }
  };

  const handleBatchTag = async () => {
    if (!geminiApiKey) {
      addNotification('Gemini API key required for AI tagging', 'error');
      return;
    }
    
    if (selectedItems.size === 0) {
      addNotification('Please select items to tag', 'info');
      return;
    }
    
    setIsTagging(true);
    const itemsToTag = Array.from(selectedItems)
      .map(key => allItems.find(i => i.key === key))
      .filter((item): item is ZoteroItem => item !== undefined)
      .slice(0, 20); // Limit batch size
    
    try {
      addNotification(`Generating tags for ${itemsToTag.length} items...`, 'info');
      
      // Process in smaller batches to avoid rate limits
      for (let i = 0; i < itemsToTag.length; i += 5) {
        const batch = itemsToTag.slice(i, i + 5);
        const suggestions = await suggestOrganization(batch, geminiApiKey);
        
        suggestions.forEach(suggestion => {
          setTagSuggestions(prev => ({
            ...prev,
            [suggestion.itemKey]: suggestion
          }));
          // Initialize all suggested tags as selected by default
          if (suggestion.suggestedTags && suggestion.suggestedTags.length > 0) {
            setSelectedSuggestedTags(prev => ({
              ...prev,
              [suggestion.itemKey]: new Set(suggestion.suggestedTags.map(t => t.toLowerCase()))
            }));
          }
          setExpandedCards(prev => new Set(prev).add(suggestion.itemKey));
        });
        
        // Small delay between batches
        if (i + 5 < itemsToTag.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      addNotification(`Tag suggestions generated for ${itemsToTag.length} items`, 'success');
    } catch (e: any) {
      console.error('Batch tagging failed:', e);
      addNotification('Failed to generate tag suggestions', 'error');
    } finally {
      setIsTagging(false);
    }
  };

  const handleChatQuery = useCallback(async (userMessage: string) => {
    if (!geminiApiKey || isProcessingChat) return;
    
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessingChat(true);
    
    try {
      const response: ChatResponse = await parseChatQuery(userMessage, bibItems, geminiApiKey);
      
      // If we have items to show, display them with clickable titles
      if (response.items && response.items.length > 0) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: response.message,
          action: response.action.type,
          results: {
            items: response.items,
            count: response.count,
            summary: response.summary
          }
        }]);
        
        // Apply appropriate filter/search based on the query
        // Determine filter mode from the action or query context
        const queryLower = userMessage.toLowerCase();
        if (queryLower.includes('untagged') || queryLower.includes('no tags')) {
          setFilterMode('untagged');
          setSearchQuery('');
        } else if (queryLower.includes('missing doi') || queryLower.includes('no doi') || queryLower.includes('without doi')) {
          setFilterMode('incomplete');
          setSearchQuery('DOI');
        } else if (queryLower.includes('incomplete') || (queryLower.includes('missing') && !queryLower.includes('doi'))) {
          setFilterMode('incomplete');
          setSearchQuery('');
        } else if (queryLower.includes('duplicate')) {
          setFilterMode('duplicates');
          setSearchQuery('');
        } else if (queryLower.includes('tag') && response.action.params.tag) {
          setFilterMode('tag');
          setSelectedTag(response.action.params.tag);
          setSearchQuery('');
        } else {
          // For general searches, use search query
          setFilterMode('all');
          if (response.action.params.query) {
            setSearchQuery(response.action.params.query);
          } else {
            // Extract search terms from user message
            const searchTerms = userMessage.split(/\s+/).filter(t => t.length > 2).join(' ');
            if (searchTerms) {
              setSearchQuery(searchTerms);
            }
          }
        }
        
        // Auto-navigate to library if showing items
        setTimeout(() => {
          setActiveTab('library');
        }, 300);
      } else {
        // Execute the action for non-item queries
        const executionResult = executeChatAction(
          response.action,
          bibItems,
          setSearchQuery,
          setFilterMode,
          setActiveTab,
          setSelectedTag
        );
        
        // If action was tag, prepare for batch tagging
        if (response.action.type === 'tag' && executionResult.itemKeys) {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: response.message || executionResult.message,
            action: 'tag',
            results: {
              items: executionResult.itemKeys.length,
              tags: response.action.params.tags,
              itemKeys: executionResult.itemKeys
            }
          }]);
        } else {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: response.message || executionResult.message,
            action: response.action.type,
            results: {
              ...executionResult.results,
              count: response.count
            }
          }]);
        }
        
        // Auto-navigate if needed
        if (response.action.type === 'navigate' || response.action.type === 'filter') {
          setTimeout(() => {
            if (response.action.params.view) {
              setActiveTab(response.action.params.view as AppTab);
            }
          }, 500);
        }
      }
    } catch (e: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${e.message}. Please try rephrasing your question.`
      }]);
    } finally {
      setIsProcessingChat(false);
    }
  }, [geminiApiKey, isProcessingChat, bibItems, setSearchQuery, setFilterMode, setActiveTab, setSelectedTag]);

  const applyTags = async (itemKey: string, selectedTags?: string[], skipConfirmation: boolean = false) => {
    const item = allItems.find(i => i.key === itemKey);
    if (!item || !config) return;
    
    try {
      const existingTags = item.data.tags || [];
      const existingTagSet = new Set(existingTags.map(t => t.tag.toLowerCase()));
      
      // Get selected tags from state if not provided
      const tagsToAdd = selectedTags || Array.from(selectedSuggestedTags[itemKey] || []);
      const tagsToDelete = Array.from(tagsToRemove[itemKey] || []);
      
      // Remove tags that are marked for deletion
      const remainingTags = existingTags.filter(t => !tagsToDelete.includes(t.tag.toLowerCase()));
      
      // Add new selected tags (avoid duplicates)
      const newTags = tagsToAdd
        .filter(tag => !existingTagSet.has(tag.toLowerCase()))
        .map(tag => ({ tag, type: 1 }));
      
      const finalTags = [...remainingTags, ...newTags];
      
      // Remove duplicates (case-insensitive)
      const uniqueTags = Array.from(
        new Map(finalTags.map(t => [t.tag.toLowerCase(), t])).values()
      );
      
      const oldTags = existingTags.map(t => t.tag);
      const newTagNames = uniqueTags.map(t => t.tag);
      
      // Show confirmation if there are changes and not skipping
      if (!skipConfirmation && (tagsToAdd.length > 0 || tagsToDelete.length > 0)) {
        setPendingConfirmation({
          itemKey,
          itemTitle: item.data.title || 'Untitled',
          changes: {
            tags: {
              old: oldTags,
              new: newTagNames
            }
          },
          onConfirm: () => {
            setPendingConfirmation(null);
            applyTags(itemKey, selectedTags, true); // Recursive call with skipConfirmation
          },
          onCancel: () => {
            setPendingConfirmation(null);
          }
        });
        return;
      }
      
      if (readOnlyMode) {
        // Stage for export instead of saving
        setPendingExportChanges(prev => {
          const next = new Map(prev);
          const existing = next.get(itemKey) || {};
          next.set(itemKey, { ...existing, tags: uniqueTags });
          return next;
        });
        setInlineConfirmations(prev => ({ ...prev, [`${itemKey}-tags`]: 'Tags staged' }));
        
        // Log to change log
        setChangeLog(prev => [...prev, {
          timestamp: new Date(),
          itemKey,
          itemTitle: item.data.title || 'Untitled',
          action: 'tag',
          fields: ['tags'],
          oldValues: { tags: oldTags },
          newValues: { tags: newTagNames },
          mode: 'staged'
        }]);
      } else {
        try {
          const updated = await safeUpdate(item, { tags: uniqueTags });
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
          setInlineConfirmations(prev => ({ ...prev, [`${itemKey}-tags`]: 'Tags applied' }));
          
          // Log to change log
          setChangeLog(prev => [...prev, {
            timestamp: new Date(),
            itemKey,
            itemTitle: item.data.title || 'Untitled',
            action: 'tag',
            fields: ['tags'],
            oldValues: { tags: oldTags },
            newValues: { tags: newTagNames },
            mode: 'direct'
          }]);
        } catch (err: any) {
          // If write failed due to read-only, stage for export instead
          if (err.message === "READ_ONLY_MODE" || err.message.includes('403') || err.message.includes('Write access')) {
            setPendingExportChanges(prev => {
              const next = new Map(prev);
              const existing = next.get(itemKey) || {};
              next.set(itemKey, { ...existing, tags: uniqueTags });
              return next;
            });
            setInlineConfirmations(prev => ({ ...prev, [`${itemKey}-tags`]: 'Tags staged' }));
            
            // Log to change log
            setChangeLog(prev => [...prev, {
              timestamp: new Date(),
              itemKey,
              itemTitle: item.data.title || 'Untitled',
              action: 'tag',
              fields: ['tags'],
              oldValues: { tags: oldTags },
              newValues: { tags: newTagNames },
              mode: 'staged'
            }]);
          } else {
            throw err; // Re-throw other errors
          }
        }
      }
      
      // Clear selections and suggestions
      setSelectedSuggestedTags(prev => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
      setTagsToRemove(prev => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
      setTagSuggestions(prev => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
      
      setTimeout(() => {
        setInlineConfirmations(prev => {
          const next = { ...prev };
          delete next[`${itemKey}-tags`];
          return next;
        });
      }, 2000);
    } catch (e: any) {
      console.error('Failed to apply tags:', e);
      addNotification('Failed to apply tags', 'error');
    }
  };

  const updateItemTags = async (itemKey: string, newTags: string[]) => {
    const item = allItems.find(i => i.key === itemKey);
    if (!item || !config) return;
    
    try {
      const tagObjects = newTags.map(tag => ({ tag: tag.trim(), type: 1 })).filter(t => t.tag.length > 0);
      const uniqueTags = Array.from(
        new Map(tagObjects.map(t => [t.tag.toLowerCase(), t])).values()
      );
      
      if (readOnlyMode) {
        setPendingExportChanges(prev => {
          const next = new Map(prev);
          const existing = next.get(itemKey) || {};
          next.set(itemKey, { ...existing, tags: uniqueTags });
          return next;
        });
      } else {
        try {
          const updated = await safeUpdate(item, { tags: uniqueTags });
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
        } catch (err: any) {
          if (err.message === "READ_ONLY_MODE" || err.message.includes('403') || err.message.includes('Write access')) {
            setPendingExportChanges(prev => {
              const next = new Map(prev);
              const existing = next.get(itemKey) || {};
              next.set(itemKey, { ...existing, tags: uniqueTags });
              return next;
            });
          } else {
            throw err;
          }
        }
      }
      
      setEditingTags(prev => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
      
      addNotification('Tags updated', 'success');
    } catch (e: any) {
      console.error('Failed to update tags:', e);
      addNotification('Failed to update tags', 'error');
    }
  };

  const removeTag = async (itemKey: string, tagToRemove: string) => {
    const item = allItems.find(i => i.key === itemKey);
    if (!item || !config) return;
    
    try {
      const updatedTags = (item.data.tags || []).filter(t => t.tag !== tagToRemove);
      
      if (readOnlyMode) {
        setPendingExportChanges(prev => {
          const next = new Map(prev);
          const existing = next.get(itemKey) || {};
          next.set(itemKey, { ...existing, tags: updatedTags });
          return next;
        });
        addNotification('Tag removal staged for export', 'success');
      } else {
        try {
          const updated = await safeUpdate(item, { tags: updatedTags });
          setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
          addNotification('Tag removed', 'success');
        } catch (err: any) {
          if (err.message === "READ_ONLY_MODE" || err.message.includes('403') || err.message.includes('Write access')) {
            setPendingExportChanges(prev => {
              const next = new Map(prev);
              const existing = next.get(itemKey) || {};
              next.set(itemKey, { ...existing, tags: updatedTags });
              return next;
            });
            addNotification('Tag removal staged for export', 'success');
          } else {
            throw err;
          }
        }
      }
    } catch (e: any) {
      console.error('Failed to remove tag:', e);
      addNotification('Failed to remove tag', 'error');
    }
  };

  const handleFindCitations = async (item: ZoteroItem) => {
    setSelectedItemForCitations(item);
    setIsLoadingCitations(true);
    setCitingPapers([]);
    
    try {
      const papers = await findCitingPapers(item, autoTaggingMaxResults);
      setCitingPapers(papers);
      if (papers.length === 0) {
        addNotification('No citing papers found', 'info');
      } else {
        addNotification(`Found ${papers.length} citing papers`, 'success');
      }
    } catch (e: any) {
      console.error('Failed to find citations:', e);
      addNotification('Failed to find citing papers', 'error');
    } finally {
      setIsLoadingCitations(false);
    }
  };

  const addCitingPaperToLibrary = async (paper: CitingPaper) => {
    if (!config) return;
    
    try {
      const newItem: Partial<ZoteroItemData> = {
        itemType: 'journalArticle',
        title: paper.title,
        creators: paper.authors,
        date: paper.date,
        DOI: paper.DOI,
        publicationTitle: paper.publicationTitle,
        abstractNote: paper.abstract,
        url: paper.url,
        tags: []
      };
      
      const created = await createItem(config, newItem);
      setAllItems(prev => [...prev, created]);
      addNotification('Paper added to library', 'success');
      
      // Remove from citing papers list
      setCitingPapers(prev => prev.filter(p => p !== paper));
    } catch (e: any) {
      console.error('Failed to add paper to library:', e);
      addNotification('Failed to add paper to library', 'error');
    }
  };

  const handleBatchVerify = async () => {
    if (selectedItems.size === 0 || !geminiApiKey) return;
    setIsProcessingAI(true);
    
    const itemsToVerify = Array.from(selectedItems)
      .map(key => allItems.find(i => i.key === key))
      .filter((item): item is ZoteroItem => item !== undefined);
    
    for (const item of itemsToVerify) {
      setProcessingItemKey(item.key);
      try {
        await startVerifyingMetadata(item);
      } catch (e) {
        console.error(`Failed to verify ${item.key}:`, e);
      }
    }
    
    setProcessingItemKey(null);
    setIsProcessingAI(false);
  };

  const updatePendingRepairCreators = (itemKey: string, creators: ZoteroCreator[]) => {
    setPendingRepairs(prev => ({
      ...prev,
      [itemKey]: { ...(prev[itemKey] || {}), creators }
    }));
    // Ensure the card is expanded when editing creators
    setExpandedCards(prev => new Set(prev).add(itemKey));
  };

  const discardRepairs = (itemKey: string) => {
    setPendingRepairs(prev => {
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
    // Clean up verification reports to prevent memory leak
    setVerificationReports(prev => {
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // DUPLICATES & MERGE
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDeleteItem = async (item: ZoteroItem) => {
    if (!config || !window.confirm(`Delete "${item.data.title}"? This cannot be undone.`)) return;
    
    setIsProcessingAI(true);
    try {
      await deleteItem(config, item.key, item.version);
      setAllItems(prev => prev.filter(p => p.key !== item.key));
      if (activeMergeGroup) {
        const updatedItems = activeMergeGroup.items.filter(i => i.key !== item.key);
        if (updatedItems.length <= 1) setActiveMergeGroup(null);
        else setActiveMergeGroup({ ...activeMergeGroup, items: updatedItems });
      }
      addNotification('Item deleted', 'success');
    } catch (e: any) {
      addNotification(`Delete failed: ${e.message}`, 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const startRefiningMerge = (group: DuplicateGroup, baseItem: ZoteroItem) => {
    setMergeMaster(baseItem);
    
    // Initialize field selections - all fields default to the master
    const masterIndex = group.items.findIndex(i => i.key === baseItem.key);
    const defaultIndex = masterIndex >= 0 ? masterIndex : 0;
    const initialSelections: Record<string, number> = {};
    const fieldKeys = ['title', 'creators', 'date', 'DOI', 'ISBN', 'publisher', 'publicationTitle', 'volume', 'issue', 'pages', 'abstractNote'];
    fieldKeys.forEach(field => {
      initialSelections[field] = defaultIndex;
    });
    setFieldSelections(initialSelections);
    
    // Initialize draft with master's data
    setMergeDraft({ ...baseItem.data });
  };

  const selectFieldSource = (field: string, itemIndex: number) => {
    setFieldSelections(prev => ({ ...prev, [field]: itemIndex }));
    
    if (!activeMergeGroup) return;
    
    const selectedItem = activeMergeGroup.items[itemIndex];
    if (!selectedItem) return;
    
    // Update the merge draft with the selected field value
    setMergeDraft(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      
      if (field === 'creators') {
        // Create a new array copy of creators
        updated.creators = selectedItem.data.creators ? [...selectedItem.data.creators] : [];
      } else {
        (updated as any)[field] = (selectedItem.data as any)[field] || '';
      }
      
      return updated;
    });
  };

  const getFieldValue = (item: ZoteroItem, field: string): string => {
    if (field === 'creators') {
      return item.meta.creatorSummary || 'No authors';
    }
    const value = (item.data as any)[field];
    return value || '—';
  };

  const executeFinalMerge = async () => {
    if (!config || !mergeMaster || !mergeDraft || !activeMergeGroup) return;
    
    setIsProcessingAI(true);
    try {
      // If streamlined mode, apply verification results first
      let finalDraft = { ...mergeDraft };
      if (streamlinedMode && streamlinedVerification) {
        finalDraft = { ...finalDraft, ...streamlinedVerification };
      }
      
      // Create temporary merged item to check for missing fields
      const tempMergedItem: ZoteroItem = {
        ...mergeMaster,
        data: { ...mergeMaster.data, ...finalDraft } as ZoteroItemData
      };
      
      // Check for missing citation fields
      const missing = checkMissingCitationFields(tempMergedItem);
      const hasMissingFields = missing.required.length > 0 || missing.recommended.length > 0;
      
      // Run verification if there are missing fields
      if (hasMissingFields) {
        addNotification('Searching for missing metadata from bibliographic databases...', 'info');
        try {
          const enrichmentResult = await enrichItemMetadataHybrid(tempMergedItem, geminiApiKey);
          if (enrichmentResult) {
            const validVerification = filterValidFields(tempMergedItem.data.itemType, enrichmentResult.result);
          
          if (Object.keys(validVerification).length > 0) {
            finalDraft = { ...finalDraft, ...validVerification };
              addNotification(`Found metadata from ${enrichmentResult.source}!`, 'success');
          } else {
            addNotification('No additional metadata found. Proceeding with merge.', 'info');
            }
          } else {
            addNotification('No metadata found in bibliographic databases. Proceeding with merge.', 'info');
          }
        } catch (e: any) {
          console.warn('Metadata search during merge failed:', e);
          addNotification('Metadata search failed, proceeding with merge anyway', 'info');
        }
      }
      
      const updatedItem = await safeUpdate(mergeMaster, finalDraft);
      
      const others = activeMergeGroup.items.filter(i => i.key !== mergeMaster.key);
      for (const item of others) {
        try {
          await deleteItem(config, item.key, item.version);
        } catch (e) {
          console.warn(`Item ${item.key} may have been removed already`);
        }
      }
      
      setAllItems(prev => {
        const filtered = prev.filter(p => !others.find(o => o.key === p.key));
        return filtered.map(f => f.key === updatedItem.key ? updatedItem : f);
      });
      
      // Check final state for missing fields
      const finalMissing = checkMissingCitationFields(updatedItem);
      if (finalMissing.required.length > 0) {
        const requiredMsg = `Missing required fields: ${finalMissing.required.join(', ')}`;
        addNotification(`Merge completed. ${requiredMsg}`, 'info');
      } else if (finalMissing.recommended.length > 0) {
        const recommendedMsg = `Missing recommended fields: ${finalMissing.recommended.join(', ')}`;
        addNotification(`Merge completed. ${recommendedMsg}`, 'info');
      } else {
        addNotification('Merge completed successfully! All citation fields complete.', 'success');
      }
      
      setActiveMergeGroup(null);
      setMergeMaster(null);
      setMergeDraft(null);
      setStreamlinedMode(false);
      setStreamlinedVerification(null);
      setStreamlinedFlags([]);
    } catch (e: any) {
      addNotification(`Merge failed: ${e.message}`, 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STREAMLINED MERGE
  // ─────────────────────────────────────────────────────────────────────────────

  const autoMergeDuplicates = (group: DuplicateGroup): Partial<ZoteroItemData> => {
    if (group.items.length === 0) return {};
    
    // Start with the first item as base
    const base = group.items[0].data;
    const merged: Partial<ZoteroItemData> = { ...base };
    
    // Merge creators - combine unique creators from all items
    const creatorMap = new Map<string, ZoteroCreator>();
    group.items.forEach(item => {
      item.data.creators?.forEach(creator => {
        const key = creator.name || `${creator.lastName || ''},${creator.firstName || ''}`;
        if (key && !creatorMap.has(key)) {
          creatorMap.set(key, { ...creator });
        }
      });
    });
    merged.creators = Array.from(creatorMap.values());
    
    // For other fields, take the longest/most complete value
    const fieldsToMerge = ['title', 'abstractNote', 'DOI', 'ISBN', 'publisher', 'publicationTitle', 'volume', 'issue', 'pages', 'date'];
    
    fieldsToMerge.forEach(field => {
      let bestValue = (merged as any)[field] || '';
      let bestLength = bestValue ? String(bestValue).length : 0;
      
      group.items.forEach(item => {
        const value = (item.data as any)[field];
        if (value) {
          const strValue = String(value);
          // Prefer longer values, or DOI/ISBN if available
          if (field === 'DOI' || field === 'ISBN') {
            if (strValue && !bestValue) {
              bestValue = strValue;
              bestLength = strValue.length;
            }
          } else if (strValue.length > bestLength) {
            bestValue = strValue;
            bestLength = strValue.length;
          }
        }
      });
      
      if (bestValue) {
        (merged as any)[field] = bestValue;
      }
    });
    
    return merged;
  };

  const startStreamlinedMerge = async (group: DuplicateGroup) => {
    if (!geminiApiKey) {
      addNotification('Gemini API key required for streamlined merge', 'error');
      return;
    }
    
    setIsProcessingAI(true);
    setStreamlinedMode(true);
    
    try {
      // Step 1: Auto-merge data from all duplicates
      addNotification('Merging duplicate data...', 'info');
      const mergedData = autoMergeDuplicates(group);
      
      // Use first item as master
      const masterItem = group.items[0];
      setMergeMaster(masterItem);
      setMergeDraft(mergedData);
      
      // Step 2: Create a temporary item for verification
      const tempItem: ZoteroItem = {
        ...masterItem,
        data: { ...masterItem.data, ...mergedData } as ZoteroItemData
      };
      
      // Step 3: Search for missing metadata from bibliographic databases
      addNotification('Searching bibliographic databases for missing metadata...', 'info');
      const enrichmentResult = await enrichItemMetadataHybrid(tempItem, geminiApiKey);
      const validVerification = enrichmentResult 
        ? filterValidFields(tempItem.data.itemType, enrichmentResult.result)
        : {};
      
      // Step 4: Check for missing citation fields in merged result
      const mergedWithVerification = { ...mergedData, ...validVerification };
      const tempMergedItem: ZoteroItem = {
        ...masterItem,
        data: { ...masterItem.data, ...mergedWithVerification } as ZoteroItemData
      };
      const missing = checkMissingCitationFields(tempMergedItem);
      
      // Update flags to include missing required/recommended fields
      const allFlags = [...missing.required, ...missing.recommended];
      setStreamlinedVerification(validVerification);
      setStreamlinedFlags(allFlags);
      
      // Apply verification to draft
      setMergeDraft(prev => ({ ...prev, ...validVerification }));
      
      if (missing.required.length > 0) {
        addNotification(`Streamlined merge complete. Missing required fields: ${missing.required.join(', ')}`, 'info');
      } else if (missing.recommended.length > 0) {
        addNotification(`Streamlined merge complete. Missing recommended fields: ${missing.recommended.join(', ')}`, 'info');
      } else {
        addNotification('Streamlined merge complete! All citation fields present.', 'success');
      }
    } catch (e: any) {
      addNotification(`Streamlined merge failed: ${e.message}`, 'error');
      setStreamlinedMode(false);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VERIFICATION REPORT
  // ─────────────────────────────────────────────────────────────────────────────

  const generateVerificationReport = useCallback(() => {
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('ZOTERO LIBRARY VERIFICATION REPORT');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    // Pending Category Suggestions
    // AI Categorizer and Tag Standardizer removed - these sections are no longer generated
    // if (false && orgSuggestions.length > 0) { ... }
    // if (tagClusters.length > 0) { ... }

    // Pending Metadata Repairs
    const pendingRepairKeys = Object.keys(pendingRepairs);
    if (pendingRepairKeys.length > 0) {
      lines.push('🔧 PENDING METADATA REPAIRS');
      lines.push('───────────────────────────────────────────────────────────');
      lines.push(`${pendingRepairKeys.length} item(s) have suggested metadata repairs:`);
      lines.push('');
      
      pendingRepairKeys.forEach((itemKey, idx) => {
        const item = bibItems.find(i => i.key === itemKey);
        if (!item) return;
        
        const repair = pendingRepairs[itemKey];
        const repairFields = Object.keys(repair);
        
        lines.push(`${idx + 1}. "${item.data.title || 'Untitled'}"`);
        lines.push(`   Item Key: ${itemKey}`);
        lines.push(`   Item Type: ${item.data.itemType}`);
        if (item.data.creators && item.data.creators.length > 0) {
          const creatorStr = item.data.creators.map(c => {
            if (c.name) return c.name;
            return [c.firstName, c.lastName].filter(Boolean).join(' ') || '';
          }).filter(Boolean).join(', ');
          lines.push(`   Authors: ${creatorStr}`);
        }
        lines.push('');
        lines.push('   Changes to be applied:');
        repairFields.forEach(field => {
          const currentValue = (item.data as any)[field] || '—';
          const newValue = repair[field as keyof EnrichmentResult] || '';
          lines.push(`   • ${field}:`);
          lines.push(`     Current: ${typeof currentValue === 'string' ? currentValue.substring(0, 100) : currentValue}`);
          lines.push(`     New: ${typeof newValue === 'string' ? newValue.substring(0, 100) : newValue}`);
        });
        
        // Check what's still missing after applying repairs
        const tempItem: ZoteroItem = {
          ...item,
          data: { ...item.data, ...repair } as ZoteroItemData
        };
        const missing = checkMissingCitationFields(tempItem);
        if (missing.required.length > 0 || missing.recommended.length > 0) {
          lines.push('');
          lines.push('   ⚠️  Still missing after repair:');
          if (missing.required.length > 0) {
            lines.push(`   • Required fields: ${missing.required.join(', ')}`);
          }
          if (missing.recommended.length > 0) {
            lines.push(`   • Recommended fields: ${missing.recommended.join(', ')}`);
          }
        }
        lines.push('');
      });
    }

    // Items Still Needing Verification
    const unverifiedItems = issuesList.filter(({ item }) => !pendingRepairs[item.key]);
    if (unverifiedItems.length > 0) {
      lines.push('❓ ITEMS STILL NEEDING VERIFICATION');
      lines.push('───────────────────────────────────────────────────────────');
      lines.push(`${unverifiedItems.length} item(s) have issues but have not been verified yet:`);
      lines.push('');
      unverifiedItems.slice(0, 50).forEach(({ item, issues }, idx) => {
        lines.push(`${idx + 1}. "${item.data.title || 'Untitled'}"`);
        lines.push(`   Item Key: ${item.key}`);
        if (item.data.creators && item.data.creators.length > 0) {
          const creatorStr = item.data.creators.map(c => {
            if (c.name) return c.name;
            return [c.firstName, c.lastName].filter(Boolean).join(' ') || '';
          }).filter(Boolean).join(', ');
          lines.push(`   Authors: ${creatorStr}`);
        }
        lines.push(`   Issues: ${issues.map(i => `${i.field} (${i.severity})`).join(', ')}`);
        lines.push('');
      });
      if (unverifiedItems.length > 50) {
        lines.push(`   ... and ${unverifiedItems.length - 50} more items`);
        lines.push('');
      }
    }

    // Duplicate Groups
    if (duplicatesList.length > 0) {
      lines.push('📑 DUPLICATE GROUPS');
      lines.push('───────────────────────────────────────────────────────────');
      lines.push(`${duplicatesList.length} duplicate group(s) need to be merged:`);
      lines.push('');
      duplicatesList.forEach((group, idx) => {
        lines.push(`${idx + 1}. ${group.items.length} duplicate(s) - Matched by: ${group.reason}`);
        lines.push(`   Title: "${group.items[0].data.title || 'Untitled'}"`);
        if (group.items[0].meta.creatorSummary) {
          lines.push(`   Authors: ${group.items[0].meta.creatorSummary}`);
        }
        lines.push(`   Item Keys: ${group.items.map(i => i.key).join(', ')}`);
        lines.push('');
      });
    }

    // Summary
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('SUMMARY');
    lines.push('═══════════════════════════════════════════════════════════════');
    // AI Categorizer and Tag Standardizer removed - no longer tracking these
    // lines.push(`Pending Category Suggestions: 0`);
    // lines.push(`Pending Tag Merges: 0`);
    lines.push(`Pending Metadata Repairs: ${pendingRepairKeys.length}`);
    lines.push(`Items Needing Verification: ${unverifiedItems.length}`);
    lines.push(`Duplicate Groups: ${duplicatesList.length}`);
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }, [pendingRepairs, issuesList, duplicatesList, bibItems]);

  const handleShowVerificationReport = useCallback(() => {
    const report = generateVerificationReport();
    setVerificationReport(report);
    setShowVerificationReport(true);
  }, [generateVerificationReport]);

  const handleCopyReportToClipboard = useCallback(async () => {
    if (!verificationReport) return;
    try {
      await navigator.clipboard.writeText(verificationReport);
      addNotification('Report copied to clipboard!', 'success');
    } catch (err) {
      addNotification('Failed to copy to clipboard', 'error');
    }
  }, [verificationReport, addNotification]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleCard = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSection = (section: 'categorizer' | 'tags' | 'metadata' | 'overview') => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  if (!config) {
    return (
      <div className="app">
        <SetupPanel onComplete={loadItems} error={error} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app">
        <ProgressPanel current={progress.current} total={progress.total} />
      </div>
    );
  }

  return (
    <div className="app with-sidebar">
      {/* Toast notifications removed - using inline confirmations instead */}

      {/* Merge Modal */}
      {activeMergeGroup && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => !isProcessingAI && setActiveMergeGroup(null)} />
          <div className="merge-modal">
            <div className="modal-header">
              <div className="modal-title">
                <div className="modal-icon"><Icons.Merge /></div>
                <div>
                  <h3>{mergeMaster ? 'Refine Merged Record' : 'Select Master Record'}</h3>
                  <p>{mergeMaster 
                    ? `Merging ${activeMergeGroup.items.length - 1} records into master`
                    : `Comparing ${activeMergeGroup.items.length} duplicate records`}</p>
                </div>
              </div>
              <div className="modal-actions">
                {mergeMaster && (
                  <button className="btn-secondary" onClick={() => setMergeMaster(null)}>
                    Back to Selection
                  </button>
                )}
                <button className="btn-icon" onClick={() => setActiveMergeGroup(null)}>
                  <Icons.Close />
                </button>
              </div>
            </div>
            
            <div className="modal-body">
              {!mergeMaster ? (
                <div>
                  <div className="merge-mode-selector">
                    <button 
                      className="btn-primary"
                      onClick={() => startStreamlinedMerge(activeMergeGroup)}
                      disabled={isProcessingAI || !geminiApiKey}
                    >
                      {isProcessingAI ? <span className="spinner"></span> : <Icons.Sparkles />}
                      Streamlined Merge (Auto + AI Verify)
                    </button>
                    <p className="merge-mode-hint">Automatically merge all duplicates and verify with AI</p>
                  </div>
                  <div className="duplicate-compare">
                    <div className="compare-header-text">
                      <h4>Or select a master record manually:</h4>
                    </div>
                    {activeMergeGroup.items.map(item => (
                      <div key={item.key} className="compare-card">
                        <div className="compare-header">
                          <span className="item-key">ID: {item.key}</span>
                          <button className="btn-delete-small" onClick={() => handleDeleteItem(item)}>
                            <Icons.Trash />
                          </button>
                        </div>
                        <h4>{item.data.title || 'Untitled'}</h4>
                        <p className="creators">{item.meta.creatorSummary || 'Unknown authors'}</p>
                        <div className="compare-meta">
                          {item.data.date && <span className="date">{item.data.date}</span>}
                          {item.data.DOI && <span className="doi">DOI: {item.data.DOI}</span>}
                          {item.data.ISBN && <span className="isbn">ISBN: {item.data.ISBN}</span>}
                        </div>
                        <p className="abstract">
                          {item.data.abstractNote 
                            ? `${item.data.abstractNote.substring(0, 150)}...`
                            : 'No abstract'}
                        </p>
                        <button className="btn-select" onClick={() => startRefiningMerge(activeMergeGroup, item)}>
                          Select as Master
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="merge-editor">
                  {activeMergeGroup && (
                    <>
                      {!streamlinedMode ? (
                        <div className="field-selection-grid">
                        <div className="field-selection-header">
                          <div className="field-label-col">Field</div>
                          {activeMergeGroup.items.map((item, idx) => (
                            <div key={item.key} className="field-source-col">
                              <div className="source-header">
                                <span className="source-id">Item {idx + 1}</span>
                                {idx === activeMergeGroup.items.findIndex(i => i.key === mergeMaster?.key) && (
                                  <span className="master-badge">Master</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {[
                          { key: 'title', label: 'Title', type: 'textarea' },
                          { key: 'creators', label: 'Authors/Creators', type: 'text' },
                          { key: 'date', label: 'Date', type: 'text' },
                          { key: 'DOI', label: 'DOI', type: 'text' },
                          { key: 'ISBN', label: 'ISBN', type: 'text' },
                          { key: 'publisher', label: 'Publisher', type: 'text' },
                          { key: 'publicationTitle', label: 'Publication', type: 'text' },
                          { key: 'volume', label: 'Volume', type: 'text' },
                          { key: 'issue', label: 'Issue', type: 'text' },
                          { key: 'pages', label: 'Pages', type: 'text' },
                          { key: 'abstractNote', label: 'Abstract', type: 'textarea' }
                        ].map(field => (
                          <div key={field.key} className="field-selection-row">
                            <div className="field-label-col">
                              <label>{field.label}</label>
                            </div>
                            {activeMergeGroup.items.map((item, idx) => {
                              const isSelected = fieldSelections[field.key] === idx;
                              const value = getFieldValue(item, field.key);
                              const displayValue = field.type === 'textarea' && value.length > 100 
                                ? `${value.substring(0, 100)}...` 
                                : value;
                              
                              return (
                                <div 
                                  key={item.key} 
                                  className={`field-source-col ${isSelected ? 'selected' : ''}`}
                                >
                                  <button
                                    className="field-source-btn"
                                    onClick={() => selectFieldSource(field.key, idx)}
                                    title={`Select ${field.label} from Item ${idx + 1}`}
                                  >
                                    <div className="field-source-value">
                                      {field.type === 'textarea' ? (
                                        <div className="field-textarea-preview">{displayValue}</div>
                                      ) : (
                                        <span className={value === '—' ? 'field-empty' : ''}>{displayValue}</span>
                                      )}
                                    </div>
                                    {isSelected && <Icons.Check />}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      ) : (
                        <div className="streamlined-summary">
                          <p className="streamlined-info">✅ Automatically merged data from {activeMergeGroup.items.length} duplicates</p>
                          <p className="streamlined-info">✅ Verified with AI and added missing metadata</p>
                          {mergeDraft && mergeMaster && (() => {
                            const mergedItem: ZoteroItem = {
                              ...mergeMaster,
                              data: { ...mergeMaster.data, ...mergeDraft } as ZoteroItemData
                            };
                            const missing = checkMissingCitationFields(mergedItem);
                            if (missing.required.length > 0 || missing.recommended.length > 0) {
                              return (
                                <div className="streamlined-warnings">
                                  {missing.required.length > 0 && (
                                    <p className="streamlined-warning required">
                                      ⚠️ Missing required fields: {missing.required.join(', ')}
                                    </p>
                                  )}
                                  {missing.recommended.length > 0 && (
                                    <p className="streamlined-warning recommended">
                                      ℹ️ Missing recommended fields: {missing.recommended.join(', ')}
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      
                      <div className="merged-preview">
                        <h4>Merged Result Preview{streamlinedMode && ' (Streamlined)'}</h4>
                        {mergeDraft && mergeMaster && (() => {
                          const mergedItem: ZoteroItem = {
                            ...mergeMaster,
                            data: { ...mergeMaster.data, ...mergeDraft } as ZoteroItemData
                          };
                          const missing = checkMissingCitationFields(mergedItem);
                          return (
                            <>
                              {missing.required.length > 0 && (
                                <div className="verification-flags required">
                                  <strong>⚠️ Missing Required Fields:</strong>
                                  <div className="flags-list">
                                    {missing.required.map(flag => (
                                      <span key={flag} className="flag-badge required">{flag}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {missing.recommended.length > 0 && (
                                <div className="verification-flags recommended">
                                  <strong>ℹ️ Missing Recommended Fields:</strong>
                                  <div className="flags-list">
                                    {missing.recommended.map(flag => (
                                      <span key={flag} className="flag-badge recommended">{flag}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <div className="preview-content">
                          <div className="preview-field">
                            <strong>Title:</strong> {mergeDraft?.title || '—'}
                          </div>
                          <div className="preview-field">
                            <strong>Authors:</strong> {mergeDraft?.creators?.length 
                              ? mergeDraft.creators.map(c => {
                                  if (c.name) return c.name;
                                  const parts = [c.firstName, c.lastName].filter(Boolean);
                                  return parts.length > 0 ? parts.join(' ') : '';
                                }).filter(Boolean).join(', ') 
                              : '—'}
                          </div>
                          <div className="preview-field">
                            <strong>Date:</strong> {mergeDraft?.date || '—'}
                          </div>
                          <div className="preview-field">
                            <strong>DOI:</strong> {mergeDraft?.DOI || '—'}
                          </div>
                          {(mergeDraft?.abstractNote || mergeDraft?.ISBN || mergeDraft?.publisher) && (
                            <div className="preview-field">
                              <strong>Additional:</strong> {[mergeDraft?.ISBN && `ISBN: ${mergeDraft.ISBN}`, mergeDraft?.publisher && `Publisher: ${mergeDraft.publisher}`, mergeDraft?.abstractNote && `Abstract: ${mergeDraft.abstractNote.substring(0, 100)}...`].filter(Boolean).join(' | ')}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="merge-actions">
                        <button 
                          className="btn-primary"
                          onClick={executeFinalMerge}
                          disabled={isProcessingAI}
                        >
                          {isProcessingAI ? <span className="spinner"></span> : <Icons.Merge />}
                          Merge &amp; Delete Duplicates
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verification Report Modal */}
      {showVerificationReport && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowVerificationReport(false)} />
          <div className="merge-modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <div className="modal-icon modal-icon-info">
                  <Icons.Clipboard />
                </div>
                <div>
                  <h3>Verification Report</h3>
                  <p>Summary of pending changes and items needing verification</p>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleCopyReportToClipboard}>
                  <Icons.Clipboard />
                  Copy to Clipboard
                </button>
                <button className="btn-icon" onClick={() => setShowVerificationReport(false)}>
                  <Icons.Close />
                </button>
              </div>
            </div>
            
            <div className="modal-body">
              <div style={{ 
                background: 'var(--bg-secondary)', 
                padding: '1.5rem', 
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                maxHeight: '70vh',
                overflow: 'auto',
                border: '1px solid var(--border)'
              }}>
                {verificationReport || 'Generating report...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="top-nav">
        <div className="nav-brand">
          <div className="nav-logo">
            <Icons.Library />
          </div>
          <span className="nav-title">Zotero Architect</span>
        </div>
        
        <nav className="nav-tabs">
            <button 
            className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Home
          </button>
          <button 
            className={`nav-tab ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            Library
          </button>
          <button 
            className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button 
            className={`nav-tab ${activeTab === 'citations' ? 'active' : ''}`}
            onClick={() => setActiveTab('citations')}
          >
            Citations
          </button>
          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
        
        <div className="nav-status">
          {config && (
            <span className="connection-status">
              Connected
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Content will be tab-specific, no global header */}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* HOME TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'home' && config && (
          <div className="home-tab">
            {/* Connection Status */}
            <div className="connection-card">
              <div className="connection-info">
                <span className="connection-label">Connected to</span>
                <span className="library-name">{config.libraryType === 'user' ? 'My Library' : `Group ${config.libraryId}`}</span>
              </div>
              <button className="btn-text" onClick={() => setConfig(null)}>Disconnect</button>
            </div>
            
            {/* Library Overview - Collapsible */}
            <details className="overview-section" open>
              <summary className="overview-header">
                <span>Library Overview</span>
                <Icons.Chevron />
              </summary>
              <div className="overview-stats">
                <span className="stat">{allItems.length} items</span>
                <span className="stat-separator">·</span>
                <span className="stat">{issuesList.length} could use attention</span>
                <span className="stat-separator">·</span>
                <span className="stat">{duplicatesList.length} potential duplicates</span>
              </div>
            </details>
            
            {/* Quick Actions */}
            <div className="quick-actions">
              <button className="action-card" onClick={() => { setFilterMode('incomplete'); setActiveTab('library'); }}>
                <div className="action-content">
                  <h3>Review Metadata</h3>
                  <p>{issuesList.length} items have incomplete fields</p>
                </div>
                <span className="action-arrow">→</span>
            </button>
              
              <button className="action-card" onClick={() => { setFilterMode('duplicates'); setActiveTab('library'); }}>
                <div className="action-content">
                  <h3>Check Duplicates</h3>
                  <p>{duplicatesList.length} potential duplicate groups</p>
                </div>
                <span className="action-arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* LIBRARY TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'library' && (
          <div className={`library-tab ${showChatOverlay ? 'chat-open' : ''}`}>
            {/* Search and Filter Bar */}
            <div className="library-toolbar">
              <div className="search-box">
                <div className="search-icon"><Icons.Search /></div>
                <input
                  type="text"
                  placeholder="Search titles, authors, DOIs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => setSearchQuery('')}>
                    <Icons.X />
                  </button>
                )}
              </div>
              
              <div className="filter-controls">
                <span className="filter-label">Show:</span>
                <select 
                  className="filter-select"
                  value={filterMode} 
                  onChange={(e) => setFilterMode(e.target.value as typeof filterMode)}
                >
                  <option value="all">All items</option>
                  <option value="incomplete">Incomplete metadata</option>
                  <option value="untagged">Untagged items</option>
                  <option value="duplicates">Duplicates</option>
                  <option value="recent">Recent</option>
                  <option value="reviewed">Reviewed</option>
                  {allTags.length > 0 && <option value="tag">By tag...</option>}
                </select>
                {filterMode === 'tag' && allTags.length > 0 && (
                  <select 
                    className="filter-select"
                    value={selectedTag || ''}
                    onChange={(e) => {
                      setSelectedTag(e.target.value || null);
                      if (!e.target.value) setFilterMode('all');
                    }}
                    style={{ width: '180px', marginLeft: '0.5rem' }}
                  >
                    <option value="">Select tag...</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                )}
                
                <span className="filter-label">Sort:</span>
                <select 
                  className="filter-select"
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="dateAdded">Date</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="completeness">Complete</option>
                </select>
                <button 
                  className="sort-order-btn"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
              
              <button
                className="chat-toggle-btn"
                onClick={() => setShowChatOverlay(!showChatOverlay)}
                title="Chat with your library"
              >
                <Icons.Message />
                <span>Chat</span>
              </button>
        </div>
        
            {/* Batch Actions Bar */}
            <div className="batch-bar">
              <label className="select-all">
                <input 
                  type="checkbox"
                  checked={filterMode === 'duplicates' ? false : (selectedItems.size === filteredItems.length && filteredItems.length > 0)}
                  onChange={(e) => {
                    if (filterMode === 'duplicates') return;
                    if (e.target.checked) {
                      setSelectedItems(new Set(filteredItems.map(item => item.key)));
                    } else {
                      setSelectedItems(new Set());
                    }
                  }}
                />
                <span>Select all ({filterMode === 'duplicates' ? duplicatesList.length : filteredItems.length} items)</span>
              </label>
              
              {selectedItems.size > 0 && (
                <div className="batch-actions">
                  <span className="selected-count">{selectedItems.size} selected</span>
                  <button 
                    className="btn-secondary btn-sm"
                    onClick={handleBatchVerify}
                    disabled={!geminiApiKey || isProcessingAI}
                  >
                    Verify Selected
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={handleBatchTag}
                    disabled={!geminiApiKey || isTagging}
                  >
                    {isTagging ? (
                      <><span className="spinner small" /> Tagging...</>
                    ) : (
                      <>Tag Selected</>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {/* Item List - changes based on filterMode */}
            <div className="item-list">
              {filterMode === 'duplicates' ? (
                // Render duplicate groups
                <div className="duplicate-groups">
                  {duplicatesList.map(group => (
                    <button 
                      key={group.id}
                      className="duplicate-group-card"
                      onClick={() => setActiveMergeGroup(group)}
                    >
                      <div className="group-info">
                        <span className="group-count">{group.items.length} similar items</span>
                        <h4 className="group-title">{group.items[0].data.title || 'Untitled'}</h4>
                        <div className="group-authors">
                          {group.items.map(item => 
                            item.data.creators?.[0]?.lastName || 'Unknown'
                          ).join(' · ')}
                        </div>
                      </div>
                      <span className="group-action">Review →</span>
          </button>
                  ))}
                  
                  {duplicatesList.length === 0 && (
                    <div className="empty-state">
                      <p>No potential duplicates found in your library.</p>
        </div>
                  )}
                </div>
              ) : (
                // Render flat item list
                filteredItems.length > 0 ? (
                  filteredItems.map(item => {
                    const issues = allIssuesList.find(i => i.item.key === item.key)?.issues || [];
                    const missingFields = checkMissingCitationFields(item);
                    const missingFieldsList = [...missingFields.required, ...missingFields.recommended];
                    const repair = pendingRepairs[item.key];
                    const verificationReport = verificationReports[item.key];
                    const isExpanded = expandedCards.has(item.key);
                    const isSelected = selectedItems.has(item.key);
                    
                    return (
                      <div key={item.key} data-item-key={item.key} className={`item-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}>
                        <div className="item-header" onClick={() => toggleCard(item.key)}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedItems(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(item.key);
                                else next.delete(item.key);
                                return next;
                              });
                            }}
                            className="item-checkbox"
                          />
                          
                          <button className="expand-btn">
                            {isExpanded ? <Icons.Chevron /> : <Icons.Chevron />}
                          </button>
                          
                          <div className="item-info">
                            <h4 className="item-title">{item.data.title || 'Untitled'}</h4>
                            <div className="item-meta">
                              {item.data.creators && item.data.creators.length > 0 && (
                                <span className="item-authors">
                                  {item.data.creators.map(c => c.lastName || c.name).filter(Boolean).join(', ')}
                                </span>
                              )}
                              {item.data.date && <span className="item-date">({item.data.date})</span>}
                              {item.data.publicationTitle && (
                                <span className="item-journal">{item.data.publicationTitle}</span>
                              )}
          </div>
                            
                            {missingFieldsList.length > 0 && (
                              <div className="missing-fields-hint">
                                Could add: {missingFieldsList.slice(0, 3).join(' · ')}
                              </div>
                            )}
                            
                            {/* Tags Display */}
                            {item.data.tags && item.data.tags.length > 0 && (
                              <div className="item-tags">
                                {item.data.tags.slice(0, 5).map((tag, idx) => (
                                  <button
                                    key={idx}
                                    className="tag-chip"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTag(tag.tag);
                                      setFilterMode('tag');
                                    }}
                                    title={`Filter by: ${tag.tag}`}
                                  >
                                    {tag.tag}
                                  </button>
                                ))}
                                {item.data.tags.length > 5 && (
                                  <span className="tag-more">+{item.data.tags.length - 5}</span>
                                )}
                              </div>
                            )}
                            {(!item.data.tags || item.data.tags.length === 0) && (
                              <div className="item-tags-empty">
                                <span className="tag-hint">No tags</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="item-actions">
                            {reviewedItems.has(item.key) ? (
                              <button 
                                className="btn-text btn-sm" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setReviewedItems(prev => {
                                    const next = new Set(prev);
                                    next.delete(item.key);
                                    return next;
                                  });
                                }}
                                title="Move back to main list"
                              >
                                Move Back
                              </button>
                            ) : (
                              <button
                                className="btn-secondary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startVerifyingMetadata(item);
                                }}
                                disabled={!geminiApiKey || processingItemKey === item.key}
                              >
                                {processingItemKey === item.key ? (
                                  <><span className="spinner small" /> Verifying...</>
                                ) : (
                                  'Verify'
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="item-body">
                            {/* Current Metadata Section */}
                            <div className="metadata-section">
                              <h5>Current Metadata</h5>
                              <div className="metadata-grid">
                                <div className="metadata-label">Title</div>
                                <div className="metadata-value">{item.data.title || '—'}</div>
                                <div></div>
                                
                                <div className="metadata-label">Authors</div>
                                <div className="metadata-value">
                                  {item.data.creators && item.data.creators.length > 0
                                    ? item.data.creators.map(c => {
                                        if (c.name) return c.name;
                                        return [c.lastName, c.firstName].filter(Boolean).join(', ');
                                      }).join('; ')
                                    : '—'}
                                </div>
                                <button className="metadata-action" onClick={() => {/* TODO: open editor */}}>Edit</button>
                                
                                <div className="metadata-label">Date</div>
                                <div className="metadata-value">{item.data.date || '—'}</div>
                                <div></div>
                                
                                <div className="metadata-label">Publication</div>
                                <div className="metadata-value">{item.data.publicationTitle || item.data.bookTitle || '—'}</div>
                                <div></div>
                                
                                <div className="metadata-label">Volume</div>
                                <div className="metadata-value">{item.data.volume || '—'}</div>
                                <div></div>
                                
                                <div className="metadata-label">Issue</div>
                                <div className="metadata-value">{item.data.issue || '—'}</div>
                                <div></div>
                                
                                <div className="metadata-label">Pages</div>
                                <div className="metadata-value">{item.data.pages || '—'}</div>
                                <div></div>
                                
                                <div className="metadata-label">DOI</div>
                                <div className={`metadata-value ${!item.data.DOI ? 'empty' : ''}`}>{item.data.DOI || '—'}</div>
                                {!item.data.DOI && <button className="metadata-action">+ Add</button>}
                                
                                {/* Abstract Section - Full Width */}
                                <div className="metadata-full-width">
                                  <div className="metadata-label">Abstract</div>
                                  <div className={`metadata-value abstract-text ${!item.data.abstractNote ? 'empty' : ''}`}>
                                    {item.data.abstractNote || '—'}
                                  </div>
                                  {!item.data.abstractNote && (
                                    <button className="metadata-action">+ Add</button>
                                  )}
                                </div>
                                
                                {/* Tags Section - Full Width */}
                                <div className="metadata-full-width">
                                  <div className="tags-section-header">
                                    <div className="metadata-label">Tags</div>
                                    <button 
                                      className="btn-secondary btn-sm" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTagItem(item);
                                      }}
                                      disabled={!geminiApiKey || isTagging || processingItemKey === item.key}
                                    >
                                      {processingItemKey === item.key ? (
                                        <>
                                          <span className="spinner small"></span>
                                          Tagging...
                                        </>
                                      ) : tagSuggestions[item.key] ? (
                                        'Review Tags'
                                      ) : (
                                        'Suggest Tags'
                                      )}
                                    </button>
                                  </div>
                                  <div className="metadata-value">
                                    {item.data.tags && item.data.tags.length > 0 ? (
                                      <div className="tags-list">
                                        {item.data.tags.map((tag, idx) => {
                                          const isMarkedForRemoval = tagsToRemove[item.key]?.has(tag.tag.toLowerCase());
                                          return (
                                            <span 
                                              key={idx} 
                                              className={`tag-badge ${isMarkedForRemoval ? 'tag-removed' : ''}`}
                                            >
                                              {tag.tag}
                                              <button
                                                className="tag-remove-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setTagsToRemove(prev => {
                                                    const next = { ...prev };
                                                    if (!next[item.key]) next[item.key] = new Set();
                                                    if (isMarkedForRemoval) {
                                                      next[item.key].delete(tag.tag.toLowerCase());
                                                      if (next[item.key].size === 0) delete next[item.key];
                                                    } else {
                                                      next[item.key].add(tag.tag.toLowerCase());
                                                    }
                                                    return next;
                                                  });
                                                }}
                                                title={isMarkedForRemoval ? "Restore tag" : "Remove tag"}
                                              >
                                                {isMarkedForRemoval ? '↶' : '×'}
                                              </button>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span className="empty">No tags</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Tag Suggestions Section */}
                            {tagSuggestions[item.key] && (() => {
                              const selectedSet = selectedSuggestedTags[item.key] || new Set();
                              const hasChanges = selectedSet.size > 0 || (tagsToRemove[item.key]?.size || 0) > 0;
                              const existingTagSet = new Set((item.data.tags || []).map(t => t.tag.toLowerCase()));
                              
                              return (
                                <div className="suggestions-section">
                                  <div className="suggestions-header">
                                    <span className="suggestions-icon">🏷️</span>
                                    <span>Suggested Tags</span>
                                    <div className="suggestions-actions">
                                      {hasChanges && (
                                        <button 
                                          className="btn-primary btn-sm" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            applyTags(item.key);
                                          }}
                                        >
                                          Apply Changes
                                        </button>
                                      )}
                                      <button 
                                        className="btn-text btn-sm" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTagSuggestions(prev => {
                                            const next = { ...prev };
                                            delete next[item.key];
                                            return next;
                                          });
                                          setSelectedSuggestedTags(prev => {
                                            const next = { ...prev };
                                            delete next[item.key];
                                            return next;
                                          });
                                          setTagsToRemove(prev => {
                                            const next = { ...prev };
                                            delete next[item.key];
                                            return next;
                                          });
                                        }}
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                  <div className="suggestions-list">
                                    <div className="suggestion-row">
                                      <span className="suggestion-field">Tags</span>
                                      <div className="suggestion-value-editable">
                                        <div className="tags-suggested">
                                          {tagSuggestions[item.key].suggestedTags.map((tag, idx) => {
                                            const isSelected = selectedSet.has(tag.toLowerCase());
                                            const alreadyExists = existingTagSet.has(tag.toLowerCase());
                                            return (
                                              <label 
                                                key={idx} 
                                                className={`tag-suggestion ${isSelected ? 'tag-selected' : ''} ${alreadyExists ? 'tag-exists' : ''}`}
                                                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedSuggestedTags(prev => {
                                                      const next = { ...prev };
                                                      if (!next[item.key]) next[item.key] = new Set();
                                                      if (e.target.checked) {
                                                        next[item.key].add(tag.toLowerCase());
                                                      } else {
                                                        next[item.key].delete(tag.toLowerCase());
                                                        if (next[item.key].size === 0) delete next[item.key];
                                                      }
                                                      return next;
                                                    });
                                                  }}
                                                  style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                                                />
                                                <span>{tag}</span>
                                                {alreadyExists && <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>(exists)</span>}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div></div>
                                    </div>
                                    {tagSuggestions[item.key].reasoning && (
                                      <div className="tag-reasoning">
                                        <em>{tagSuggestions[item.key].reasoning}</em>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {/* Suggestions Section - Only shows after verification */}
                            {repair && Object.keys(repair).length > 0 && (
                              <div className="suggestions-section">
                                <div className="suggestions-header">
                                  <span className="suggestions-icon">💡</span>
                                  <span>Suggestions from verification</span>
                                  <div className="suggestions-actions">
                                    <button className="btn-primary btn-sm" onClick={() => {
                                      const editedRepair = { ...repair };
                                      if (editableSuggestions[item.key]) {
                                        Object.entries(editableSuggestions[item.key]).forEach(([field, editedValue]) => {
                                          editedRepair[field as keyof EnrichmentResult] = editedValue as any;
                                        });
                                      }
                                      applyAllSuggestions(item.key, editedRepair);
                                    }}>
                                      Apply All
                                    </button>
                                    <button className="btn-text btn-sm" onClick={() => clearSuggestions(item.key)}>
                                      Clear
                                    </button>
                                  </div>
                                </div>
                                <div className="suggestions-list">
                                  {Object.entries(repair).filter(([key]) => key !== 'creators' || Array.isArray(repair.creators)).map(([field, value]) => {
                                    const editableKey = `${item.key}-${field}`;
                                    const editedValue = editableSuggestions[item.key]?.[field] ?? value;
                                    const isCreators = field === 'creators' && Array.isArray(value);
                                    
                                    return (
                                      <div key={field} className="suggestion-row">
                                        <span className="suggestion-field">{field}</span>
                                        {isCreators ? (
                                          <div className="suggestion-value-editable">
                                            <textarea
                                              className="suggestion-input"
                                              value={editedValue.map((c: any) => `${c.firstName || ''} ${c.lastName || ''}`.trim()).filter(Boolean).join('\n')}
                                              onChange={(e) => {
                                                const lines = e.target.value.split('\n').filter(Boolean);
                                                const newCreators = lines.map(line => {
                                                  const parts = line.trim().split(/\s+/);
                                                  if (parts.length >= 2) {
                                                    return {
                                                      creatorType: 'author',
                                                      firstName: parts.slice(0, -1).join(' '),
                                                      lastName: parts[parts.length - 1]
                                                    };
                                                  } else if (parts.length === 1) {
                                                    return {
                                                      creatorType: 'author',
                                                      lastName: parts[0],
                                                      firstName: ''
                                                    };
                                                  }
                                                  return null;
                                                }).filter(Boolean);
                                                
                                                setEditableSuggestions(prev => ({
                                                  ...prev,
                                                  [item.key]: {
                                                    ...(prev[item.key] || {}),
                                                    [field]: newCreators.length > 0 ? newCreators : value
                                                  }
                                                }));
                                              }}
                                              placeholder="One author per line (First Last)"
                                              rows={Math.min(editedValue.length || 1, 5)}
                                            />
                                          </div>
                                        ) : (
                                          <div className="suggestion-value-editable">
                                            {typeof value === 'string' && value.length > 200 ? (
                                              <textarea
                                                className="suggestion-input"
                                                value={editedValue as string}
                                                onChange={(e) => {
                                                  setEditableSuggestions(prev => ({
                                                    ...prev,
                                                    [item.key]: {
                                                      ...(prev[item.key] || {}),
                                                      [field]: e.target.value
                                                    }
                                                  }));
                                                }}
                                                rows={4}
                                              />
                                            ) : (
                                              <input
                                                type="text"
                                                className="suggestion-input"
                                                value={editedValue as string}
                                                onChange={(e) => {
                                                  setEditableSuggestions(prev => ({
                                                    ...prev,
                                                    [item.key]: {
                                                      ...(prev[item.key] || {}),
                                                      [field]: e.target.value
                                                    }
                                                  }));
                                                }}
                                              />
                                            )}
                                          </div>
                                        )}
                                        {inlineConfirmations[`${item.key}-${field}`] ? (
                                          <span className="inline-success">✓ Saved</span>
                                        ) : (
                                          <button className="suggestion-apply" onClick={() => {
                                            const valueToApply = editableSuggestions[item.key]?.[field] ?? value;
                                            applySingleField(item.key, field, valueToApply);
                                          }}>
                                            Apply
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Verification Details - Collapsible */}
                            {verificationReport && (
                              <details className="verification-details">
                                <summary>View verification details</summary>
                                <div className="verification-tasks">
                                  {verificationReport.tasks.map((task: VerificationTask) => (
                                    <div key={task.id} className="task-row">
                                      <span className="task-status">
                                        {task.status === 'completed' ? '✓' : task.status === 'failed' ? '·' : '...'}
                                      </span>
                                      <span className="task-name">{task.name}</span>
                                      {task.status === 'failed' && task.error && (
                                        <span className="task-error">{task.error}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                            
                            {/* Accept/Decline Actions - Only show if there are suggestions */}
                            {repair && Object.keys(repair).length > 0 && !reviewedItems.has(item.key) && (
                              <div className="review-actions">
                                <button 
                                  className="btn-primary" 
                                  onClick={() => {
                                    const editedRepair = { ...repair };
                                    if (editableSuggestions[item.key]) {
                                      Object.entries(editableSuggestions[item.key]).forEach(([field, editedValue]) => {
                                        editedRepair[field as keyof EnrichmentResult] = editedValue as any;
                                      });
                                    }
                                    applyAllSuggestions(item.key, editedRepair);
                                    setReviewedItems(prev => new Set(prev).add(item.key));
                                    setEditableSuggestions(prev => {
                                      const next = { ...prev };
                                      delete next[item.key];
                                      return next;
                                    });
                                  }}
                                >
                                  Accept & Apply
                                </button>
              <button 
                className="btn-secondary"
                                  onClick={() => {
                                    setReviewedItems(prev => new Set(prev).add(item.key));
                                    clearSuggestions(item.key);
                                    setEditableSuggestions(prev => {
                                      const next = { ...prev };
                                      delete next[item.key];
                                      return next;
                                    });
                                  }}
                                >
                                  Decline
              </button>
                              </div>
                            )}
                            
                            {/* Citation Preview - Always visible */}
                            <div className="citation-section">
                              <div className="citation-header">
                                <span>Citation Preview</span>
                                <div className="citation-styles">
                                  {(['apa', 'mla', 'chicago'] as CitationStyle[]).map(style => {
                                    const selectedStyle = citationStyles[item.key] || 'apa';
                                    return (
                                      <button
                                        key={style}
                                        className={`style-btn ${selectedStyle === style ? 'active' : ''}`}
                                        onClick={() => {
                                          setCitationStyles(prev => ({ ...prev, [item.key]: style }));
                                        }}
                                      >
                                        {style.toUpperCase()}
                                      </button>
                                    );
                                  })}
                                </div>
                                <button className="btn-text btn-sm" onClick={() => {
                                  const currentItem = allItems.find(i => i.key === item.key) || item;
                                  const citation = formatCitation(currentItem, citationStyles[item.key] || 'apa');
                                  navigator.clipboard.writeText(citation.formatted);
                                  setInlineConfirmations(prev => ({ ...prev, [`${item.key}-copy`]: 'Copied' }));
                                  setTimeout(() => {
                                    setInlineConfirmations(prev => {
                                      const next = { ...prev };
                                      delete next[`${item.key}-copy`];
                                      return next;
                                    });
                                  }, 2000);
                                }}>
                                  {inlineConfirmations[`${item.key}-copy`] ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              <div className="citation-preview">
                                {(() => {
                                  const currentItem = allItems.find(i => i.key === item.key) || item;
                                  const citation = formatCitation(currentItem, citationStyles[item.key] || 'apa');
                                  return citation.formatted;
                                })()}
                              </div>
                            </div>
              </div>
            )}
          </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <p>No items found.</p>
                  </div>
                )
              )}
            </div>
            
            {/* Chat Overlay */}
            {showChatOverlay && (
              <div className="chat-overlay">
                <div className="chat-overlay-header">
                  <h3>Chat with Your Library</h3>
                  <button 
                    className="chat-close-btn"
                    onClick={() => setShowChatOverlay(false)}
                  >
                    <Icons.X />
                  </button>
                </div>
                
                <div className="chat-overlay-messages">
                  {chatMessages.length === 0 && (
                    <div className="chat-welcome">
                      <div className="welcome-icon">💬</div>
                      <h3>How can I help you?</h3>
                      <p>Try asking:</p>
                      <ul className="chat-examples">
                        {[
                          "Show me untagged items",
                          "How many items do I have?",
                          "Find items about machine learning",
                          "Tag all items with 'AI'",
                          "Show items missing DOIs"
                        ].map((example, idx) => (
                          <li key={idx}>
                            <button
                              className="example-query-btn"
                              onClick={() => handleChatQuery(example)}
                              disabled={!geminiApiKey || isProcessingChat}
                            >
                              "{example}"
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">
                        <div className="message-text">{msg.content}</div>
                        {msg.results && (
                          <div className="message-results">
                            {/* Show item list with clickable titles */}
                            {msg.results.items && Array.isArray(msg.results.items) && msg.results.items.length > 0 && (
                              <div className="chat-items-list">
                                {msg.results.count !== undefined && (
                                  <div className="items-count">
                                    Found {msg.results.count} item{msg.results.count !== 1 ? 's' : ''}
                                    {msg.results.count > msg.results.items.length && ` (showing ${msg.results.items.length})`}
                                  </div>
                                )}
                                <ul className="items-list">
                                  {msg.results.items.map((item: any, itemIdx: number) => (
                                    <li key={itemIdx} className="chat-item">
                                      <button
                                        className="item-link"
                                        onClick={() => {
                                          // Navigate to library first
                                          setActiveTab('library');
                                          
                                          // Determine filter based on missing fields
                                          if (item.missingFields && item.missingFields.length > 0) {
                                            if (item.missingFields.some((f: string) => f.toLowerCase().includes('doi'))) {
                                              setFilterMode('incomplete');
                                              setSearchQuery('DOI');
                                            } else {
                                              setFilterMode('incomplete');
                                              setSearchQuery('');
                                            }
                                          } else {
                                            // If no missing fields, search by title to find the item
                                            setFilterMode('all');
                                            setSearchQuery(item.title);
                                          }
                                          
                                          // Select and expand the item after a short delay to allow filter to apply
                                          setTimeout(() => {
                                            setSelectedItems(new Set([item.key]));
                                            setExpandedCards(prev => new Set(prev).add(item.key));
                                            
                                            // Scroll to item - try multiple selectors
                                            const element = document.querySelector(`[data-item-key="${item.key}"]`) as HTMLElement;
                                            if (element) {
                                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                              // Highlight the item briefly
                                              element.style.transition = 'background-color 0.3s';
                                              const originalBg = element.style.backgroundColor;
                                              element.style.backgroundColor = 'var(--accent-light)';
                                              setTimeout(() => {
                                                element.style.backgroundColor = originalBg || '';
                                              }, 2000);
                                            } else {
                                              // Fallback: try to find by title in the filtered list
                                              const allCards = document.querySelectorAll('.item-card');
                                              for (const card of Array.from(allCards)) {
                                                const titleEl = card.querySelector('.item-title');
                                                if (titleEl && titleEl.textContent?.trim() === item.title.trim()) {
                                                  (card as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                  break;
                                                }
                                              }
                                            }
                                          }, 200);
                                        }}
                                      >
                                        <span className="item-title">{item.title}</span>
                                        {item.authors && (
                                          <span className="item-authors"> — {item.authors}</span>
                                        )}
                                        {item.year && (
                                          <span className="item-year"> ({item.year})</span>
                                        )}
                                      </button>
                                      {item.missingFields && item.missingFields.length > 0 && (
                                        <div className="item-missing">
                                          Missing: {item.missingFields.slice(0, 3).join(', ')}
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Tag action button */}
                            {msg.action === 'tag' && msg.results.itemKeys && !msg.results.applied && (
                              <div className="result-action">
                                <button
                                  className="btn-primary btn-sm"
                                  onClick={async () => {
                                    if (!config) return;
                                    const tags = msg.results.tags || [];
                                    const itemKeys = msg.results.itemKeys || [];
                                    
                                    for (const itemKey of itemKeys) {
                                      const item = allItems.find(i => i.key === itemKey);
                                      if (!item) continue;
                                      
                                      const existingTags = item.data.tags || [];
                                      const newTags = tags.map(tag => ({ tag, type: 1 }));
                                      const combinedTags = [...existingTags, ...newTags];
                                      const uniqueTags = Array.from(
                                        new Map(combinedTags.map(t => [t.tag.toLowerCase(), t])).values()
                                      );
                                      
                                      try {
                                        const updated = await safeUpdate(item, { tags: uniqueTags });
                                        setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
                                      } catch (e) {
                                        console.error('Failed to apply tags:', e);
                                      }
                                    }
                                    
                                    setChatMessages(prev => prev.map((m, i) => 
                                      i === idx ? { ...m, results: { ...m.results, applied: true } } : m
                                    ));
                                  }}
                                >
                                  Apply Tags to {msg.results.items || msg.results.itemKeys?.length || 0} Items
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isProcessingChat && (
                    <div className="chat-message assistant">
                      <div className="message-content">
                        <div className="message-text">
                          <span className="spinner small" /> Thinking...
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="chat-overlay-input">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!chatInput.trim() || !geminiApiKey || isProcessingChat) return;
                      handleChatQuery(chatInput.trim());
                    }}
                  >
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Ask me anything about your library..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={!geminiApiKey || isProcessingChat}
                    />
                    <button
                      type="submit"
                      className="chat-send-btn"
                      disabled={!chatInput.trim() || !geminiApiKey || isProcessingChat}
                    >
                      <Icons.Search />
                    </button>
                  </form>
                  {!geminiApiKey && (
                    <p className="chat-hint">Gemini API key required for chat functionality</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* CHAT TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'chat' && (
          <div className="chat-tab">
            <div className="chat-container">
              <div className="chat-header">
                <h2>Chat with Your Library</h2>
                <p className="chat-subtitle">Ask questions, filter items, add tags, and more</p>
              </div>
              
              <div className="chat-messages">
                {chatMessages.length === 0 && (
                  <div className="chat-welcome">
                    <div className="welcome-icon">💬</div>
                    <h3>How can I help you?</h3>
                    <p>Try asking:</p>
                    <ul className="chat-examples">
                      {[
                        "Show me untagged items",
                        "How many items do I have?",
                        "Find items about machine learning",
                        "Tag all items with 'AI'",
                        "Show items missing DOIs"
                      ].map((example, idx) => (
                        <li key={idx}>
                          <button
                            className="example-query-btn"
                            onClick={() => handleChatQuery(example)}
                            disabled={!geminiApiKey || isProcessingChat}
                          >
                            "{example}"
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-message ${msg.role}`}>
                    <div className="message-content">
                      <div className="message-text">{msg.content}</div>
                      {msg.results && (
                        <div className="message-results">
                          {msg.action === 'tag' && msg.results.itemKeys && !msg.results.applied && (
                            <div className="result-action">
                              <button
                                className="btn-primary btn-sm"
                                onClick={async () => {
                                  if (!config) return;
                                  const tags = msg.results.tags || [];
                                  const itemKeys = msg.results.itemKeys || [];
                                  
                                  for (const itemKey of itemKeys) {
                                    const item = allItems.find(i => i.key === itemKey);
                                    if (!item) continue;
                                    
                                    const existingTags = item.data.tags || [];
                                    const newTags = tags.map(tag => ({ tag, type: 1 }));
                                    const combinedTags = [...existingTags, ...newTags];
                                    const uniqueTags = Array.from(
                                      new Map(combinedTags.map(t => [t.tag.toLowerCase(), t])).values()
                                    );
                                    
                                    try {
                                      const updated = await safeUpdate(item, { tags: uniqueTags });
                                      setAllItems(prev => prev.map(i => i.key === updated.key ? updated : i));
                                    } catch (e) {
                                      console.error('Failed to apply tags:', e);
                                    }
                                  }
                                  
                                  setChatMessages(prev => prev.map((m, i) => 
                                    i === idx ? { ...m, results: { ...m.results, applied: true } } : m
                                  ));
                                }}
                              >
                                Apply Tags to {msg.results.items} Items
                              </button>
                            </div>
                          )}
                          {msg.results.items && msg.action === 'show' && (
                            <div className="result-info">
                              Found {msg.results.items} items. Switch to Library tab to view them.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isProcessingChat && (
                  <div className="chat-message assistant">
                    <div className="message-content">
                      <div className="message-text">
                        <span className="spinner small" /> Thinking...
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="chat-input-container">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatInput.trim() || !geminiApiKey || isProcessingChat) return;
                    handleChatQuery(chatInput.trim());
                  }}
                >
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask me anything about your library..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={!geminiApiKey || isProcessingChat}
                  />
                  <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!chatInput.trim() || !geminiApiKey || isProcessingChat}
                  >
                    <Icons.Search />
                  </button>
                </form>
                {!geminiApiKey && (
                  <p className="chat-hint">Gemini API key required for chat functionality</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* CITATIONS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'citations' && (
          <div className="citations-tab">
            <div className="citations-header">
              <h2>Find Citing Papers</h2>
              <p>Discover papers that cite items in your library and add them with full metadata</p>
            </div>

            {!selectedItemForCitations ? (
              <div className="citations-selector">
                <h3>Select an item to find citing papers</h3>
                <div className="item-selector-list">
                  {bibItems.slice(0, 50).map(item => (
                    <button
                      key={item.key}
                      className="item-selector-card"
                      onClick={() => handleFindCitations(item)}
                      disabled={isLoadingCitations}
                    >
                      <div className="item-selector-title">{item.data.title || 'Untitled'}</div>
                      <div className="item-selector-meta">
                        {item.data.creators?.[0]?.lastName && (
                          <span>{item.data.creators[0].lastName}</span>
                        )}
                        {item.data.date && <span>({item.data.date})</span>}
                        {item.data.DOI && <span className="has-doi">✓ DOI</span>}
                      </div>
                    </button>
                  ))}
                </div>
                {bibItems.length > 50 && (
                  <p className="citations-hint">Showing first 50 items. Use Library tab to find specific items.</p>
                )}
              </div>
            ) : (
              <div className="citations-results">
                <div className="citations-source-item">
                  <button
                    className="btn-text btn-sm"
                    onClick={() => {
                      setSelectedItemForCitations(null);
                      setCitingPapers([]);
                    }}
                  >
                    ← Back to selection
                  </button>
                  <div className="source-item-card">
                    <h4>{selectedItemForCitations.data.title || 'Untitled'}</h4>
                    <div className="source-item-meta">
                      {selectedItemForCitations.data.creators && selectedItemForCitations.data.creators.length > 0 && (
                        <span>
                          {selectedItemForCitations.data.creators.map(c => c.lastName || c.name).filter(Boolean).join(', ')}
                        </span>
                      )}
                      {selectedItemForCitations.data.date && <span>({selectedItemForCitations.data.date})</span>}
                      {selectedItemForCitations.data.DOI && <span>DOI: {selectedItemForCitations.data.DOI}</span>}
                    </div>
                  </div>
                </div>

                {isLoadingCitations ? (
                  <div className="citations-loading">
                    <span className="spinner"></span>
                    <p>Searching for citing papers...</p>
                  </div>
                ) : citingPapers.length > 0 ? (
                  <div className="citing-papers-list">
                    <h3>Found {citingPapers.length} citing papers</h3>
                    {citingPapers.map((paper, idx) => (
                      <div key={idx} className="citing-paper-card">
                        <div className="citing-paper-header">
                          <h4>{paper.title}</h4>
                          <span className="citing-paper-source">{paper.source}</span>
                        </div>
                        <div className="citing-paper-meta">
                          {paper.authors.length > 0 && (
                            <div className="citing-paper-authors">
                              {paper.authors.map((a, i) => (
                                <span key={i}>
                                  {[a.firstName, a.lastName].filter(Boolean).join(' ')}
                                  {i < paper.authors.length - 1 && ', '}
                                </span>
                              ))}
                            </div>
                          )}
                          {paper.date && <span>({paper.date})</span>}
                          {paper.publicationTitle && <span>{paper.publicationTitle}</span>}
                          {paper.DOI && <span className="citing-paper-doi">DOI: {paper.DOI}</span>}
                        </div>
                        {paper.abstract && (
                          <div className="citing-paper-abstract">
                            {paper.abstract.substring(0, 200)}
                            {paper.abstract.length > 200 && '...'}
                          </div>
                        )}
                        <div className="citing-paper-actions">
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => addCitingPaperToLibrary(paper)}
                          >
                            Add to Library
                          </button>
                          {paper.url && (
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary btn-sm"
                            >
                              View Source
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="citations-empty">
                    <p>No citing papers found for this item.</p>
                    <p className="citations-hint">
                      This could mean the paper hasn't been cited yet, or the citation data isn't available in our sources.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* SETTINGS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="settings-section">
              <h3>Zotero Connection</h3>
              <div className="settings-grid">
                <div className="setting-row">
                  <label>API Key</label>
                  <div className="setting-value">
                    <input type="password" value={config?.zoteroApiKey || ''} disabled />
                    <button className="btn-text" onClick={() => setConfig(null)}>Change</button>
              </div>
                </div>
                <div className="setting-row">
                  <label>Library ID</label>
                  <span>{config?.libraryId}</span>
                </div>
                <div className="setting-row">
                  <label>Library Type</label>
                  <span>{config?.libraryType === 'user' ? 'Personal' : 'Group'}</span>
                </div>
              </div>
            </div>
            
            <div className="settings-section">
              <h3>Change Log</h3>
              <div className="setting-row">
                <div className="toggle-info">
                  <label>View Change Log</label>
                  <p>See all changes made to your library in this session</p>
                </div>
                <button className="btn-primary" onClick={() => setShowChangeLog(true)}>
                  View Log ({changeLog.length} entries)
                </button>
              </div>
              {changeLog.length > 0 && (
                <button className="btn-text btn-sm" onClick={() => {
                  setChangeLog([]);
                  localStorage.removeItem(STORAGE_KEYS.CHANGE_LOG);
                }} style={{ marginTop: '0.5rem' }}>
                  Clear Change Log
                </button>
              )}
            </div>
            
            <div className="settings-section">
              <h3>Data Persistence</h3>
              <div className="setting-row">
                <div className="toggle-info">
                  <label>Local Storage</label>
                  <p>Your preferences, change log, and UI state are saved locally in your browser. This data persists across sessions.</p>
                </div>
              </div>
              <div className="setting-row">
                <button 
                  className="btn-secondary btn-sm" 
                  onClick={() => {
                    if (confirm('This will remove ALL stored data including:\n\n• Your Zotero API key and library ID\n• Your Gemini API key (if provided)\n• All preferences and UI state\n• Change log and pending changes\n• Chat history\n\nYou will need to re-enter your API keys to use the app again.\n\nYour Zotero library data will NOT be affected.\n\nContinue?')) {
                      // Clear ALL persisted data including API keys
                      localStorage.removeItem(STORAGE_KEYS.CONFIG);
                      localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
                      localStorage.removeItem(STORAGE_KEYS.CHANGE_LOG);
                      localStorage.removeItem(STORAGE_KEYS.PENDING_EXPORT);
                      localStorage.removeItem(STORAGE_KEYS.REVIEWED_ITEMS);
                      localStorage.removeItem(STORAGE_KEYS.EXPANDED_CARDS);
                      localStorage.removeItem(STORAGE_KEYS.FILTER_STATE);
                      localStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
                      localStorage.removeItem(STORAGE_KEYS.READ_ONLY_MODE);
                      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
                      localStorage.removeItem(STORAGE_KEYS.PENDING_REPAIRS);
                      localStorage.removeItem(STORAGE_KEYS.VERIFICATION_REPORTS);
                      localStorage.removeItem(STORAGE_KEYS.EXPORT_TYPE);
                      localStorage.removeItem(STORAGE_KEYS.EXPORT_FORMAT);
                      
                      // Reset all state including config and API keys
                      setConfig(null);
                      setGeminiApiKey('');
                      setChangeLog([]);
                      setPendingExportChanges(new Map());
                      setReviewedItems(new Set());
                      setExpandedCards(new Set());
                      setSearchQuery('');
                      setFilterMode('all');
                      setSelectedTag(null);
                      setSortBy('dateAdded');
                      setSortOrder('desc');
                      setChatMessages([]);
                      setReadOnlyMode(false);
                      setActiveTab('home');
                      
                      addNotification('All stored data cleared successfully. Page will reload.', 'success');
                      
                      // Reload page to fully reset state
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    }
                  }}
                >
                  Clear All Stored Data
                </button>
              </div>
            </div>
            
            <div className="settings-section">
              <h3>Sync Preferences</h3>
              <div className="setting-row toggle">
                <div className="toggle-info">
                  <label>Enable direct sync to Zotero</label>
                  <p>Changes will be saved directly to your library.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={!readOnlyMode}
                  onChange={(e) => setReadOnlyMode(!e.target.checked)}
                />
              </div>
              <div className="setting-row toggle">
                <div className="toggle-info">
                  <label>Read-only mode</label>
                  <p>Review suggestions and export as RDF file instead.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={readOnlyMode}
                  onChange={(e) => setReadOnlyMode(e.target.checked)}
                />
              </div>
            </div>
            
            <div className="settings-section">
              <h3>Auto-Tagging</h3>
              <div className="setting-row toggle">
                <div className="toggle-info">
                  <label>Enable automatic AI tagging</label>
                  <p>Automatically generate tag suggestions based on title, abstract, and existing tags when items are added or verified.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={autoTaggingEnabled}
                  onChange={(e) => setAutoTaggingEnabled(e.target.checked)}
                />
              </div>
              {autoTaggingEnabled && (
                <div className="setting-row">
                  <label>Max citing papers to find</label>
                  <div className="setting-value">
                    <input 
                      type="number" 
                      min="1" 
                      max="20" 
                      value={autoTaggingMaxResults}
                      onChange={(e) => setAutoTaggingMaxResults(Math.max(1, Math.min(20, parseInt(e.target.value) || 10)))}
                    />
                    <span className="setting-unit">papers</span>
                  </div>
                  <p className="setting-hint">Maximum number of citing papers to find when using the Citations tab (1-20)</p>
                </div>
              )}
            </div>
            
            <div className="settings-section">
              <h3>AI Verification (Optional)</h3>
              <div className="setting-row">
                <label>Gemini API Key</label>
                <div className="setting-value">
                  <input 
                    type="password" 
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                  />
                  <button className="btn-secondary btn-sm" onClick={() => {/* Save key */}}>Save</button>
                </div>
              </div>
              <p className="setting-hint">
                Without an API key, you can still manually edit metadata. 
                Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">ai.google.dev</a>
              </p>
            </div>
            
            <div className="settings-section">
              <h3>Help & Information</h3>
              
              <HelpBox title="How It Works">
                <p>Zotero Architect helps you clean up and organize your Zotero library by:</p>
                <ul>
                  <li><strong>Metadata Verification:</strong> Uses AI and academic databases (Crossref, OpenAlex) to find missing DOIs, abstracts, and other metadata</li>
                  <li><strong>Duplicate Detection:</strong> Identifies potential duplicate entries and helps you merge them</li>
                  <li><strong>Citation Formatting:</strong> Preview and edit citations in APA, MLA, and Chicago styles</li>
                  <li><strong>Read-Only Mode:</strong> Review all changes before applying, or export as RDF for manual import</li>
                </ul>
              </HelpBox>
              
              <HelpBox title="Data Privacy & Security">
                <div className="privacy-item">
                  <strong>✓ Your API keys stay in your browser</strong>
                  <p>Keys are stored locally in localStorage and sent directly to Zotero/Gemini. They never pass through our servers.</p>
                </div>
                
                <div className="privacy-item">
                  <strong>✓ No backend server</strong>
                  <p>This app runs entirely in your browser. We don't operate any server that processes your data.</p>
                </div>
                
                <div className="privacy-item">
                  <strong>✓ No analytics or tracking</strong>
                  <p>We don't use Google Analytics or any tracking tools. We have no idea who uses this app or how.</p>
                </div>
                
                <div className="privacy-item">
                  <strong>✓ Open for inspection</strong>
                  <p>You can inspect network traffic in your browser's Developer Tools to verify all API calls go directly to their destinations.</p>
                </div>
                
                <div className="privacy-item">
                  <strong>⚠ What we can't guarantee</strong>
                  <p>Your data is sent to third-party APIs (Zotero, Google Gemini, Crossref, OpenAlex). Please review their privacy policies.</p>
                </div>
                
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <p><strong>Open Source:</strong> This app is fully open source. <a href="https://github.com/heelago/zotero-architect" target="_blank" rel="noopener noreferrer">Inspect the code yourself</a> or view <a href="/PRIVACY.md" target="_blank" rel="noopener noreferrer">full privacy details</a>.</p>
                </div>
              </HelpBox>
              
              <HelpBox title="Verify for Yourself">
                <p><strong>How to verify your privacy:</strong></p>
                <ol>
                  <li><strong>Open Browser Developer Tools</strong> (F12 or Cmd+Option+I)</li>
                  <li><strong>Go to the Network tab</strong></li>
                  <li><strong>Use the app normally</strong></li>
                  <li><strong>Observe:</strong> All requests go to:
                    <ul>
                      <li><code>api.zotero.org</code> (your Zotero library)</li>
                      <li><code>generativelanguage.googleapis.com</code> (Gemini AI - only if you use AI features)</li>
                      <li><code>api.crossref.org</code> (metadata lookup)</li>
                      <li><code>api.openalex.org</code> (metadata lookup)</li>
                    </ul>
                    <strong>No requests go to any server we control.</strong>
                  </li>
                </ol>
                <p style={{ marginTop: '1rem' }}>You can also inspect localStorage in the Application/Storage tab to see exactly what's stored locally.</p>
              </HelpBox>
              
              <HelpBox title="What's Stored Locally">
                <p>The following data is stored in your browser's localStorage:</p>
                <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Key</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Purpose</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Sensitive?</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-config</code></td>
                      <td style={{ padding: '0.5rem' }}>Zotero API key and library ID</td>
                      <td style={{ padding: '0.5rem' }}>Yes</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-gemini-key</code></td>
                      <td style={{ padding: '0.5rem' }}>Gemini API key (optional)</td>
                      <td style={{ padding: '0.5rem' }}>Yes</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-changelog</code></td>
                      <td style={{ padding: '0.5rem' }}>Change log of modifications</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-pending-export</code></td>
                      <td style={{ padding: '0.5rem' }}>Pending changes for export</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-reviewed-items</code></td>
                      <td style={{ padding: '0.5rem' }}>Items you've reviewed</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-expanded-cards</code></td>
                      <td style={{ padding: '0.5rem' }}>UI state (expanded sections)</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-filter-state</code></td>
                      <td style={{ padding: '0.5rem' }}>Filter preferences</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-chat-messages</code></td>
                      <td style={{ padding: '0.5rem' }}>Chat conversation history</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-readonly-mode</code></td>
                      <td style={{ padding: '0.5rem' }}>Read-only mode preference</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem' }}><code>zotero-architect-active-tab</code></td>
                      <td style={{ padding: '0.5rem' }}>Last active tab</td>
                      <td style={{ padding: '0.5rem' }}>No</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  All data is stored locally in your browser only. You can clear it at any time using the "Clear All Stored Data" button above.
                </p>
              </HelpBox>
              
              <HelpBox title="Disclaimers">
                <p><strong>Accuracy:</strong> While we use verified academic databases and AI verification, metadata suggestions should always be reviewed before applying. We prioritize data from Crossref and OpenAlex over AI-generated content.</p>
                <p><strong>API Limits:</strong> Free API keys may have rate limits. Large libraries may take time to process.</p>
                <p><strong>No Warranty:</strong> This tool is provided as-is. Always backup your Zotero library before making bulk changes.</p>
                <p><strong>Third-Party Services:</strong> This app uses external APIs (Zotero, Crossref, OpenAlex, Google Gemini). Service availability and terms are subject to change.</p>
              </HelpBox>
              
              <div className="contact-section">
                <p className="contact-text">
                  Missing a feature? <a href="mailto:contact@h2eapps.com" className="contact-link">Contact us</a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Export Bar - shown when read-only mode and pending changes */}
        {readOnlyMode && pendingExportChanges.size > 0 && (
          <div className="export-bar">
            <span>You have {pendingExportChanges.size} pending corrections.</span>
            <div className="export-actions">
              <button className="btn-text" onClick={() => setShowExportReview(true)}>Review Changes</button>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select 
                  value={exportFormat} 
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                >
                  <option value="rdf">RDF</option>
                  <option value="bibtex">BibTeX</option>
                  <option value="ris">RIS</option>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
                <button className="btn-primary" onClick={() => {
                  const content = generateExport(exportFormat, allItems, pendingExportChanges, false);
                  const blob = new Blob([content], { type: getExportMimeType(exportFormat) });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const extension = getExportFileExtension(exportFormat);
                  a.download = `zotero-corrections-${new Date().toISOString().split('T')[0]}.${extension}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}>Download</button>
              </div>
              <button className="btn-text" onClick={() => setPendingExportChanges(new Map())}>Clear All</button>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {pendingConfirmation && (
          <div className="modal-overlay">
            <div className="modal-backdrop" onClick={pendingConfirmation.onCancel} />
            <div className="confirmation-modal">
              <div className="modal-header">
                <h3>Confirm Changes</h3>
                <button className="modal-close" onClick={pendingConfirmation.onCancel}>
                  <Icons.X />
                </button>
              </div>
              
              <div className="modal-body">
                <p className="confirmation-warning">
                  You are about to apply the following changes to <strong>"{pendingConfirmation.itemTitle}"</strong>:
                </p>
                
                <div className="changes-preview">
                  {Object.entries(pendingConfirmation.changes).map(([field, change]) => {
                    const isTags = field === 'tags';
                    const oldTags = isTags ? (Array.isArray(change.old) ? change.old.map((t: any) => typeof t === 'string' ? t : t.tag) : []) : [];
                    const newTags = isTags ? (Array.isArray(change.new) ? change.new.map((t: any) => typeof t === 'string' ? t : t.tag) : []) : [];
                    const oldTagSet = new Set(oldTags.map((t: string) => t.toLowerCase()));
                    const newTagSet = new Set(newTags.map((t: string) => t.toLowerCase()));
                    const tagsToAdd = newTags.filter((t: string) => !oldTagSet.has(t.toLowerCase()));
                    const tagsToRemove = oldTags.filter((t: string) => !newTagSet.has(t.toLowerCase()));
                    
                    return (
                      <div key={field} className="change-item">
                        <div className="change-field">
                          <strong>{field.charAt(0).toUpperCase() + field.slice(1)}</strong>
                        </div>
                        {isTags ? (
                          <div className="change-values change-values-tags">
                            <div className="change-old">
                              <span className="change-label">Current Tags:</span>
                              <div className="change-tags-list">
                                {oldTags.length > 0 ? (
                                  oldTags.map((tag: string, idx: number) => {
                                    const isRemoved = tagsToRemove.includes(tag);
                                    return (
                                      <span key={idx} className={`tag-badge ${isRemoved ? 'tag-removed' : ''}`}>
                                        {tag}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="empty-tags">No tags</span>
                                )}
                              </div>
                            </div>
                            <div className="change-arrow">→</div>
                            <div className="change-new">
                              <span className="change-label">New Tags:</span>
                              <div className="change-tags-list">
                                {newTags.length > 0 ? (
                                  newTags.map((tag: string, idx: number) => {
                                    const isAdded = tagsToAdd.includes(tag);
                                    return (
                                      <span key={idx} className={`tag-badge ${isAdded ? 'tag-added' : ''}`}>
                                        {tag}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="empty-tags">No tags</span>
                                )}
                              </div>
                              {(tagsToAdd.length > 0 || tagsToRemove.length > 0) && (
                                <div className="tag-changes-summary" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  {tagsToAdd.length > 0 && (
                                    <span style={{ color: 'var(--success)' }}>+{tagsToAdd.length} added</span>
                                  )}
                                  {tagsToAdd.length > 0 && tagsToRemove.length > 0 && <span> • </span>}
                                  {tagsToRemove.length > 0 && (
                                    <span style={{ color: 'var(--notice)' }}>-{tagsToRemove.length} removed</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="change-values">
                            <div className="change-old">
                              <span className="change-label">Current:</span>
                              <span className="change-value">{String(change.old).substring(0, 100)}{String(change.old).length > 100 ? '...' : ''}</span>
                            </div>
                            <div className="change-arrow">→</div>
                            <div className="change-new">
                              <span className="change-label">New:</span>
                              <span className="change-value">{String(change.new).substring(0, 100)}{String(change.new).length > 100 ? '...' : ''}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="confirmation-note">
                  {readOnlyMode ? (
                    <p>These changes will be staged for export. You can review and export them later.</p>
                  ) : (
                    <p>These changes will be saved directly to your Zotero library.</p>
                  )}
                </div>
              </div>
              
              <div className="modal-footer">
                <button className="btn-secondary" onClick={pendingConfirmation.onCancel}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={pendingConfirmation.onConfirm}>
                  {readOnlyMode ? 'Stage Changes' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Review Modal */}
        {showExportReview && (
          <div className="modal-overlay">
            <div className="modal-backdrop" onClick={() => setShowExportReview(false)} />
            <div className="export-review-modal">
              <div className="modal-header">
                <h3>Pending Corrections</h3>
                <button className="modal-close" onClick={() => setShowExportReview(false)}>
                  <Icons.X />
              </button>
              </div>
              
              <div className="modal-body">
                <p>{pendingExportChanges.size} items will be updated:</p>
                
                <ul className="export-changes-list">
                  {Array.from(pendingExportChanges.entries()).map(([key, changes]) => {
                    const item = allItems.find(i => i.key === key);
                    return (
                      <li key={key}>
                        <strong>"{item?.data.title || key}"</strong>
                        <span> — {Object.keys(changes).length > 1 
                          ? `updating ${Object.keys(changes).join(', ')}`
                          : `updating ${Object.keys(changes)[0]}`
                        }</span>
                      </li>
                    );
                  })}
                </ul>
                
                <div className="export-options">
                  <h4>Export options:</h4>
                  <div className="export-option-group">
                    <label className="export-option">
                      <input 
                        type="radio" 
                        name="exportType" 
                        value="changedOnly"
                        checked={exportType === 'changedOnly'}
                        onChange={() => setExportType('changedOnly')}
                      />
                      <span>Export only changed items ({pendingExportChanges.size} items)</span>
                    </label>
                    <label className="export-option">
                      <input 
                        type="radio" 
                        name="exportType" 
                        value="all"
                        checked={exportType === 'all'}
                        onChange={() => setExportType('all')}
                      />
                      <span>Export entire library with corrections ({allItems.length} items)</span>
                    </label>
                  </div>
                  
                  <div className="export-format-group">
                    <h4>Export format:</h4>
                    <div className="export-format-options">
                      <label className="export-format-option">
                        <input 
                          type="radio" 
                          name="exportFormat" 
                          value="rdf"
                          checked={exportFormat === 'rdf'}
                          onChange={() => setExportFormat('rdf')}
                        />
                        <span>RDF (Zotero)</span>
                      </label>
                      <label className="export-format-option">
                        <input 
                          type="radio" 
                          name="exportFormat" 
                          value="bibtex"
                          checked={exportFormat === 'bibtex'}
                          onChange={() => setExportFormat('bibtex')}
                        />
                        <span>BibTeX</span>
                      </label>
                      <label className="export-format-option">
                        <input 
                          type="radio" 
                          name="exportFormat" 
                          value="ris"
                          checked={exportFormat === 'ris'}
                          onChange={() => setExportFormat('ris')}
                        />
                        <span>RIS</span>
                      </label>
                      <label className="export-format-option">
                        <input 
                          type="radio" 
                          name="exportFormat" 
                          value="json"
                          checked={exportFormat === 'json'}
                          onChange={() => setExportFormat('json')}
                        />
                        <span>JSON</span>
                      </label>
                      <label className="export-format-option">
                        <input 
                          type="radio" 
                          name="exportFormat" 
                          value="csv"
                          checked={exportFormat === 'csv'}
                          onChange={() => setExportFormat('csv')}
                        />
                        <span>CSV</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button className="btn-text" onClick={() => setShowExportReview(false)}>Cancel</button>
                <button className="btn-primary" onClick={() => {
                  const exportAll = exportType === 'all';
                  const content = generateExport(exportFormat, allItems, pendingExportChanges, exportAll);
                  const blob = new Blob([content], { type: getExportMimeType(exportFormat) });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const extension = getExportFileExtension(exportFormat);
                  a.download = `zotero-corrections-${new Date().toISOString().split('T')[0]}.${extension}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  setShowExportReview(false);
                }}>
                  Download {exportFormat.toUpperCase()} File
              </button>
            </div>
            
              <p className="export-hint">
                {exportFormat === 'rdf' && 'Import this file into Zotero via File → Import to apply your corrections.'}
                {exportFormat === 'bibtex' && 'BibTeX format can be imported into LaTeX documents or reference managers like Mendeley, Zotero, or JabRef.'}
                {exportFormat === 'ris' && 'RIS format is compatible with most reference managers including EndNote, Mendeley, RefWorks, and Zotero.'}
                {exportFormat === 'json' && 'JSON format provides machine-readable data that can be processed by scripts or imported into other applications.'}
                {exportFormat === 'csv' && 'CSV format can be opened in spreadsheet applications like Excel or Google Sheets for easy viewing and editing.'}
              </p>
            </div>
          </div>
        )}

        {/* Old dashboard sections removed - functionality moved to Home and Library tabs */}
        {false && (
          <div>
            {/* AI Categorizer Section */}
            <div className="dashboard-section">
              <button 
                className={`section-header-toggle ${expandedSections.has('categorizer') ? 'expanded' : ''}`}
                onClick={() => toggleSection('categorizer')}
                disabled={stats.untaggedItems === 0}
              >
                <div className="section-header-left">
                  <div className="section-icon"><Icons.Organize /></div>
                  <div>
                    <h3>AI Categorizer</h3>
                    <p>{stats.untaggedItems} untagged items</p>
                  </div>
                </div>
                <div className="section-header-right">
                  {stats.untaggedItems > 0 && <span className="section-badge">{stats.untaggedItems}</span>}
                  <div className={`section-chevron ${expandedSections.has('categorizer') ? 'open' : ''}`}>
                    <Icons.Chevron />
                  </div>
                </div>
              </button>
              
              {expandedSections.has('categorizer') && (
                <div className="section-content">
                  <div className="section-actions">
                    <button 
                      className="btn-primary"
                      onClick={runCategorizer}
                      disabled={isProcessingAI || !geminiApiKey}
                    >
                      {isProcessingAI ? <span className="spinner"></span> : <Icons.Sparkles />}
                      Analyze {Math.min(stats.untaggedItems, 20)} Items
                    </button>
                  </div>
                  
                  {false ? (
                    <div className="suggestion-list">
                      {[].map((suggestion: any) => {
                        const item = bibItems.find(i => i.key === suggestion.itemKey);
                        const isProcessing = processingItemKey === suggestion.itemKey;
                        
                        return (
                          <div key={suggestion.itemKey} className="suggestion-card">
                            <div className="suggestion-content">
                              <h4>{item?.data.title || suggestion.itemKey}</h4>
                              <div className="suggested-tags">
                                {suggestion.suggestedTags.map((tag: string) => (
                                  <span key={tag} className="tag">{tag}</span>
                                ))}
                              </div>
                              <p className="reasoning">{suggestion.reasoning}</p>
                            </div>
                            <div className="suggestion-actions">
                              <button 
                                className="btn-primary"
                                onClick={() => applyCategorySuggestion(suggestion)}
                                disabled={isProcessing}
                              >
                                {isProcessing ? <span className="spinner small"></span> : <Icons.Check />}
                                Apply Tags
                              </button>
                              <button 
                                className="btn-text"
                                onClick={() => {/* AI Categorizer removed */}}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Icons.Tag />
                      <h4>No suggestions yet</h4>
                      <p>Click "Analyze" to get AI-powered tag suggestions for your untagged items</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tag Standardizer Section */}
            <div className="dashboard-section">
              <button 
                className={`section-header-toggle ${expandedSections.has('tags') ? 'expanded' : ''}`}
                onClick={() => toggleSection('tags')}
              >
                <div className="section-header-left">
                  <div className="section-icon"><Icons.Tag /></div>
                  <div>
                    <h3>Tag Cleanup</h3>
                    <p>{allTags.length} unique tags</p>
                  </div>
                </div>
                <div className="section-header-right">
                  <div className={`section-chevron ${expandedSections.has('tags') ? 'open' : ''}`}>
                    <Icons.Chevron />
                  </div>
                </div>
              </button>
              
              {expandedSections.has('tags') && (
                <div className="section-content">
                  <div className="section-actions">
                    <button 
                      className="btn-primary"
                      onClick={runTagStandardizer}
                      disabled={isProcessingAI || !geminiApiKey}
                    >
                      {isProcessingAI ? <span className="spinner"></span> : <Icons.Sparkles />}
                      Find Duplicate Tags
                    </button>
                  </div>
                  
                  {false && 0 > 0 ? (
                    <div className="cluster-list">
                      {[].map((cluster: any) => (
                        <div key={cluster.canonicalTag} className="cluster-card">
                          <div className="cluster-content">
                            <div className="canonical-tag">
                              <Icons.Tag /> {cluster.canonicalTag}
                            </div>
                            <div className="similar-tags">
                                {cluster.similarTags.map((tag: string) => (
                                <span key={tag} className="old-tag">{tag}</span>
                              ))}
                            </div>
                            {cluster.reason && <p className="reason">{cluster.reason}</p>}
                          </div>
                          <button 
                            className="btn-primary"
                            onClick={() => applyTagMerge(cluster)}
                            disabled={isProcessingAI}
                          >
                            <Icons.Merge /> Merge All
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Icons.Tag />
                      <h4>No tag clusters found</h4>
                      <p>Click "Find Duplicate Tags" to analyze your tags for similar terms</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Metadata Doctor Section */}
            <div className="dashboard-section">
              <button 
                className={`section-header-toggle ${expandedSections.has('metadata') ? 'expanded' : ''}`}
                onClick={() => toggleSection('metadata')}
                disabled={allIssuesList.length === 0}
              >
                <div className="section-header-left">
                  <div className="section-icon"><Icons.Sparkles /></div>
                  <div>
                    <h3>Metadata Doctor</h3>
                    <p>{allIssuesList.length} items need attention</p>
                  </div>
                </div>
                <div className="section-header-right">
                  {allIssuesList.length > 0 && <span className="section-badge">{allIssuesList.length}</span>}
                  <div className={`section-chevron ${expandedSections.has('metadata') ? 'open' : ''}`}>
                    <Icons.Chevron />
                  </div>
                </div>
              </button>
              
              {expandedSections.has('metadata') && (
                <div className="section-content">
                  {/* Filter Controls */}
                  <div className="metadata-filters">
                    <div className="filters-header">
                      <div className="filters-title">
                        <Icons.Filter />
                        <span>Filters & Sort</span>
                        {false && (
                          <button 
                            className="btn-text-small"
                            onClick={() => {/* Old filter removed */}}
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="filter-row">
                        <div className="filter-group">
                          <label>Sort By</label>
                          <select
                            value="title"
                            onChange={e => {/* Old filter removed */}}
                            className="filter-select"
                          >
                            <option value="severity">Severity (High First)</option>
                            <option value="title">Title (A-Z)</option>
                            <option value="date">Date (Newest First)</option>
                            <option value="type">Item Type</option>
                          </select>
                        </div>
                        <div className="filter-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={e => {/* Old filter removed */}}
                            />
                            Flagged Only ({flaggedItems.size})
                          </label>
                        </div>
                      </div>
                      <div className="filter-row">
                        <div className="filter-group">
                          <label>Missing Fields</label>
                          <div className="filter-checkboxes">
                            {availableMissingFields.map(field => (
                              <label key={field} className="filter-checkbox">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={e => {/* Old filter removed */}}
                                />
                                {field}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="filter-group">
                          <label>Severity</label>
                          <div className="filter-checkboxes">
                            {['high', 'medium', 'low'].map(sev => (
                              <label key={sev} className="filter-checkbox">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={e => {/* Old filter removed */}}
                                />
                                {sev.charAt(0).toUpperCase() + sev.slice(1)}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="filter-row">
                        <div className="filter-group">
                          <label>Item Types</label>
                          <div className="filter-checkboxes">
                            {availableItemTypes.map(type => (
                              <label key={type} className="filter-checkbox">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={e => {/* Old filter removed */}}
                                />
                                {type}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="filter-group">
                          <label>Years</label>
                          <div className="filter-checkboxes filter-year-checkboxes">
                            {availableYears.slice(0, 20).map(year => (
                              <label key={year} className="filter-checkbox">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={e => {/* Old filter removed */}}
                                />
                                {year}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="filter-results-count">
                        Showing {issuesList.length} of {allIssuesList.length} items
                      </div>
                    </div>
                  </div>
                  
                  {issuesList.length > 0 ? (
                    <>
                      <div className="section-actions batch-actions">
                        <div className="batch-controls">
                          <button 
                            className={`btn-secondary ${batchMode ? 'active' : ''}`}
                            onClick={toggleBatchMode}
                          >
                            {batchMode ? <Icons.Check /> : <Icons.Copy />}
                            {batchMode ? 'Exit Batch Mode' : 'Batch Review'}
                          </button>
                          {batchMode && (
                            <>
                              <button 
                                className="btn-secondary"
                                onClick={selectAllItems}
                              >
                                {selectedItems.size === issuesList.length ? 'Deselect All' : 'Select All'}
                              </button>
                              <span className="batch-count">
                                {selectedItems.size} selected
                              </span>
                            </>
                          )}
                          {flaggedItems.size > 0 && (
                            <button 
                              className="btn-secondary"
                              onClick={clearAllFlags}
                              title="Clear all flags"
                            >
                              <Icons.Flag />
                              Clear Flags ({flaggedItems.size})
                            </button>
                          )}
                        </div>
                        {batchMode && selectedItems.size > 0 && (
                          <div className="batch-apply-controls">
                            <button 
                              className="btn-secondary"
                              onClick={batchDiscardRepairs}
                              disabled={isProcessingAI}
                            >
                              Discard All
                            </button>
                            <button 
                              className="btn-primary"
                              onClick={batchVerify}
                              disabled={isProcessingAI || !geminiApiKey}
                            >
                              {isProcessingAI ? <span className="spinner"></span> : <Icons.Sparkles />}
                              Verify {selectedItems.size} Items
                            </button>
                            {Array.from(selectedItems).some(key => pendingRepairs[key]) && (
                              <button 
                                className="btn-primary"
                                onClick={batchApplyRepairs}
                                disabled={isProcessingAI}
                              >
                                {isProcessingAI ? <span className="spinner"></span> : <Icons.Check />}
                                Apply All ({Array.from(selectedItems).filter(key => pendingRepairs[key]).length})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="issue-list">
                        {issuesList.map(({ item, issues }) => {
                          const isExpanded = expandedCards.has(item.key);
                          const isProcessing = processingItemKey === item.key || batchProcessingItems.has(item.key);
                          const repair = pendingRepairs[item.key];
                          const isSelected = selectedItems.has(item.key);
                        
                        return (
                          <div key={item.key} className={`issue-card ${repair ? 'has-repair' : ''} ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''} ${flaggedItems.has(item.key) ? 'flagged-item' : ''}`}>
                            <div className="issue-header" onClick={() => !batchMode && toggleCard(item.key)}>
                              {batchMode && (
                                <div className="batch-checkbox" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleItemSelection(item.key);
                                    }}
                                  />
                                </div>
                              )}
                              <div className="issue-info">
                                <div className="issue-title-row">
                                  <h4>{item.data.title || 'Untitled'}</h4>
                                  <button
                                    className={`btn-icon-tiny ${flaggedItems.has(item.key) ? 'flagged' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleItemFlag(item.key);
                                    }}
                                    title={flaggedItems.has(item.key) ? 'Remove flag' : 'Flag item'}
                                  >
                                    <Icons.Flag />
                                  </button>
                                </div>
                                <div className="issue-authors">
                                  {item.data.creators && item.data.creators.length > 0 ? (
                                    <div className="creators-inline">
                                      {item.data.creators.slice(0, 3).map((creator, idx) => {
                                        const displayName = creator.lastName && creator.firstName 
                                          ? `${creator.lastName}, ${creator.firstName}`
                                          : creator.lastName 
                                          ? creator.lastName
                                          : creator.firstName
                                          ? creator.firstName
                                          : creator.name || '';
                                        return (
                                          <span key={idx} className="creator-inline">
                                            <span className="creator-lastname-inline">{displayName}</span>
                                            {idx < Math.min(item.data.creators.length, 3) - 1 && <span>, </span>}
                                          </span>
                                        );
                                      })}
                                      {item.data.creators.length > 3 && <span className="creator-more"> +{item.data.creators.length - 3} more</span>}
                                    </div>
                                  ) : (
                                    <span>No authors</span>
                                  )}
                                </div>
                                <div className="issue-meta-summary">
                                  {item.data.date && <span className="meta-item">Date: {item.data.date}</span>}
                                  {item.data.publicationTitle && <span className="meta-item">Publication: {item.data.publicationTitle}</span>}
                                  {item.data.bookTitle && <span className="meta-item">Book: {item.data.bookTitle}</span>}
                                  {item.data.volume && <span className="meta-item">Vol: {item.data.volume}</span>}
                                  {item.data.issue && <span className="meta-item">Issue: {item.data.issue}</span>}
                                  {item.data.pages && <span className="meta-item">Pages: {item.data.pages}</span>}
                                  {item.data.DOI && <span className="meta-item">DOI: {item.data.DOI}</span>}
                                  {item.data.ISBN && <span className="meta-item">ISBN: {item.data.ISBN}</span>}
                                </div>
                                <div className="issue-badges">
                                  {issues.map((issue, idx) => (
                                    <span key={idx} className={`badge ${issue.severity}`}>
                                      {issue.field}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="issue-actions">
                                {(() => {
                                  const hasRepairs = repair && Object.keys(repair).length > 0;
                                  return !hasRepairs ? (
                                    <div className="repair-actions" onClick={e => e.stopPropagation()}>
                                      <button 
                                        className="btn-secondary"
                                        onClick={(e) => { e.stopPropagation(); startVerifyingMetadata(item); }}
                                        disabled={isProcessing || !geminiApiKey}
                                      >
                                        {isProcessing ? <span className="spinner small"></span> : <Icons.Sparkles />}
                                        Verify
                                      </button>
                                      {isExpanded && (
                                        <>
                                          <button 
                                            className="btn-secondary btn-sm" 
                                            onClick={(e) => { e.stopPropagation(); markAsVerified(item); }}
                                            disabled={isProcessing || processingItemKey === item.key}
                                            title="Mark as verified (adds a note to the item)"
                                          >
                                            <Icons.Check /> Mark Verified
                                          </button>
                                          <button 
                                            className="btn-primary" 
                                            onClick={(e) => { e.stopPropagation(); applyRepairs(item); }}
                                            disabled={isProcessing}
                                          >
                                            <Icons.Check /> Save Changes
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="repair-actions" onClick={e => e.stopPropagation()}>
                                      <button className="btn-text" onClick={() => discardRepairs(item.key)}>
                                        Discard
                                      </button>
                                      <button 
                                        className="btn-secondary btn-sm" 
                                        onClick={() => markAsVerified(item)}
                                        disabled={isProcessing || processingItemKey === item.key}
                                        title="Mark as verified (adds a note to the item)"
                                      >
                                        <Icons.Check /> Mark Verified
                                      </button>
                                      <button 
                                        className="btn-primary" 
                                        onClick={(e) => { e.stopPropagation(); applyRepairs(item); }}
                                        disabled={isProcessing || processingItemKey === item.key}
                                      >
                                        <Icons.Check /> Save
                                      </button>
                                    </div>
                                  );
                                })()}
                                <div className={`chevron ${isExpanded ? 'open' : ''}`}>
                                  <Icons.Chevron />
                                </div>
                              </div>
                            </div>
                            
                            {(isExpanded || repair) && (() => {
                              const missingFields = checkMissingCitationFields(item, repair);
                              const hasMissingFields = missingFields.required.length > 0 || missingFields.recommended.length > 0;
                              const verificationReport = verificationReports[item.key];
                              
                              return (
                                <div className="issue-body">
                                  {verificationReport && (
                                    <div className={`verification-report ${verificationReport.overallStatus}`}>
                                      <div className="verification-report-header">
                                        <strong>
                                          {verificationReport.overallStatus === 'success' && '✓'}
                                          {verificationReport.overallStatus === 'warning' && '⚠'}
                                          {verificationReport.overallStatus === 'failed' && '✗'}
                                          {verificationReport.overallStatus === 'partial' && '◐'}
                                          {' '}Verification Report
                                        </strong>
                                      </div>
                                      
                                      <div className="verification-tasks">
                                        {verificationReport.tasks.map((task: VerificationTask) => (
                                          <div key={task.id} className={`verification-task ${task.status}`}>
                                            <div className="task-header">
                                              <span className="task-name">{task.name}</span>
                                              <span className={`task-status ${task.status}`}>
                                                {task.status === 'completed' && '✓'}
                                                {task.status === 'running' && '⟳'}
                                                {task.status === 'failed' && '✗'}
                                                {task.status === 'pending' && '○'}
                                              </span>
                                            </div>
                                            {task.status === 'completed' && task.result && (
                                              <div className="task-result">
                                                {task.id === 'publication-existence' && (
                                                  <div>
                                                    {task.result.exists ? (
                                                      <span className="result-success">✓ Publication verified</span>
                                                    ) : (
                                                      <span className="result-error">✗ Publication not found</span>
                                                    )}
                                                    {task.result.reason && <p className="result-detail">{task.result.reason}</p>}
                                                  </div>
                                                )}
                                                {task.id === 'author-validation' && (
                                                  <div>
                                                    {task.result.valid && task.result.authorsMatch ? (
                                                      <span className="result-success">✓ Authors verified</span>
                                                    ) : (
                                                      <>
                                                        {task.result.hasPlaceholders && (
                                                          <span className="result-error">✗ Placeholder authors detected</span>
                                                        )}
                                                        {!task.result.authorsMatch && (
                                                          <span className="result-warning">⚠ Authors may not match publication</span>
                                                        )}
                                                        {task.result.correctAuthors && task.result.correctAuthors.length > 0 && (
                                                          <p className="result-detail">Correct authors identified and ready to apply</p>
                                                        )}
                                                      </>
                                                    )}
                                                  </div>
                                                )}
                                                {task.id === 'data-quality' && (
                                                  <div>
                                                    <span className={`result-${task.result.quality === 'good' ? 'success' : task.result.quality === 'needs_review' ? 'warning' : 'error'}`}>
                                                      Data Quality: {task.result.quality === 'good' ? 'Good' : task.result.quality === 'needs_review' ? 'Needs Review' : 'Poor'}
                                                    </span>
                                                    {task.result.issues && task.result.issues.length > 0 && (
                                                      <ul className="result-issues">
                                                        {task.result.issues.map((issue: string, idx: number) => (
                                                          <li key={idx}>{issue}</li>
                                                        ))}
                                                      </ul>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                            {task.status === 'failed' && task.error && (
                                              <div className="task-error">Error: {task.error}</div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                      
                                      {verificationReport.findings.errors.length > 0 && (
                                        <div className="verification-errors">
                                          <strong>Errors:</strong>
                                          <ul>
                                            {verificationReport.findings.errors.map((error: string, idx: number) => (
                                              <li key={idx}>{error}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {verificationReport.findings.warnings.length > 0 && (
                                        <div className="verification-warnings">
                                          <strong>Warnings:</strong>
                                          <ul>
                                            {verificationReport.findings.warnings.map((warning: string, idx: number) => (
                                              <li key={idx}>{warning}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {verificationReport.recommendations.length > 0 && (
                                        <div className="verification-recommendations">
                                          <strong>Recommendations:</strong>
                                          <ul>
                                            {verificationReport.recommendations.map((rec: string, idx: number) => (
                                              <li key={idx}>{rec}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {hasMissingFields && (
                                    <div className="missing-fields-alert">
                                      <div className="missing-fields-header">
                                        <strong>⚠️ Missing Information</strong>
                                        <button 
                                          className="btn-text-small" 
                                          onClick={(e) => { e.stopPropagation(); toggleCard(item.key); }}
                                        >
                                          {isExpanded ? 'Hide Details' : 'Show Details'}
                                        </button>
                                      </div>
                                      {missingFields.required.length > 0 && (
                                        <div className="missing-fields-section required">
                                          <strong>Required Fields:</strong>
                                          <div className="missing-fields-list">
                                            {missingFields.required.map(field => (
                                              <span key={field} className="missing-field-badge required">{field}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {missingFields.recommended.length > 0 && (
                                        <div className="missing-fields-section recommended">
                                          <strong>Recommended Fields:</strong>
                                          <div className="missing-fields-list">
                                            {missingFields.recommended.map(field => (
                                              <span key={field} className="missing-field-badge recommended">{field}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      <p className="missing-fields-hint">Use the fields below to add missing information, or click "Verify" to search for it automatically.</p>
                                    </div>
                                  )}
                                  
                                  {repair && metadataSources[item.key] && (
                                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                      <strong>Metadata Source:</strong> {metadataSources[item.key]}
                                    </div>
                                  )}
                                  
                                  <div className="repair-form">
                                    {(() => {
                                      // Get the latest item data (includes applied changes)
                                      const currentItem = allItems.find(i => i.key === item.key) || item;
                                      return (
                                    <div className="form-row full">
                                      <label>Title</label>
                                    {repair && repair.title ? (
                                      <div className="field-with-suggestion">
                                        <div className="current-value">
                                          <span className="value-label">Current:</span>
                                              <p>{currentItem.data.title || '—'}</p>
                                        </div>
                                        <div className="suggested-value">
                                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1 }}>
                                          <span className="value-label new">Suggested:</span>
                                          <textarea 
                                            value={repair.title}
                                            onChange={e => updatePendingRepairField(item.key, 'title', e.target.value)}
                                            rows={2}
                                            className="suggested-input"
                                          />
                                                </div>
                                                <button
                                                  className="btn-primary btn-sm"
                                                  onClick={() => applySingleField(item.key, 'title', repair.title)}
                                                  title="Apply this field"
                                                >
                                                  Apply
                                                </button>
                                              </div>
                                        </div>
                                      </div>
                                    ) : (
                                          <p>{currentItem.data.title || '—'}</p>
                                    )}
                                  </div>
                                      );
                                    })()}
                                  
                                  <div className="form-row full">
                                    <label>Authors/Creators</label>
                                    {(() => {
                                      const currentItem = allItems.find(i => i.key === item.key) || item;
                                      const currentCreators = currentItem.data.creators || [];
                                      const editingCreators = repair?.creators ?? currentCreators;
                                      const hasNewCreators = repair?.creators && JSON.stringify(repair.creators) !== JSON.stringify(currentCreators);
                                      
                                      return (
                                        <div className="creators-editor">
                                          {hasNewCreators && (
                                            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                                              <button
                                                className="btn-primary btn-sm"
                                                onClick={() => {
                                                  applySingleField(item.key, 'creators', repair.creators);
                                                }}
                                                title="Apply these authors"
                                              >
                                                Apply Authors
                                              </button>
                                            </div>
                                          )}
                                          <div className="creators-list">
                                            {editingCreators.map((creator, idx) => (
                                              <div key={idx} className="creator-item editable">
                                                <div className="creator-inputs">
                                                  <input
                                                    type="text"
                                                    placeholder="Last Name"
                                                    value={creator.lastName || ''}
                                                    onChange={e => {
                                                      const updated = [...editingCreators];
                                                      updated[idx] = { ...creator, lastName: e.target.value };
                                                      updatePendingRepairCreators(item.key, updated);
                                                    }}
                                                    className="creator-input"
                                                  />
                                                  <input
                                                    type="text"
                                                    placeholder="First Name"
                                                    value={creator.firstName || ''}
                                                    onChange={e => {
                                                      const updated = [...editingCreators];
                                                      updated[idx] = { ...creator, firstName: e.target.value };
                                                      updatePendingRepairCreators(item.key, updated);
                                                    }}
                                                    className="creator-input"
                                                  />
                                                  <input
                                                    type="text"
                                                    placeholder="Full Name (if no first/last)"
                                                    value={creator.name || ''}
                                                    onChange={e => {
                                                      const updated = [...editingCreators];
                                                      updated[idx] = { ...creator, name: e.target.value };
                                                      updatePendingRepairCreators(item.key, updated);
                                                    }}
                                                    className="creator-input"
                                                  />
                                                  <select
                                                    value={creator.creatorType || 'author'}
                                                    onChange={e => {
                                                      const updated = [...editingCreators];
                                                      updated[idx] = { ...creator, creatorType: e.target.value };
                                                      updatePendingRepairCreators(item.key, updated);
                                                    }}
                                                    className="creator-type-select"
                                                  >
                                                    <option value="author">Author</option>
                                                    <option value="editor">Editor</option>
                                                    <option value="translator">Translator</option>
                                                    <option value="contributor">Contributor</option>
                                                  </select>
                                                  <button
                                                    type="button"
                                                    className="btn-icon-small"
                                                    onClick={() => {
                                                      const updated = editingCreators.filter((_, i) => i !== idx);
                                                      updatePendingRepairCreators(item.key, updated);
                                                    }}
                                                    title="Remove creator"
                                                  >
                                                    <Icons.Trash />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          <button
                                            type="button"
                                            className="btn-secondary btn-sm"
                                            onClick={() => {
                                              const updated = [...editingCreators, { creatorType: 'author' }];
                                              updatePendingRepairCreators(item.key, updated);
                                            }}
                                          >
                                            + Add Creator
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  
                                  <div className="form-row">
                                    <label>Date</label>
                                    {repair && repair.date ? (
                                      <div className="field-with-suggestion">
                                        <div className="current-value">
                                          <span className="value-label">Current:</span>
                                          <p className="mono">{(allItems.find(i => i.key === item.key) || item).data.date || '—'}</p>
                                        </div>
                                        <div className="suggested-value">
                                          <span className="value-label new">Suggested:</span>
                                          <input 
                                            type="text"
                                            value={repair.date}
                                            onChange={e => updatePendingRepairField(item.key, 'date', e.target.value)}
                                            className="suggested-input"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="mono">{item.data.date || '—'}</p>
                                    )}
                                  </div>
                                  
                                  <div className="form-row">
                                    <label>DOI</label>
                                    {repair && repair.DOI ? (
                                      <div className="field-with-suggestion">
                                        <div className="current-value">
                                          <span className="value-label">Current:</span>
                                          <p className="mono">{(allItems.find(i => i.key === item.key) || item).data.DOI || '—'}</p>
                                        </div>
                                        <div className="suggested-value">
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                          <span className="value-label new">Suggested:</span>
                                          <input 
                                            type="text"
                                            value={repair.DOI}
                                            onChange={e => updatePendingRepairField(item.key, 'DOI', e.target.value)}
                                            placeholder="10.xxxx/..."
                                            className="suggested-input"
                                          />
                                            </div>
                                            <button
                                              className="btn-primary btn-sm"
                                              onClick={() => applySingleField(item.key, 'DOI', repair.DOI)}
                                              title="Apply this field"
                                            >
                                              Apply
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="mono">{item.data.DOI || '—'}</p>
                                    )}
                                  </div>
                                  
                                  <div className="form-row">
                                    <label>ISBN</label>
                                    {repair && repair.ISBN ? (
                                      <div className="field-with-suggestion">
                                        <div className="current-value">
                                          <span className="value-label">Current:</span>
                                          <p className="mono">{(allItems.find(i => i.key === item.key) || item).data.ISBN || '—'}</p>
                                        </div>
                                        <div className="suggested-value">
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                          <span className="value-label new">Suggested:</span>
                                          <input 
                                            type="text"
                                            value={repair.ISBN}
                                            onChange={e => updatePendingRepairField(item.key, 'ISBN', e.target.value)}
                                            className="suggested-input"
                                          />
                                            </div>
                                            <button
                                              className="btn-primary btn-sm"
                                              onClick={() => applySingleField(item.key, 'ISBN', repair.ISBN)}
                                              title="Apply this field"
                                            >
                                              Apply
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="mono">{item.data.ISBN || '—'}</p>
                                    )}
                                  </div>
                                  
                                  {(item.data.itemType === 'bookChapter' || repair?.bookTitle) && (
                                    <div className="form-row">
                                      <label>Book Title</label>
                                      {repair && repair.bookTitle ? (
                                        <div className="field-with-suggestion">
                                          <div className="current-value">
                                            <span className="value-label">Current:</span>
                                            <p>{((allItems.find(i => i.key === item.key) || item).data as any).bookTitle || '—'}</p>
                                          </div>
                                          <div className="suggested-value">
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                              <div style={{ flex: 1 }}>
                                            <span className="value-label new">Suggested:</span>
                                            <input 
                                              type="text"
                                              value={repair.bookTitle}
                                              onChange={e => updatePendingRepairField(item.key, 'bookTitle', e.target.value)}
                                              className="suggested-input"
                                            />
                                              </div>
                                              <button
                                                className="btn-primary btn-sm"
                                                onClick={() => applySingleField(item.key, 'bookTitle', repair.bookTitle)}
                                                title="Apply this field"
                                              >
                                                Apply
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <p>{(item.data as any).bookTitle || '—'}</p>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className="form-row">
                                    <label>Publisher</label>
                                    {repair && repair.publisher ? (
                                      <div className="field-with-suggestion">
                                        <div className="current-value">
                                          <span className="value-label">Current:</span>
                                          <p>{(allItems.find(i => i.key === item.key) || item).data.publisher || '—'}</p>
                                        </div>
                                        <div className="suggested-value">
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                          <span className="value-label new">Suggested:</span>
                                          <input 
                                            type="text"
                                            value={repair.publisher}
                                            onChange={e => updatePendingRepairField(item.key, 'publisher', e.target.value)}
                                            className="suggested-input"
                                          />
                                            </div>
                                            <button
                                              className="btn-primary btn-sm"
                                              onClick={() => applySingleField(item.key, 'publisher', repair.publisher)}
                                              title="Apply this field"
                                            >
                                              Apply
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <p>{item.data.publisher || '—'}</p>
                                    )}
                                  </div>
                                  
                                  <div className="form-row">
                                    <label>Publication</label>
                                    {repair && repair.publicationTitle ? (
                                      <div className="field-with-suggestion">
                                        <div className="current-value">
                                          <span className="value-label">Current:</span>
                                          <p>{(allItems.find(i => i.key === item.key) || item).data.publicationTitle || '—'}</p>
                                        </div>
                                        <div className="suggested-value">
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                          <span className="value-label new">Suggested:</span>
                                          <input 
                                            type="text"
                                            value={repair.publicationTitle}
                                            onChange={e => updatePendingRepairField(item.key, 'publicationTitle', e.target.value)}
                                            className="suggested-input"
                                          />
                                            </div>
                                            <button
                                              className="btn-primary btn-sm"
                                              onClick={() => applySingleField(item.key, 'publicationTitle', repair.publicationTitle)}
                                              title="Apply this field"
                                            >
                                              Apply
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <p>{item.data.publicationTitle || '—'}</p>
                                    )}
                                  </div>
                                  
                                  {(item.data.itemType === 'journalArticle' || repair?.volume) && (
                                    <div className="form-row">
                                      <label>Volume</label>
                                      {repair && repair.volume ? (
                                        <div className="field-with-suggestion">
                                          <div className="current-value">
                                            <span className="value-label">Current:</span>
                                            <p className="mono">{(allItems.find(i => i.key === item.key) || item).data.volume || '—'}</p>
                                          </div>
                                          <div className="suggested-value">
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                              <div style={{ flex: 1 }}>
                                            <span className="value-label new">Suggested:</span>
                                            <input 
                                              type="text"
                                              value={repair.volume}
                                              onChange={e => updatePendingRepairField(item.key, 'volume', e.target.value)}
                                              className="suggested-input"
                                            />
                                              </div>
                                              <button
                                                className="btn-primary btn-sm"
                                                onClick={() => applySingleField(item.key, 'volume', repair.volume)}
                                                title="Apply this field"
                                              >
                                                Apply
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="mono">{item.data.volume || '—'}</p>
                                      )}
                                    </div>
                                  )}
                                  
                                  {(item.data.itemType === 'journalArticle' || repair?.issue) && (
                                    <div className="form-row">
                                      <label>Issue</label>
                                      {repair && repair.issue ? (
                                        <div className="field-with-suggestion">
                                          <div className="current-value">
                                            <span className="value-label">Current:</span>
                                            <p className="mono">{(allItems.find(i => i.key === item.key) || item).data.issue || '—'}</p>
                                          </div>
                                          <div className="suggested-value">
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                              <div style={{ flex: 1 }}>
                                            <span className="value-label new">Suggested:</span>
                                            <input 
                                              type="text"
                                              value={repair.issue}
                                              onChange={e => updatePendingRepairField(item.key, 'issue', e.target.value)}
                                              className="suggested-input"
                                            />
                                              </div>
                                              <button
                                                className="btn-primary btn-sm"
                                                onClick={() => applySingleField(item.key, 'issue', repair.issue)}
                                                title="Apply this field"
                                              >
                                                Apply
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="mono">{item.data.issue || '—'}</p>
                                      )}
                                    </div>
                                  )}
                                  
                                  {((item.data.itemType === 'journalArticle' || item.data.itemType === 'bookChapter') || repair?.pages) && (
                                    <div className="form-row">
                                      <label>Pages</label>
                                      {repair && repair.pages ? (
                                        <div className="field-with-suggestion">
                                          <div className="current-value">
                                            <span className="value-label">Current:</span>
                                            <p className="mono">{(allItems.find(i => i.key === item.key) || item).data.pages || '—'}</p>
                                          </div>
                                          <div className="suggested-value">
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                              <div style={{ flex: 1 }}>
                                            <span className="value-label new">Suggested:</span>
                                            <input 
                                              type="text"
                                              value={repair.pages}
                                              onChange={e => updatePendingRepairField(item.key, 'pages', e.target.value)}
                                              placeholder="e.g., 123-145"
                                              className="suggested-input"
                                            />
                                              </div>
                                              <button
                                                className="btn-primary btn-sm"
                                                onClick={() => applySingleField(item.key, 'pages', repair.pages)}
                                                title="Apply this field"
                                              >
                                                Apply
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="mono">{item.data.pages || '—'}</p>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className="form-row full">
                                    <label>Abstract</label>
                                    {repair && repair.abstractNote ? (
                                      <div className="field-with-suggestion">
                                        <div className="current-value">
                                          <span className="value-label">Current:</span>
                                          <p className="abstract">{(allItems.find(i => i.key === item.key) || item).data.abstractNote || 'No abstract'}</p>
                                        </div>
                                        <div className="suggested-value">
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                          <span className="value-label new">Suggested:</span>
                                          <textarea 
                                            value={repair.abstractNote}
                                            onChange={e => updatePendingRepairField(item.key, 'abstractNote', e.target.value)}
                                            rows={5}
                                            placeholder="Enter abstract..."
                                            className="suggested-input"
                                          />
                                            </div>
                                            <button
                                              className="btn-primary btn-sm"
                                              onClick={() => applySingleField(item.key, 'abstractNote', repair.abstractNote)}
                                              title="Apply this field"
                                              style={{ marginTop: '1.5rem' }}
                                            >
                                              Apply
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="abstract">{item.data.abstractNote || 'No abstract'}</p>
                                    )}
                                  </div>
                                  
                                  {/* Citation Formatter Section */}
                                  <div className="citation-formatter-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                                    <div className="form-row full">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <label>Citation Format</label>
                                        <div className="citation-style-toggle" style={{ display: 'flex', gap: '0.5rem' }}>
                                          {(['apa', 'mla', 'chicago'] as CitationStyle[]).map(style => {
                                            const selectedStyle = citationStyles[item.key] || 'apa';
                                            return (
                                              <button
                                                key={style}
                                                className={`btn-secondary btn-sm ${selectedStyle === style ? 'active' : ''}`}
                                                onClick={() => {
                                                  setCitationStyles(prev => ({ ...prev, [item.key]: style }));
                                                }}
                                                style={{
                                                  textTransform: 'uppercase',
                                                  fontWeight: selectedStyle === style ? 600 : 400,
                                                  background: selectedStyle === style ? 'var(--primary)' : 'var(--bg-secondary)',
                                                  color: selectedStyle === style ? 'white' : 'var(--text)'
                                                }}
                                              >
                                                {style}
                                              </button>
                                            );
                                          })}
                                </div>
                                      </div>
                                      
                                      {(() => {
                                        const selectedStyle = citationStyles[item.key] || 'apa';
                                        const isEditing = editingCitations[item.key]?.style === selectedStyle;
                                        // Use item from allItems to get latest data (including applied changes)
                                        const currentItem = allItems.find(i => i.key === item.key) || item;
                                        const citation = formatCitation(currentItem, selectedStyle);
                                        
                                        return (
                                          <div className="citation-style-card" style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                                            <div className="citation-style-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                              <strong style={{ textTransform: 'uppercase', fontSize: '0.9rem' }}>{selectedStyle}</strong>
                                              <div className="citation-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                  className="btn-icon-tiny"
                                                  onClick={() => {
                                                    navigator.clipboard.writeText(citation.formatted);
                                                    addNotification(`${selectedStyle.toUpperCase()} citation copied to clipboard`, 'success');
                                                  }}
                                                  title="Copy citation"
                                                >
                                                  <Icons.Copy />
                                                </button>
                                                <button
                                                  className="btn-icon-tiny"
                                                  onClick={() => {
                                                    if (isEditing) {
                                                      const next = { ...editingCitations };
                                                      delete next[item.key];
                                                      setEditingCitations(next);
                                                    } else {
                                                      setEditingCitations({
                                                        ...editingCitations,
                                                        [item.key]: { style: selectedStyle, fields: { ...citation.editableFields } }
                                                      });
                                                    }
                                                  }}
                                                  title={isEditing ? "Cancel editing" : "Edit citation"}
                                                >
                                                  {isEditing ? <Icons.X /> : <Icons.Edit />}
                                                </button>
                                              </div>
                                            </div>
                                            
                                            {isEditing ? (
                                              <div className="citation-editor">
                                                {Object.entries(editingCitations[item.key].fields).map(([field, value]) => (
                                                  <div key={field} className="citation-field-edit" style={{ marginBottom: '0.5rem' }}>
                                                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>{field}:</label>
                                                    <input
                                                      type="text"
                                                      value={value}
                                                      onChange={e => {
                                                        setEditingCitations({
                                                          ...editingCitations,
                                                          [item.key]: {
                                                            ...editingCitations[item.key],
                                                            fields: {
                                                              ...editingCitations[item.key].fields,
                                                              [field]: e.target.value
                                                            }
                                                          }
                                                        });
                                                      }}
                                                      className="suggested-input"
                                                      style={{ width: '100%' }}
                                                    />
                                                  </div>
                                                ))}
                                                <div className="citation-edit-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                                  <button
                                                    className="btn-primary btn-sm"
                                                    onClick={async () => {
                                                      const edits = parseCitationEdits(editingCitations[item.key].fields, item);
                                                      if (Object.keys(edits).length > 0) {
                                                        // Apply edits to pending repairs
                                                        setPendingRepairs(prev => ({
                                                          ...prev,
                                                          [item.key]: { ...(prev[item.key] || {}), ...edits }
                                                        }));
                                                        
                                                        // Update verification report with manual edit note
                                                        setVerificationReports(prev => {
                                                          const report = prev[item.key];
                                                          if (report) {
                                                            return {
                                                              ...prev,
                                                              [item.key]: {
                                                                ...report,
                                                                manualEdits: [
                                                                  ...(report.manualEdits || []),
                                                                  {
                                                                    timestamp: Date.now(),
                                                                    fields: Object.keys(edits),
                                                                    citationStyle: selectedStyle
                                                                  }
                                                                ]
                                                              }
                                                            };
                                                          }
                                                          return prev;
                                                        });
                                                        
                                                        addNotification(`Applied ${Object.keys(edits).length} field(s) from ${selectedStyle.toUpperCase()} citation`, 'success');
                                                      }
                                                      setEditingCitations(prev => {
                                                        const next = { ...prev };
                                                        delete next[item.key];
                                                        return next;
                                                      });
                                                    }}
                                                  >
                                                    Apply Changes
                                                  </button>
                                                  <button
                                                    className="btn-secondary btn-sm"
                                                    onClick={() => {
                                                      setEditingCitations(prev => {
                                                        const next = { ...prev };
                                                        delete next[item.key];
                                                        return next;
                                                      });
                                                    }}
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="citation-preview">
                                                <p style={{ fontStyle: 'italic', color: 'var(--text)', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                                                  {citation.formatted}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                    </>
                  ) : (
                    <div className="empty-state success">
                      <Icons.Check />
                      <h4>All items look good!</h4>
                      <p>No metadata issues detected in your library</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Duplicates Quick Link */}
            {duplicatesList.length > 0 && (
              <div className="dashboard-section">
                <button className="section-header-toggle" onClick={() => setActiveTab('library')}>
                  <div className="section-header-left">
                    <div className="section-icon"><Icons.Copy /></div>
                    <div>
                      <h3>Duplicates</h3>
                      <p>{duplicatesList.length} duplicate groups found</p>
                    </div>
                  </div>
                  <div className="section-header-right">
                    <span className="section-badge danger">{duplicatesList.length}</span>
                    <Icons.ArrowRight />
                  </div>
                </button>
              </div>
            )}
          </div>
        )}


        {/* Old duplicates tab removed - now part of Library tab */}
        {false && (
          <div className="tab-content">
            <div className="section-header">
              <div>
                <h3>Duplicate Detection</h3>
                <p>Items grouped by matching DOI, ISBN, or title + author combinations</p>
              </div>
            </div>
            
            {duplicatesList.length > 0 ? (
              <div className="duplicate-list">
                {duplicatesList.map(group => (
                  <button 
                    key={group.id}
                    className="duplicate-group"
                    onClick={() => setActiveMergeGroup(group)}
                  >
                    <div className="group-info">
                      <div className="group-badge">{group.reason}</div>
                      <h4>{group.items[0].data.title || 'Untitled'}</h4>
                      <p>{group.items[0].meta.creatorSummary || 'Unknown authors'}</p>
                    </div>
                    <div className="group-count">
                      <span>{group.items.length}</span>
                      <small>copies</small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state success">
                <Icons.Check />
                <h4>No duplicates found</h4>
                <p>Your library appears to have no duplicate entries</p>
              </div>
            )}
          </div>
        )}

        {/* Change Log Modal */}
        {showChangeLog && (
          <div className="modal-overlay">
            <div className="modal-backdrop" onClick={() => setShowChangeLog(false)} />
            <div className="changelog-modal">
              <div className="modal-header">
                <h3>Change Log</h3>
                <button className="modal-close" onClick={() => setShowChangeLog(false)}>
                  <Icons.X />
                </button>
              </div>
              
              <div className="modal-body">
                {changeLog.length === 0 ? (
                  <p className="empty-state">No changes have been made yet.</p>
                ) : (
                  <div className="changelog-list">
                    {changeLog.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="changelog-entry">
                        <div className="changelog-header">
                          <div className="changelog-item-info">
                            <strong>{entry.itemTitle}</strong>
                            <span className="changelog-timestamp">
                              {entry.timestamp.toLocaleTimeString()} — {entry.mode === 'direct' ? 'Saved to Zotero' : 'Staged for export'}
                            </span>
                          </div>
                          <span className={`changelog-badge ${entry.mode}`}>
                            {entry.mode === 'direct' ? 'Applied' : 'Staged'}
                          </span>
                        </div>
                        <div className="changelog-changes">
                          {entry.fields.map(field => (
                            <div key={field} className="changelog-field">
                              <strong>{field.charAt(0).toUpperCase() + field.slice(1)}:</strong>
                              <span className="changelog-old">{String(entry.oldValues?.[field] || '(empty)').substring(0, 80)}</span>
                              <span className="changelog-arrow">→</span>
                              <span className="changelog-new">{String(entry.newValues[field] || '(empty)').substring(0, 80)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => {
                  const logText = changeLog.map(entry => {
                    const changes = entry.fields.map(field => 
                      `  ${field}: "${entry.oldValues?.[field] || '(empty)'}" → "${entry.newValues[field] || '(empty)'}"`
                    ).join('\n');
                    return `${entry.timestamp.toLocaleString()}\n${entry.itemTitle} (${entry.mode})\n${changes}`;
                  }).join('\n\n');
                  
                  navigator.clipboard.writeText(logText);
                  setInlineConfirmations(prev => ({ ...prev, 'changelog-copy': 'Copied!' }));
                  setTimeout(() => {
                    setInlineConfirmations(prev => {
                      const next = { ...prev };
                      delete next['changelog-copy'];
                      return next;
                    });
                  }, 2000);
                }}>
                  <Icons.Clipboard /> Copy to Clipboard
                </button>
                <button className="btn-primary" onClick={() => setShowChangeLog(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer with privacy and open source links */}
      <footer style={{ 
        padding: '1rem 2rem', 
        borderTop: '1px solid var(--border-color)', 
        backgroundColor: 'var(--bg-secondary)',
        fontSize: '0.9rem',
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <strong>🔓 Open Source:</strong> This app is fully open source. 
          <a href="https://github.com/heelago/zotero-architect" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: 'var(--primary)' }}>View source code</a>
        </div>
        <div>
          <a href="/PRIVACY.md" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', marginRight: '1rem' }}>Privacy Policy</a>
          <span>No tracking · No analytics · No backend server</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
