/* ============================================================
 * storage.mjs
 *
 * Local document persistence.
 * ============================================================ */

const STORAGE_KEY = "seshat-document-editor-v1";

export function saveDocument(document) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(document)
    );

    return true;
  } catch (error) {
    console.error("Could not save Seshat document:", error);
    return false;
  }
}

export function loadDocument() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);

    if (!text) {
      return null;
    }

    const document = JSON.parse(text);

    if (!document || !Array.isArray(document.items)) {
      return null;
    }

    return document;
  } catch (error) {
    console.error("Could not load Seshat document:", error);
    return null;
  }
}

export function deleteStoredDocument() {
  localStorage.removeItem(STORAGE_KEY);
}