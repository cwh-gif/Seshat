/* ============================================================
 * history.mjs
 *
 * Snapshot-based undo / redo.
 * ============================================================ */

export class DocumentHistory {
  constructor(limit = 100) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  push(document) {
    this.undoStack.push(structuredClone(document));

    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  undo(currentDocument) {
    if (!this.undoStack.length) {
      return null;
    }

    this.redoStack.push(structuredClone(currentDocument));

    return this.undoStack.pop();
  }

  redo(currentDocument) {
    if (!this.redoStack.length) {
      return null;
    }

    this.undoStack.push(structuredClone(currentDocument));

    return this.redoStack.pop();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}