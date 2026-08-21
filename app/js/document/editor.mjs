/* ============================================================
 * editor.mjs
 *
 * Main document-editing controller.
 * ============================================================ */

import {
  createDocument,
  createSign,
  createLineBreak,
  createGroup,
  findItem,
  normalizeDocument
} from "./model.mjs";

import {
  renderDocument
} from "./renderer.mjs";

import {
  DocumentHistory
} from "./history.mjs";

import {
  saveDocument,
  loadDocument,
  deleteStoredDocument
} from "./storage.mjs";

export class DocumentEditor {
  constructor(container, options = {}) {
    if (!container) {
      throw new Error(
        "DocumentEditor needs a valid container element."
      );
    }

    this.container = container;

    this.document =
      loadDocument() ||
      createDocument();

    this.history = new DocumentHistory();

    this.selectedIds = new Set();

    this.onChange =
      options.onChange ||
      (() => {});

    this.render();
  }

  /* ========================================================
   * INTERNAL
   * ======================================================== */

  beforeChange() {
    this.history.push(this.document);
  }

  changed() {
    normalizeDocument(this.document);

    saveDocument(this.document);

    this.render();

    this.onChange(this.getState());
  }

  getState() {
    return {
      document: structuredClone(this.document),
      selectedIds: [...this.selectedIds],
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo()
    };
  }

  getSelectedTopLevelEntries() {
    return this.document.items
      .map((item, index) => ({
        item,
        index
      }))
      .filter(({ item }) =>
        this.selectedIds.has(item.id)
      );
  }

  /* ========================================================
   * SELECTION
   * ======================================================== */

  select(id, additive = false) {
    if (!additive) {
      /*
       * Clicking an already-selected single item toggles it off.
       */
      if (
        this.selectedIds.size === 1 &&
        this.selectedIds.has(id)
      ) {
        this.selectedIds.clear();
        this.render();
        return;
      }

      this.selectedIds.clear();
    }

    if (
      additive &&
      this.selectedIds.has(id)
    ) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }

    this.render();
  }

  clearSelection() {
    this.selectedIds.clear();
    this.render();
  }

  selectAll() {
    this.selectedIds.clear();

    for (const item of this.document.items) {
      this.selectedIds.add(item.id);
    }

    this.render();
  }

  /* ========================================================
   * INSERT
   * ======================================================== */

  insertSign(code) {
    if (!code) {
      return;
    }

    code = String(code).trim();

    if (!code) {
      return;
    }

    this.beforeChange();

    const sign = createSign(code);

    const selected =
      this.getSelectedTopLevelEntries();

    /*
     * If a top-level item is selected,
     * insert immediately after the final selected one.
     */
    if (selected.length) {
      const index =
        Math.max(
          ...selected.map(entry => entry.index)
        ) + 1;

      this.document.items.splice(
        index,
        0,
        sign
      );
    } else {
      this.document.items.push(sign);
    }

    this.selectedIds.clear();
    this.selectedIds.add(sign.id);

    this.changed();
  }

  insertLineBreak() {
    this.beforeChange();

    const lineBreak = createLineBreak();

    const selected =
      this.getSelectedTopLevelEntries();

    if (selected.length) {
      const index =
        Math.max(
          ...selected.map(entry => entry.index)
        ) + 1;

      this.document.items.splice(
        index,
        0,
        lineBreak
      );
    } else {
      this.document.items.push(lineBreak);
    }

    this.selectedIds.clear();
    this.selectedIds.add(lineBreak.id);

    this.changed();
  }

  /* ========================================================
   * DELETE
   * ======================================================== */

  deleteSelected() {
    if (!this.selectedIds.size) {
      return;
    }

    this.beforeChange();

    const removeFrom = (array) => {
      for (let i = array.length - 1; i >= 0; i--) {
        const item = array[i];

        if (this.selectedIds.has(item.id)) {
          array.splice(i, 1);
          continue;
        }

        if (item.type === "group") {
          removeFrom(item.children);
        }
      }
    };

    removeFrom(this.document.items);

    this.selectedIds.clear();

    this.changed();
  }

  /* ========================================================
   * REORDER TOP-LEVEL ITEMS
   * ======================================================== */

  moveSelectedLeft() {
    const selected =
      this.getSelectedTopLevelEntries();

    if (selected.length !== 1) {
      return;
    }

    const { index } = selected[0];

    if (index <= 0) {
      return;
    }

    this.beforeChange();

    const array = this.document.items;

    [
      array[index - 1],
      array[index]
    ] = [
      array[index],
      array[index - 1]
    ];

    this.changed();
  }

  moveSelectedRight() {
    const selected =
      this.getSelectedTopLevelEntries();

    if (selected.length !== 1) {
      return;
    }

    const { index } = selected[0];

    if (
      index >=
      this.document.items.length - 1
    ) {
      return;
    }

    this.beforeChange();

    const array = this.document.items;

    [
      array[index],
      array[index + 1]
    ] = [
      array[index + 1],
      array[index]
    ];

    this.changed();
  }

  /* ========================================================
   * GROUPING
   * ======================================================== */

  groupSelected(direction) {
    const selected =
      this.getSelectedTopLevelEntries()
        .sort((a, b) => a.index - b.index);

    if (selected.length < 2) {
      alert(
        "Select at least two top-level signs/groups first. " + 
        "(Ctrl + Click)"
      );

      return;
    }

    /*
     * Selection must be contiguous.
     */
    for (
      let i = 1;
      i < selected.length;
      i++
    ) {
      if (
        selected[i].index !==
        selected[i - 1].index + 1
      ) {
        alert(
          "The selected items must be next to each other."
        );

        return;
      }
    }

    if (
      selected.some(
        ({ item }) =>
          item.type === "lineBreak"
      )
    ) {
      alert(
        "Line breaks cannot be placed inside a group."
      );

      return;
    }

    this.beforeChange();

    const firstIndex =
      selected[0].index;

    const children =
      selected.map(({ item }) => item);

    const group =
      createGroup(
        direction,
        children
      );

    this.document.items.splice(
      firstIndex,
      selected.length,
      group
    );

    this.selectedIds.clear();
    this.selectedIds.add(group.id);

    this.changed();
  }

  groupHorizontal() {
    this.groupSelected("horizontal");
  }

  groupVertical() {
    this.groupSelected("vertical");
  }

  ungroupSelected() {
    if (this.selectedIds.size !== 1) {
      return;
    }

    const id =
      [...this.selectedIds][0];

    const found =
      findItem(
        this.document,
        id
      );

    if (
      !found ||
      found.item.type !== "group"
    ) {
      return;
    }

    this.beforeChange();

    found.parentArray.splice(
      found.index,
      1,
      ...found.item.children
    );

    const children =
      found.item.children;

    this.selectedIds.clear();

    for (const child of children) {
      this.selectedIds.add(child.id);
    }

    this.changed();
  }

  /* ========================================================
   * UNDO / REDO /CLEARALL
   * ======================================================== */

  undo() {
    const previous =
      this.history.undo(
        this.document
      );

    if (!previous) {
      return;
    }

    this.document = previous;

    this.selectedIds.clear();

    saveDocument(this.document);

    this.render();

    this.onChange(this.getState());
  }

  redo() {
    const next =
      this.history.redo(
        this.document
      );

    if (!next) {
      return;
    }

    this.document = next;

    this.selectedIds.clear();

    saveDocument(this.document);

    this.render();

    this.onChange(this.getState());
  }

  clearAll() {
    if (!this.document.items.length) {
      return;
    }
  
    const ok = confirm(
      "Clear all characters from this document?"
    );
  
    if (!ok) {
      return;
    }
  
    this.beforeChange();
  
    this.document.items = [];
    this.selectedIds.clear();
  
    this.changed();
  }

  /* ========================================================
   * DOCUMENT OPERATIONS
   * ======================================================== */

  newDocument() {
    if (
      this.document.items.length &&
      !confirm(
        "Clear the current document and create a new one?"
      )
    ) {
      return;
    }

    this.history.clear();

    this.document =
      createDocument();

    this.selectedIds.clear();

    deleteStoredDocument();

    saveDocument(this.document);

    this.render();

    this.onChange(this.getState());
  }

  rename(title) {
    title = String(title || "").trim();

    if (!title) {
      return;
    }

    this.beforeChange();

    this.document.title = title;
    this.document.modifiedAt = Date.now();

    this.changed();
  }

  exportJSON() {
    const data =
      JSON.stringify(
        this.document,
        null,
        2
      );

    const blob =
      new Blob(
        [data],
        {
          type: "application/json"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `${this.document.title
        .replace(/[^\w-]+/g, "_")}.json`;

    a.click();

    URL.revokeObjectURL(url);
  }


  
  async exportPNG() {
    const glyphResponse = await fetch("./data/glyphs.json");
  
    if (!glyphResponse.ok) {
      alert("Could not load glyph data.");
      return;
    }
  
    const glyphs = await glyphResponse.json();
  
    const padding = 40;
    const signSize = 80;
    const codeHeight = 22;
    const gap = 16;
    const lineHeight = signSize + codeHeight + 30;
  
    const rows = [];
    let currentRow = [];
  
    for (const item of this.document.items) {
      if (item.type === "lineBreak") {
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentRow.push(item);
      }
    }
  
    rows.push(currentRow);
  
    function measureItem(item) {
      if (item.type === "sign") {
        return {
          width: signSize,
          height: signSize + codeHeight
        };
      }
  
      if (item.type === "group") {
        const children = item.children.map(measureItem);
  
        if (item.direction === "horizontal") {
          return {
            width:
              children.reduce(
                (sum, child) => sum + child.width,
                0
              ) +
              gap * Math.max(0, children.length - 1),
  
            height: Math.max(
              ...children.map(child => child.height)
            )
          };
        }
  
        return {
          width: Math.max(
            ...children.map(child => child.width)
          ),
  
          height:
            children.reduce(
              (sum, child) => sum + child.height,
              0
            ) +
            gap * Math.max(0, children.length - 1)
        };
      }
  
      return {
        width: 0,
        height: 0
      };
    }
  
    const rowMeasurements = rows.map(row => {
      const items = row.map(measureItem);
  
      const width =
        items.reduce(
          (sum, item) => sum + item.width,
          0
        ) +
        gap * Math.max(0, items.length - 1);
  
      const height =
        items.length
          ? Math.max(...items.map(item => item.height))
          : lineHeight;
  
      return {
        items,
        width,
        height
      };
    });
  
    const canvasWidth =
      Math.max(
        400,
        ...rowMeasurements.map(row => row.width)
      ) +
      padding * 2;
  
    const canvasHeight =
      rowMeasurements.reduce(
        (sum, row) => sum + row.height,
        0
      ) +
      gap * Math.max(0, rowMeasurements.length - 1) +
      padding * 2;
  
    const canvas = document.createElement("canvas");
  
    canvas.width = Math.ceil(canvasWidth);
    canvas.height = Math.ceil(canvasHeight);
  
    const ctx = canvas.getContext("2d");
  
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  
    ctx.fillStyle = "#1c1a17";
  
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  
    function drawItem(item, x, y) {
      if (item.type === "sign") {
        const data = glyphs[item.code];
  
        const char =
          data?.char || "?";
  
        ctx.font =
          '64px "Noto Sans Egyptian Hieroglyphs", "Segoe UI Historic", sans-serif';
  
        ctx.fillText(
          char,
          x + signSize / 2,
          y + signSize / 2
        );
  
        ctx.font =
          "12px sans-serif";
  
        ctx.fillText(
          item.code,
          x + signSize / 2,
          y + signSize + 8
        );
  
        return;
      }
  
      if (item.type === "group") {
        const measurements =
          item.children.map(measureItem);
  
        if (item.direction === "horizontal") {
          let childX = x;
  
          for (let i = 0; i < item.children.length; i++) {
            const child =
              item.children[i];
  
            const size =
              measurements[i];
  
            drawItem(
              child,
              childX,
              y
            );
  
            childX +=
              size.width + gap;
          }
  
          return;
        }
  
        let childY = y;
  
        for (let i = 0; i < item.children.length; i++) {
          const child =
            item.children[i];
  
          const size =
            measurements[i];
  
          drawItem(
            child,
            x,
            childY
          );
  
          childY +=
            size.height + gap;
        }
      }
    }
  
    let y = padding;
  
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row =
        rows[rowIndex];
  
      const measurements =
        rowMeasurements[rowIndex];
  
      let x = padding;
  
      for (let i = 0; i < row.length; i++) {
        const item =
          row[i];
  
        drawItem(
          item,
          x,
          y
        );
  
        x +=
          measurements.items[i].width +
          gap;
      }
  
      y +=
        measurements.height +
        gap;
    }
  
    const link =
      document.createElement("a");
  
    const safeTitle =
      this.document.title
        .replace(/[^\w-]+/g, "_");
  
    link.download =
      `${safeTitle || "seshat-document"}.png`;
  
    link.href =
      canvas.toDataURL("image/png");
  
    link.click();
  }

  /* ========================================================
   * RENDER
   * ======================================================== */

  async render() {
    await renderDocument(
      this.document,
      this.container,
      this.selectedIds,
      {
        onSelect:
          (id, additive) =>
            this.select(
              id,
              additive
            ),

        onClearSelection:
          () =>
            this.clearSelection()
      }
    );
  }
}