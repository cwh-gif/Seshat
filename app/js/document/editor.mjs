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

      /*
      * Older saved documents may not have
      * a direction property yet.
      */
    if (!this.document.direction) {
     this.document.direction = "ltr";
    }

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

  
  reverseSelected() {
    if (this.selectedIds.size === 0) {
      return;
    }
  
    this.beforeChange();
  
    let changed = false;
  
    function reverseItems(items, selectedIds) {
      for (const item of items) {
        if (
          item.type === "sign" &&
          selectedIds.has(item.id)
        ) {
          item.reversed = !item.reversed;
          changed = true;
        }
  
        if (item.type === "group") {
          reverseItems(
            item.children,
            selectedIds
          );
        }
      }
    }
  
    reverseItems(
      this.document.items,
      this.selectedIds
    );
  
    if (changed) {
      this.changed();
    }
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


//   exportJSON() {
//     const data =
//       JSON.stringify(
//         this.document,
//         null,
//         2
//       );

//     const blob =
//       new Blob(
//         [data],
//         {
//           type: "application/json"
//         }
//       );

//     const url =
//       URL.createObjectURL(blob);

//     const a =
//       document.createElement("a");

//     a.href = url;

//     a.download =
//       `${this.document.title
//         .replace(/[^\w-]+/g, "_")}.json`;

//     a.click();

//     URL.revokeObjectURL(url);
//   }


async exportImage(format = "png") {
    const element =
      document.getElementById("document-content");
  
    if (!element) {
      alert("Document area not found.");
      return;
    }
  
    if (
      typeof window.html2canvas === "undefined"
    ) {
      alert(
        "Image export library is not available."
      );
  
      return;
    }
  
    const previousSelection =
      new Set(this.selectedIds);
  
    /*
     * Hide selection highlighting from export.
     */
    this.selectedIds.clear();
  
    await this.render();
  
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  
    try {
      const isJPEG =
        format === "jpeg" ||
        format === "jpg";
  
      const canvas =
        await window.html2canvas(
          element,
          {
            /*
             * JPEG cannot have transparency,
             * so always give it a background.
             */
            backgroundColor: "#fffdf8",
  
            scale: 2,
            useCORS: true,
            logging: false
          }
        );
  
      const safeTitle =
        String(
          this.document.title ||
          "seshat-document"
        )
          .trim()
          .replace(/[^\w-]+/g, "_");
  
      const link =
        document.createElement("a");
  
      if (isJPEG) {
        link.download =
          `${safeTitle || "seshat-document"}.jpg`;
  
        /*
         * 0.92 = JPEG quality.
         * Range is 0–1.
         */
        link.href =
          canvas.toDataURL(
            "image/jpeg",
            0.92
          );
      } else {
        link.download =
          `${safeTitle || "seshat-document"}.png`;
  
        link.href =
          canvas.toDataURL(
            "image/png"
          );
      }
  
      link.click();
  
    } catch (error) {
      console.error(
        "Image export failed:",
        error
      );
  
      alert(
        "Could not export the document."
      );
  
    } finally {
      this.selectedIds =
        previousSelection;
  
      await this.render();
    }
  }


  async copyAllGlyphs() {
    const response = await fetch("./data/glyphs.json");
  
    if (!response.ok) {
      alert("Could not load glyph data.");
      return;
    }
  
    const glyphs = await response.json();
  
    function itemToText(item) {
      if (item.type === "sign") {
        return glyphs[item.code]?.char || "";
      }
  
      if (item.type === "group") {
        return item.children
          .map(itemToText)
          .join("");
      }
  
      if (item.type === "lineBreak") {
        return "\n";
      }
  
      return "";
    }
  
    const text = this.document.items
      .map(itemToText)
      .join("");
  
    if (!text.trim()) {
      alert("There are no glyphs to copy.");
      return;
    }
  
    try {
      await navigator.clipboard.writeText(text);
    //   alert("Glyphs copied to clipboard.");
    } catch (error) {
      console.error("Could not copy glyphs:", error);
      alert("Could not copy glyphs.");
    }
  }

  async copySelectedGlyphs() {
    if (!this.selectedIds.size) {
      return false;
    }
  
    const response = await fetch("./data/glyphs.json");
  
    if (!response.ok) {
      return false;
    }
  
    const glyphs = await response.json();
  
    function itemToText(item, selectedIds) {
      if (item.type === "sign") {
        if (!selectedIds.has(item.id)) {
          return "";
        }
  
        return glyphs[item.code]?.char || "";
      }
  
      if (item.type === "group") {
        /*
         * If the whole group itself is selected,
         * copy every sign inside it.
         */
        if (selectedIds.has(item.id)) {
          return item.children
            .map(child => allItemText(child))
            .join("");
        }
  
        /*
         * Otherwise copy individually selected
         * children.
         */
        return item.children
          .map(child =>
            itemToText(child, selectedIds)
          )
          .join("");
      }
  
      return "";
    }
  
    function allItemText(item) {
      if (item.type === "sign") {
        return glyphs[item.code]?.char || "";
      }
  
      if (item.type === "group") {
        return item.children
          .map(allItemText)
          .join("");
      }
  
      return "";
    }
  
    const text = this.document.items
      .map(item =>
        itemToText(
          item,
          this.selectedIds
        )
      )
      .join("");
  
    if (!text) {
      return false;
    }
  
    try {
      await navigator.clipboard.writeText(text);
  
      return true;
    } catch (error) {
      console.error(
        "Could not copy selected glyphs:",
        error
      );
  
      return false;
    }
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