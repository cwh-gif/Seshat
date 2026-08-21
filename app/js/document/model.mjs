/* ============================================================
 * Seshat Document Editor
 * model.mjs
 *
 * Defines the document tree.
 * ============================================================ */

export function makeId() {
  return crypto.randomUUID();
}

export function createDocument(title = "Untitled Document") {
  return {
    version: 1,
    id: makeId(),
    title,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    items: []
  };
}

export function createSign(code) {
  return {
    id: makeId(),
    type: "sign",
    code
  };
}

export function createLineBreak() {
  return {
    id: makeId(),
    type: "lineBreak"
  };
}

export function createGroup(direction, children = []) {
  if (direction !== "horizontal" && direction !== "vertical") {
    throw new Error(`Invalid group direction: ${direction}`);
  }

  return {
    id: makeId(),
    type: "group",
    direction,
    children
  };
}

export function deepClone(value) {
  return structuredClone(value);
}

/**
 * Recursively locate an item.
 *
 * Returns:
 * {
 *   item,
 *   parentArray,
 *   index
 * }
 */
export function findItem(doc, id) {
  function search(array) {
    for (let i = 0; i < array.length; i++) {
      const item = array[i];

      if (item.id === id) {
        return {
          item,
          parentArray: array,
          index: i
        };
      }

      if (item.type === "group") {
        const found = search(item.children);

        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  return search(doc.items);
}

/**
 * Returns all IDs contained by a node.
 */
export function collectIds(item) {
  const ids = [item.id];

  if (item.type === "group") {
    for (const child of item.children) {
      ids.push(...collectIds(child));
    }
  }

  return ids;
}

/**
 * Remove empty groups and simplify groups containing one child.
 */
export function normalizeDocument(doc) {
  function normalizeArray(array) {
    const output = [];

    for (const item of array) {
      if (item.type !== "group") {
        output.push(item);
        continue;
      }

      item.children = normalizeArray(item.children);

      if (item.children.length === 0) {
        continue;
      }

      if (item.children.length === 1) {
        output.push(item.children[0]);
        continue;
      }

      output.push(item);
    }

    return output;
  }

  doc.items = normalizeArray(doc.items);
  doc.modifiedAt = Date.now();

  return doc;
}