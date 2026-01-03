import { ZoteroItem, Config } from './types';

const ZOTERO_API_BASE = 'https://api.zotero.org';

export async function fetchAllItems(
  config: Config, 
  onProgress: (current: number, total: number) => void
): Promise<ZoteroItem[]> {
  const { zoteroApiKey, libraryId, libraryType } = config;
  let allItems: ZoteroItem[] = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const url = `${ZOTERO_API_BASE}/${libraryType}s/${libraryId}/items?limit=${limit}&start=${start}`;
    const response = await fetch(url, {
      headers: {
        'Zotero-API-Key': zoteroApiKey,
        'Zotero-API-Version': '3'
      }
    });

    if (!response.ok) {
      if (response.status === 403) throw new Error('Invalid Zotero API key or insufficient permissions.');
      if (response.status === 404) throw new Error('Library not found. Check your Library ID.');
      console.error(`[Zotero Service] API error ${response.status} - Library ID: ${libraryId}, Type: ${libraryType}`);
      throw new Error(`Zotero API error: ${response.status}`);
    }

    const items = await response.json() as ZoteroItem[];
    allItems = [...allItems, ...items];
    
    const totalResultsStr = response.headers.get('Total-Results');
    const totalResults = parseInt(totalResultsStr || '0');
    
    onProgress(allItems.length, totalResults);

    if (items.length < limit || allItems.length >= totalResults) break;
    start += limit;
  }
  
  return allItems;
}

export async function fetchItem(config: Config, itemKey: string): Promise<ZoteroItem> {
  const { zoteroApiKey, libraryId, libraryType } = config;
  const url = `${ZOTERO_API_BASE}/${libraryType}s/${libraryId}/items/${itemKey}`;
  
  const response = await fetch(url, {
    headers: {
      'Zotero-API-Key': zoteroApiKey,
      'Zotero-API-Version': '3'
    }
  });

  if (!response.ok) throw new Error(`Failed to fetch item ${itemKey}: ${response.status}`);
  return await response.json();
}

export async function updateItem(config: Config, item: ZoteroItem): Promise<ZoteroItem> {
  const { zoteroApiKey, libraryId, libraryType } = config;
  const url = `${ZOTERO_API_BASE}/${libraryType}s/${libraryId}/items/${item.key}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Zotero-API-Key': zoteroApiKey,
      'Zotero-API-Version': '3',
      'Content-Type': 'application/json',
      'If-Unmodified-Since-Version': item.version.toString()
    },
    body: JSON.stringify(item.data)
  });

  if (!response.ok) {
    if (response.status === 412) {
      throw new Error("VERSION_MISMATCH");
    }
    if (response.status === 403) {
      throw new Error("403: Write access not available. Use read-only mode with RDF export.");
    }
    let errorDetail = "";
    try {
      errorDetail = await response.text();
      // Sanitize any potential API key exposure
      errorDetail = errorDetail.replace(/Zotero-API-Key[:\s]*[^\s"']+/gi, 'Zotero-API-Key: ***');
    } catch (e) {
      errorDetail = response.statusText;
    }
    console.error(`[Zotero Service] Update failed for item ${item.key}: ${response.status}`);
    throw new Error(`Update failed (${response.status}): ${errorDetail}`);
  }

  try {
    return await response.json();
  } catch (e) {
    return item;
  }
}

export async function deleteItem(config: Config, itemKey: string, version: number): Promise<void> {
  const { zoteroApiKey, libraryId, libraryType } = config;
  const url = `${ZOTERO_API_BASE}/${libraryType}s/${libraryId}/items/${itemKey}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Zotero-API-Key': zoteroApiKey,
      'Zotero-API-Version': '3',
      'If-Unmodified-Since-Version': version.toString()
    }
  });

  if (!response.ok) {
    if (response.status === 412) {
      throw new Error("VERSION_MISMATCH");
    }
    let errorDetail = "";
    try {
      errorDetail = await response.text();
      // Sanitize any potential API key exposure
      errorDetail = errorDetail.replace(/Zotero-API-Key[:\s]*[^\s"']+/gi, 'Zotero-API-Key: ***');
    } catch (e) {
      errorDetail = response.statusText;
    }
    console.error(`[Zotero Service] Delete failed for item ${itemKey}: ${response.status}`);
    throw new Error(`Delete failed (${response.status}): ${errorDetail}`);
  }
}

export async function createItem(
  config: Config, 
  itemData: Partial<ZoteroItem['data']>
): Promise<ZoteroItem> {
  const { zoteroApiKey, libraryId, libraryType } = config;
  const url = `${ZOTERO_API_BASE}/${libraryType}s/${libraryId}/items`;
  
  const newItem = {
    itemType: itemData.itemType || 'journalArticle',
    ...itemData
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Zotero-API-Key': zoteroApiKey,
      'Zotero-API-Version': '3',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([newItem])
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      errorDetail = await response.text();
      // Sanitize any potential API key exposure
      errorDetail = errorDetail.replace(/Zotero-API-Key[:\s]*[^\s"']+/gi, 'Zotero-API-Key: ***');
    } catch (e) {
      errorDetail = response.statusText;
    }
    console.error(`[Zotero Service] Create item failed: ${response.status}`);
    throw new Error(`Create item failed (${response.status}): ${errorDetail}`);
  }

  const results = await response.json();
  return results.successful?.[0] || results[0];
}

export async function createNote(
  config: Config, 
  parentItemKey: string, 
  noteContent: string
): Promise<void> {
  const { zoteroApiKey, libraryId, libraryType } = config;
  const url = `${ZOTERO_API_BASE}/${libraryType}s/${libraryId}/items`;
  
  const noteItem = {
    itemType: 'note',
    parentItem: parentItemKey,
    note: noteContent,
    tags: []
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Zotero-API-Key': zoteroApiKey,
      'Zotero-API-Version': '3',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([noteItem])
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      errorDetail = await response.text();
      // Sanitize any potential API key exposure
      errorDetail = errorDetail.replace(/Zotero-API-Key[:\s]*[^\s"']+/gi, 'Zotero-API-Key: ***');
    } catch (e) {
      errorDetail = response.statusText;
    }
    console.error(`[Zotero Service] Create note failed for parent ${parentItemKey}: ${response.status}`);
    throw new Error(`Create note failed (${response.status}): ${errorDetail}`);
  }
}
