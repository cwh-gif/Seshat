/* ============================================================
 * renderer.mjs
 *
 * Turns the document model into DOM elements.
 * ============================================================ */

let glyphData = null;

async function loadGlyphData() {
  if (glyphData) {
    return glyphData;
  }

  const response = await fetch("./data/glyphs.json");

  if (!response.ok) {
    throw new Error(
      `Could not load glyphs.json: ${response.status}`
    );
  }

  glyphData = await response.json();

  return glyphData;
}

function createSignElement(
  item,
  glyphs,
  selectedIds,
  handlers
) {
  const element = document.createElement("button");

  element.type = "button";
  element.className = "document-sign";
  element.dataset.id = item.id;

  if (selectedIds.has(item.id)) {
    element.classList.add("selected");
  }

  const glyph = document.createElement("span");
  glyph.className = "document-glyph";

  if (item.reversed) {
    glyph.classList.add("reversed");
  }

  const data = glyphs[item.code];

  glyph.textContent =
    data && data.char
      ? data.char
      : "?";



  element.appendChild(glyph);

  if (data?.desc) {
    element.title = `${item.code}: ${data.desc}`;
  } else {
    element.title = item.code;
  }

  element.addEventListener("click", (event) => {
    event.stopPropagation();

    handlers.onSelect(
      item.id,
      event.ctrlKey || event.metaKey || event.shiftKey
    );
  });

  return element;
}

function createGroupElement(
  item,
  glyphs,
  selectedIds,
  handlers
) {
  const group = document.createElement("div");

  group.className =
    `document-group document-group-${item.direction}`;

  group.dataset.id = item.id;

  if (selectedIds.has(item.id)) {
    group.classList.add("selected");
  }

  const children = document.createElement("div");

  children.className = "document-group-children";

  for (const child of item.children) {
    children.appendChild(
      createItemElement(
        child,
        glyphs,
        selectedIds,
        handlers
      )
    );
  }

  group.appendChild(children);

  group.addEventListener("click", (event) => {
    /*
     * Clicking the blank area/border of a group
     * selects the group itself.
     *
     * Clicking a child sign selects the child instead.
     */
    if (
      event.target === group ||
      event.target === children
    ) {
      event.stopPropagation();

      handlers.onSelect(
        item.id,
        event.ctrlKey ||
          event.metaKey ||
          event.shiftKey
      );
    }
  });

  return group;
}

function createLineBreakElement(
  item,
  selectedIds,
  handlers
) {
  const element = document.createElement("button");

  element.type = "button";
  element.className = "document-line-break";
  element.dataset.id = item.id;

  if (selectedIds.has(item.id)) {
    element.classList.add("selected");
  }

  element.textContent = "↵";

  element.title = "Line break";

  element.addEventListener("click", (event) => {
    event.stopPropagation();

    handlers.onSelect(
      item.id,
      event.ctrlKey || event.metaKey || event.shiftKey
    );
  });

  return element;
}

function createItemElement(
  item,
  glyphs,
  selectedIds,
  handlers
) {
  switch (item.type) {
    case "sign":
      return createSignElement(
        item,
        glyphs,
        selectedIds,
        handlers
      );

    case "group":
      return createGroupElement(
        item,
        glyphs,
        selectedIds,
        handlers
      );

    case "lineBreak":
      return createLineBreakElement(
        item,
        selectedIds,
        handlers
      );

    default: {
      const unknown = document.createElement("div");
      unknown.textContent = `Unknown item: ${item.type}`;
      return unknown;
    }
  }
}

function createEmptyMessage() {
  const empty = document.createElement("div");

  empty.className = "document-empty";

  empty.innerHTML = `
    <div class="document-empty-icon">𓏞</div>
    <strong>Your document is empty</strong>
    <span>Add or draw a hieroglyph to begin.</span>
  `;

  return empty;
}

export async function renderDocument(
  doc,
  container,
  selectedIds,
  handlers
) {
  const glyphs = await loadGlyphData();

  container.replaceChildren();

  

  if (!doc.items.length) {
    container.appendChild(createEmptyMessage());
    return;
  }

  for (const item of doc.items) {
    container.appendChild(
      createItemElement(
        item,
        glyphs,
        selectedIds,
        handlers
      )
    );
  }

  /*
   * Clicking empty document space clears selection.
   */
  container.onclick = (event) => {
    if (event.target === container) {
      handlers.onClearSelection();
    }
  };
}