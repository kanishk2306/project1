import { HistoryItem } from '../types';

const DB_NAME = 'GraphiGenDB';
const DB_VERSION = 1;
const STORE_HISTORY = 'history';

// Initialize the database
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Open the database
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
      reject('Database connection failed');
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    // Schema upgrade
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        // Create object store with 'id' as key
        const store = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
        // Create index for date sorting
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
};

// Save a history item
export const saveHistoryToDB = async (item: HistoryItem): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_HISTORY], 'readwrite');
      const store = transaction.objectStore(STORE_HISTORY);
      
      // Serialize Date to string for storage
      const record = { 
        ...item, 
        date: item.date.toISOString() 
      };
      
      const request = store.add(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject('Error saving to history');
    });
  } catch (error) {
    console.error("Failed to save to DB", error);
    throw error;
  }
};

// Retrieve all history items
export const getHistoryFromDB = async (): Promise<HistoryItem[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_HISTORY], 'readonly');
      const store = transaction.objectStore(STORE_HISTORY);
      const index = store.index('date');
      
      // Open cursor going backwards (newest first)
      const request = index.openCursor(null, 'prev'); 
      const results: HistoryItem[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          // Deserialize date string back to Date object
          results.push({
              ...cursor.value,
              date: new Date(cursor.value.date)
          });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject('Error fetching history');
    });
  } catch (error) {
    console.error("Failed to load from DB", error);
    return [];
  }
};
