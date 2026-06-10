'use strict';

const svg_pencil = "icons/svg/pictogrammers-material-design/mdi--pencil.svg"
const svg_plus = "icons/svg/pictogrammers-material-design/mdi--plus.svg"
const svg_plus_thick = "icons/svg/pictogrammers-material-design/mdi--plus-thick.svg"

// render a single bookmark node
function render(node, target, toplevel) {
  if (node.description == 'separator') return;

  var li = document.createElement('li');
  var a = document.createElement('a');

  a.dataset.id = node.id;
  var url = node.url;
  if (url)
    a.href = url;
  else
    a.tabIndex = 0;

  var text = node.title || node.name || '';
  if (!text && node.title === null) text = node.url || '';
  a.innerText = text;

  if (node.tooltip) a.title = node.tooltip;
  setClass(a, node);


  if (node.children) {
    // a.insertBefore(getAddIcon(node), a.firstChild)
    var addToFolder = getAddIcon(node)
    addToFolder.addEventListener("click", function (evt) {
      evt.stopPropagation();
    });
    a.appendChild(addToFolder);

    var editBookmarkFolder = getPencilIcon(node);
    editBookmarkFolder.addEventListener("click", function (evt) {
      evt.stopPropagation();
    });
    a.appendChild(editBookmarkFolder);

  } else {
    var editBookmarkBtn = getPencilIcon(node);
    a.appendChild(editBookmarkBtn);
    editBookmarkBtn.addEventListener("click", function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
      editBookmark(node.id, a);
    })
  }

  a.insertBefore(getIcon(node), a.firstChild);

  if (node.action) {
    a.onclick = function (event) {
      return node.action(event);
    };
  } else if (url) {
    // new background tab
    a.onclick = function (e) {
      openLink(node, 2);
      return false;
    };

    // fix opening chrome:// and file:/// urls
    var urlStart = url.substring(0, 6);
    if (urlStart === 'chrome' || urlStart === 'file:/') {
      a.onclick = function (e) {
        openLink(node, 2 || (e.ctrlKey ? 2 : 0));
        return false;
      };
      a.onauxclick = function (e) {
        if (e.button == 1) {
          openLink(node, 2);
          return false;
        }
      }
    }
  }

  li.appendChild(a);

  // folder
  if (node.children) {
    // Determines if it is an inner folder extracted out
    var extracted = !toplevel && coords[node.id];
    if (!extracted) {
      // render children
      if (a.open || localStorage.getItem('open.' + node.id)) {
        setClass(a, node, true);
        a.open = true;
        getChildrenFunction(node)(function (result) {
          renderAll(result, li);
        });
      }
    } else {
      li.classList.add('extracted');
    }

    // click handlers
    addFolderHandlers(node, a, extracted);
    if (!toplevel && !extracted)
      enableDragFolder(node, a);
  } else { // A single bookmark
    addBookmarkHandlers(node, a);
    enableDragBookmark(node, a);
  }

  target.appendChild(li);
  return li;
}

// render an array of bookmark nodes
function renderAll(nodes, target, toplevel) {
  var ul = document.createElement('ul');
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    render(node, ul, toplevel);
  }
  if (ul.childNodes.length === 0)
    render({ id: 'empty', title: '< Empty >' }, ul);
  if (toplevel)
    target.appendChild(ul);
  else {
    // wrap child ul for animation
    var wrap = document.createElement('div');
    wrap.appendChild(ul);
    target.appendChild(wrap);
  }
  updateTooltips();
  return ul;
}

// render column with given index
function renderColumn(index, target) {
  var ids = columns[index];
  if (ids.length > 0) {
    var i = 0;
    var nodes = [];
    // get all nodes for column
    var callback = function (result) {
      for (var j = 0; j < result.length; j++)
        nodes.push(result[j]);
      i++;
      if (i < ids.length)
        getSubTree(ids[i], callback);
      else {
        // render node list
        renderAll(nodes, target, true);
        addColumnHandlers(index, target);
      }
    };
    getSubTree(ids[i], callback);
  }
}

// render all columns to main div
function renderColumns() {
  // clear main div
  var target = document.getElementById('main');
  while (target.hasChildNodes())
    target.removeChild(target.lastChild);

  // render columns
  for (var i = 0; i < columns.length; i++) {
    var column = document.createElement('div');
    column.className = 'column';
    column.style.width = (1 / columns.length) * 100 + '%';

    target.appendChild(column);
    renderColumn(i, column);
  }

  enableDragDrop();
}

function editBookmark(id, a) {
  var modalToggle = document.getElementById('modal-toggle');
  var elem = document.querySelector('[data-id="' + id + '"]');
  // Ideally, elem will be set correctly for the bookmark
  if (!elem) return;
  var editBookmarkTemplate = document.getElementById('edit_bookmark_template');
  var editBookmarkClone = document.importNode(editBookmarkTemplate, true);
  var modalBox = document.getElementById('modalBox');
  modalBox.innerHTML = editBookmarkClone.innerHTML;

  var name = document.getElementById('edit_bookmark_name');
  name.value = elem.innerText;
  name.dataset.id = id;
  var url = document.getElementById('edit_bookmark_url');
  url.value = a.href;
  modalToggle.checked = true;
  document.getElementById('saveButton').addEventListener("click", function() {
    saveBookmark();
  })
}

function deleteBookmark(id, a) {
  chrome.bookmarks.remove(id, (res) => {
    loadColumns();
  });
}

// enables click and context menu for given Bookmark
function addBookmarkHandlers(node, a) {
  // context menu handler
  var items = [];
  items.push({
    label: 'Open Bookmark Link',
    action: function () {
      openLink({ url: a.href }, 2);
    }
  });

  items.push({
    label: 'Edit bookmark',
    action: function () {
      editBookmark(node.id, a);
    }
  });

  items.push(null);// spacer

  items.push({
    label: 'Delete bookmark',
    action: function () {
      deleteBookmark(node.id, a);
    }
  });

  a.oncontextmenu = function (event) {
    renderMenu(items, event.pageX, event.pageY);
    return false;
  };
}

// enables click and context menu for given folder
function addFolderHandlers(node, a, extracted) {
  if (!extracted) // Toggle disabled for original nodes that were extracted out
    // click handler
    a.onclick = function () {
      toggle(node, a, getChildrenFunction(node));
      return false;
    };

  // context menu handler
  var items = getMenuItems(node);

  // column layout items
  items.push(null);// spacer
  if (!extracted && !coords[node.id])
    items.push({
      label: 'Extract new column',
      action: function () {
        addColumn([node.id]);
      }
    });

  if (!extracted && coords[node.id]) {
    var pos = coords[node.id];
    if (pos.y > 0)
      items.push({
        label: 'Move view up',
        action: function () {
          addRow(node.id, pos.x, pos.y - 1);
        }
      });
    if (pos.y < columns[pos.x].length - 1)
      items.push({
        label: 'Move view down',
        action: function () {
          addRow(node.id, pos.x, pos.y + 2);
        }
      });
    if (pos.x > 0)
      items.push({
        label: 'Move view left',
        action: function () {
          addRow(node.id, pos.x - 1);
        }
      });
    if (pos.x < columns.length - 1)
      items.push({
        label: 'Move folder right',
        action: function () {
          addRow(node.id, pos.x + 1);
        }
      });
    if (root.indexOf(node.id) < 0)
      items.push({
        label: 'Retract folder view',
        action: function () {
          removeRow(pos.x, pos.y);
        }
      });
  } 
  
  if (extracted && coords[node.id] && root.indexOf(node.id) < 0) {
    var pos = coords[node.id]
    items.push({
      label: 'Retract folder view',
      action: function () {
        removeRow(pos.x, pos.y);
      }
    });
  }

  a.oncontextmenu = function (event) {
    renderMenu(items, event.pageX, event.pageY);
    return false;
  };
}

// enables context menu for given column
function addColumnHandlers(index, ul) {
  var items = [];
  var ids = columns[index];

  // single folder items
  if (ids.length == 1)
    items = getMenuItems({ id: ids[0] });

  // column layout items
  if (columns.length > 1) {
    items.push(null);// spacer
    if (index > 0)
      items.push({
        label: 'Move column left',
        action: function () {
          addColumn(ids, index - 1);
        }
      });
    if (index < columns.length - 1)
      items.push({
        label: 'Move column right',
        action: function () {
          addColumn(ids, index + 2);
        }
      });
    items.push({
      label: 'Remove column',
      action: function () {
        removeColumn(index);
      }
    });
    if (ids.length == 1) {
      if (index > 0)
        items.push({
          label: 'Move folder left',
          action: function () {
            addRow(ids[0], index - 1);
          }
        });
      if (index < columns.length - 1)
        items.push({
          label: 'Move folder right',
          action: function () {
            addRow(ids[0], index + 1);
          }
        });
    }
  }

  if (items.length > 0)
    ul.oncontextmenu = function (event) {
      if (event.target.tagName == 'A' || event.target.parentNode.tagName == 'A')
        return true;
      renderMenu(items, event.pageX, event.pageY);
      return false;
    };
}

// gets context menu items for given node
function getMenuItems(node) {
  var items = [];
  items.push({
    label: 'Open all links in folder',
    action: function () {
      openLinks(node);
    }
  });
  if (Number(node.id))
    items.push({
      label: 'Edit bookmarks',
      action: function () {
        openLink({ url: 'chrome://bookmarks/?id=' + node.id }, 1);
      }
    });
  return items;
}

// wraps click handler for menu items
function onMenuClick(item) {
  return function () {
    item.action();
    return false;
  };
}

// renders a popup menu at given coordinates
function renderMenu(items, x, y) {
  var ul = document.createElement('ul');
  ul.className = 'menu';
  for (var i = 0; i < items.length; i++) {
    var li = document.createElement('li');
    if (items[i]) {
      var a = document.createElement('a');
      a.innerText = items[i].label;
      a.tabIndex = 0;
      a.onclick = onMenuClick(items[i]);

      li.appendChild(a);
    } else if (i > 0 && i < items.length - 1)
      li.appendChild(document.createElement('hr'));
    else
      continue;

    ul.appendChild(li);
  }
  document.body.appendChild(ul);
  ul.style.left = Math.max(Math.min(x, window.innerWidth + window.scrollX - ul.clientWidth), 0) + 'px';
  ul.style.top = Math.max(Math.min(y, window.innerHeight + window.scrollY - ul.clientHeight), 0) + 'px';
  ul.onmousedown = function (event) {
    event.stopPropagation();
    return true;
  };

  setTimeout(function () {
    document.onclick = function () {
      closeMenu(ul);
      return true;
    };
    document.onmousedown = function () {
      closeMenu(ul);
      return true;
    };
    document.oncontextmenu = function () {
      closeMenu(ul);
      return true;
    };
    document.onkeydown = function (event) {
      if (event.keyCode == 27)
        closeMenu(ul);
      return true;
    };
  }, 20);
  return ul;
}

// removes the given popup menu
function closeMenu(ul) {
  document.body.removeChild(ul);
  document.onclick = null;
  document.onmousedown = null;
  document.oncontextmenu = null;
  document.onkeydown = null;
}

var dragIds;
var disabledBoundedRect, disabledScrollX, disabledScrollY;
var dropDisabled;
var dropTarget;
var inLowerHalf;

// enable drag and drop of a single Bookmark
function enableDragBookmark(node, a) {
  a.draggable = true;
  a.ondragstart = function (event) {
    dragIds = [node.id];
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move copy';
    this.classList.add('dragstart');
  };

  a.ondragend = function (event) {
    dragIds = null;
    this.classList.remove('dragstart');
    clearDropTarget();
  };
}

// enable drag and drop of folder
function enableDragFolder(node, a) {
  a.draggable = true;
  a.ondragstart = function (event) {
    dragIds = [node.id];
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move copy';
    this.classList.add('dragstart');
    var liContainer = this.parentNode;
    if (liContainer && liContainer.tagName == 'LI') {
      disabledBoundedRect = liContainer.getBoundingClientRect();
      disabledScrollX = window.scrollX;
      disabledScrollY = window.scrollY;
    }
  };
  a.ondragend = function (event) {
    dragIds = null;
    this.classList.remove('dragstart');
    clearDropTarget();
    if (disabledBoundedRect) {
      disabledBoundedRect = null;
      disabledScrollX = null;
      disabledScrollY = null;
    }
  };
}

// init drag and drop handlers
function enableDragDrop() {
  var main = document.getElementById('main');

  main.ondragover = function (event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    // highlight drop target
    var target = getDropTarget(event);
    if (target) {
      clearDropTarget();
      dropTarget = target;
      var bordercss = 'solid 2px rgb(85, 85, 85)';
      if (inLowerHalf)
        dropTarget.style.borderBottom = bordercss;
      else
        dropTarget.style.borderTop = bordercss;
    }
    return false;
  };

  main.ondragleave = function (event) {
    clearDropTarget();
  };

  main.ondrop = function (event) {
    event.stopPropagation();

    var target = getDropTarget(event);
    if (!target)
      return false;

    if (dragIds && dragIds.length == 1) {
      var draggedID = dragIds[0];
      var ulElem = target.parentNode;
      var liParent = ulElem.parentNode?.parentNode;
      if (!liParent) return

      var targetID = target.firstChild.dataset.id;
      // liParent must be a normal Node (could be a root element currently)
      var parentAnchor = liParent?.firstChild;
      var targetParentID = parentAnchor.dataset.id;

      if (targetID == 'empty') {
        // Dropping on an empty node is much simpler to perform
        chrome.bookmarks.move(draggedID, {
          'parentId': targetParentID,
          'index': 0
        }, (result) => {
          if (result) {
            var parentId = result['parentId'];
            localStorage.setItem('open.' + parentId, true);
            loadColumns();
          }
        });

        return false;
      }

      // Now, to make the required move
      chrome.bookmarks.getChildren(targetParentID, (result) => {
        var result_ids = result.map((item) => item['id']);
        var target_idx = result_ids.indexOf(targetID);
        if (target_idx == -1) // Target was not found in this case
          return;

        // Set as first element by default when inLowerHalf is false
        var index = 0;
        if (inLowerHalf) {
          // Check if dragged item is a sibling appearing earlier
          var index = target_idx + 1; // After the target
        }
        chrome.bookmarks.move(draggedID, {
          'parentId': targetParentID,
          'index': index
        }, (result) => {
          if (result) {
            var parentId = result['parentId'];
            localStorage.setItem('open.' + parentId, true);
            loadColumns();
          }
        });
      });
    }

    return false;
  };
}

// Get the correct LI element
function getDropTarget(event) {
  var target = event.target;
  if (!dragIds || dragIds.length != 1 || !target)
    return null;

  dropDisabled = inDisabledBoundedRect(event);
  if (dropDisabled) {
    return null;
  }

  if (target.tagName == 'A') {
    target = target.parentNode;
  } else if (target.parentNode?.tagName == 'A') { // For the child icon
    target = target.parentNode?.parentNode;
  }

  // The required LI element should be selected now
  if (!target || target.tagName != 'LI') {
    return null;
  }

  // If Target element is empty, then enforce upper half logic.
  var anchorElem = target.firstChild;
  if (anchorElem.dataset.id == 'empty') {
    // Dropping on an empty element can only be added above.
    inLowerHalf = false;
    return target;
  }

  // Elements can be dropped only on non root elements
  var grandParent = target.parentNode?.parentNode;
  if (grandParent && grandParent.className == 'column') {
    return null;
  }

  // Record if current event is in bottom half of target
  inLowerHalf = inBottomHalf(event.pageY, target);
  if (!inLowerHalf && target.previousElementSibling) {
    target = target.previousElementSibling;
    inLowerHalf = true;
  }

  return target;
}

// returns true if y position is in the bottom half of target
function inBottomHalf(pageY, target) {
  return pageY - window.scrollY - target.getBoundingClientRect().top > target.clientHeight / 2;
}

// Check if event is triggered within the disabledBoundedRect
function inDisabledBoundedRect(event) {
  // Check if coordinates, boundaries are defined
  if (!disabledBoundedRect || !disabledBoundedRect.top || !disabledBoundedRect.right
    || !disabledBoundedRect.bottom || !disabledBoundedRect.left)
    return false

  // Convert current page coordinates to viewport for disabledClientRect
  var xCoord = event.pageX - disabledScrollX;
  var yCoord = event.pageY - disabledScrollY;

  if (xCoord < disabledBoundedRect.left || xCoord > disabledBoundedRect.right)
    return false
  if (yCoord < disabledBoundedRect.top || yCoord > disabledBoundedRect.bottom)
    return false
  return true;
}

// clears droptarget styles
function clearDropTarget() {
  if (dropTarget) {
    dropTarget.style.border = null;
    dropTarget.style.margin = null;
  }
  dropTarget = null;
}

var tooltipTimeout = null;
// adds tootlips to truncated text
function updateTooltips() {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);

  tooltipTimeout = setTimeout(function () {
    tooltipTimeout = null;
    var elements = document.querySelectorAll('#main li a');
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      if (element.clientWidth + 1 < element.scrollWidth) {
        element.title = element.title || element.textContent;
      } else if (element.title === element.textContent) {
        element.title = '';
      }
    }
  }, 100);
}

// gets function that returns children of node
function getChildrenFunction(node) {
  if (node.children)
    return function (callback) {
      callback(node.children);
    };
  else
    return function (callback) {
      chrome.bookmarks.getSubTree(node.id, function (result) {
        if (result)
          callback(result[0].children);
        else {
          // remove missing bookmark locations
          if (coords[node.id])
            removeRow(coords[node.id].x, coords[node.id].y);
        }
      });
    };
}

// gets the subtree for given id
function getSubTree(id, callback) {
  chrome.bookmarks.getSubTree(id, function (result) {
    if (result)
      callback(result);
    else {
      if (coords[id])       // remove missing bookmark locations
        removeRow(coords[id].x, coords[id].y);
    }
  });
}

// sets css classes for node
function setClass(target, node, isopen) {
  if (node.className)
    target.classList.add(node.className);
  if (node.children)
    target.classList.add('folder');
  if (isopen)
    target.classList.add('open');
  else
    target.classList.remove('open');

  if (node.id == 'empty')
    target.classList.add(node.id);
}

function getAddIcon(node) {
  var icon = document.createElement('img');
  icon.className='plus';
  icon.alt = 'add an element to folder';
  icon.src = svg_plus
  // icon.appendChild(btn)
  return icon;
}

function getPencilIcon(node) {
  var icon = document.createElement('img');
  icon.className='pencil';
  icon.alt = 'pencil icon for editing';
  icon.src = svg_pencil
  // icon.appendChild(btn)
  return icon;
}

// gets best icon for a node
function getIcon(node) {
  var url = null,
    url2x = null;
  if (node.icons) {
    var size;
    for (var i in node.icons) {
      var iconInfo = node.icons[i];
      if (iconInfo.url && (!size || (iconInfo.size < size && iconInfo.size > 15))) {
        url = iconInfo.url;
        if (iconInfo.size > 31) url2x = iconInfo.url;
        size = iconInfo.size;
      }
    }
  } else if (node.icon) {
    url = node.icon;
  } else if (node.url) {
    url = `/_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=16`;
    url2x = `/_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=32`;
  }

  var icon = document.createElement(url ? 'img' : 'div');
  icon.className = 'icon';
  icon.src = url;
  if (url2x) icon.srcset = url2x + ' 2x';
  icon.alt = ' ';
  return icon;
}

// toggle folder open state
function toggle(node, a) {
  var isopen = a.open;
  setClass(a, node, !isopen);
  a.open = !isopen;
  if (isopen) {
    // close folder
    localStorage.removeItem('open.' + node.id);
    if (a.nextSibling) {
      // close folder
      animate(node, a, isopen);
    }
  } else {
    // open folder
    localStorage.setItem('open.' + node.id, true);
    // open folder
    if (a.nextSibling)
      animate(node, a, isopen);
    else
      getChildrenFunction(node)(function (result) {
        if (!a.nextSibling && a.open) {
          renderAll(result, a.parentNode, false);
          animate(node, a, isopen);
        }
      });
  }
}

// smoothly open or close folder
function animate(node, a, isopen) {
  // TODO: fix nested animations
  // wrapper needed for inner height value
  var wrap = a.nextSibling;
  if (a.animationHandle) {
    // clear last animation
    clearTimeout(a.animationHandle);
    a.animationHandle = null;
  } else {
    // start animation
    wrap.style.height = isopen ? wrap.firstChild.clientHeight + 'px' : 0;
    wrap.style.opacity = isopen ? 1 : 0;
  }
  // requestAnimationFrame twice to ensure at least one frame has passed
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (wrap) {
        wrap.className = 'wrap';
        wrap.style.height = isopen ? 0 : wrap.firstChild.clientHeight + 'px';
        wrap.style.opacity = isopen ? 0 : 1;
        wrap.style.pointerEvents = isopen ? 'none' : null;
      }
    });
  });

  var duration = 200;
  a.animationHandle = setTimeout(function () {
    a.animationHandle = null;
    if (isopen)
      a.parentNode.removeChild(wrap);
    else {
      wrap.className = null;
      wrap.removeAttribute('style');
    }
    wrap = null;
  }, duration);
}

// opens immediate children of given node in new tabs
function openLinks(node) {
  chrome.tabs.getCurrent(function (tab) {
    getChildrenFunction(node)(function (result) {
      for (var i = 0; i < result.length; i++)
        openLink(result[i], 2);
    });
  });
}

// opens given node
function openLink(node, newtab) {
  var url = node.url;
  if (url) {
    chrome.tabs.getCurrent(function (tab) {
      if (newtab)
        chrome.tabs.create({ url: url, active: (newtab == 1), openerTabId: tab.id });
      else
        chrome.tabs.update(tab.id, { url: url });
    });
  }
}

var columns; // columns[x][y] = id
var root; // root[] = id
var coords; // coords[id] = {x:x, y:y}

// ensure root folders are included
function verifyColumns() {
  // default layout
  if (columns.length === 0) {
    columns.push([]);
  }

  // find missing root items
  var missing = root.slice(0);
  for (var x = 0; x < columns.length; x++) {
    for (var y = 0; y < columns[x].length; y++) {
      var i = missing.indexOf(columns[x][y]);
      if (i > -1)
        missing.splice(i, 1);
    }
  }

  // add missing root items
  var column = columns[0];
  for (var i = 0; i < missing.length; i++) {
    column.push(missing[i]);
  }

  // populate coordinate map
  coords = {};
  for (var x = 0; x < columns.length; x++) {
    for (var y = 0; y < columns[x].length; y++) {
      coords[columns[x][y]] = { x: x, y: y };
    }
    if (columns[x].length === 0) {
      columns.splice(x, 1);
      x--;
    }
  }
}

// load columns from storage or default
function loadColumns() {
  columns = [];
  for (var x = 0; ; x++) {
    var row = [];
    for (var y = 0; ; y++) {
      var id = localStorage.getItem('column.' + x + '.' + y);
      if (id) row.push(id); else break;
    }
    if (row.length > 0) columns.push(row); else break;
  }

  if (root) {
    verifyColumns();
    renderColumns();
  } else {
    chrome.bookmarks.getTree(function (result) {
      // init root nodes
      var nodes = result[0].children;

      root = [];
      for (var i = 0; i < nodes.length; i++)
        root.push(nodes[i].id);

      verifyColumns();
      renderColumns();
    });
  }
}

// saves current column configuration to storage
function saveColumns() {
  // clear previous config
  for (var x = 0; ; x++) {
    for (var y = 0; ; y++) {
      var id = localStorage.getItem('column.' + x + '.' + y);
      if (id)
        localStorage.removeItem('column.' + x + '.' + y);
      else
        break;
    }
    if (y === 0)
      break;
  }
  verifyColumns();
  // save new config
  for (var x = 0; x < columns.length; x++) {
    for (var y = 0; y < columns[x].length; y++) {
      localStorage.setItem('column.' + x + '.' + y, columns[x][y]);
    }
  }
  // refresh
  loadColumns();
}

// creates and saves a new column
function addColumn(ids, index) {
  var column = ids.slice(0);
  // remove previous locations
  for (var x = 0; x < columns.length; x++) {
    for (var y = 0; y < columns[x].length; y++) {
      if (ids.indexOf(columns[x][y]) > -1) {
        columns[x].splice(y, 1);
        y--;
      }
    }
  }
  // insert new id
  if (index == null)
    index = columns.length;
  columns.splice(Math.min(index, columns.length), 0, column);

  // save
  saveColumns();
}

// removes given column
function removeColumn(index) {
  columns.splice(index, 1);
  saveColumns();
}

// creates and saves a new row
function addRow(id, xpos, ypos) {
  if (ypos == null)
    ypos = columns[xpos].length;

  // remove previous locations
  for (var x = 0; x < columns.length; x++) {
    var i = columns[x].indexOf(id);
    if (i > -1) {
      columns[x].splice(i, 1);
      if (x == xpos && ypos > i)
        ypos--;
    }
    if (columns[x].length === 0) {
      columns.splice(x, 1);
      x--;
      if (xpos > x)
        xpos--;
    }
  }
  // insert new id
  columns[xpos].splice(Math.min(ypos, columns[xpos].length), 0, id);

  // save
  saveColumns();
}

// removes given row
function removeRow(xpos, ypos) {
  columns[xpos].splice(ypos, 1);
  saveColumns();
}

loadColumns();

// keyboard shortcuts
document.addEventListener('keypress', function (event) {
  if (event.keyCode == 13 && event.target && event.target.onclick && event.target.tagName == 'A') {
    event.target.dispatchEvent(new MouseEvent('click'));
    event.preventDefault();
  }
});
document.addEventListener('mousedown', function (event) {
  document.body.classList.add('hide-focus');
});
document.addEventListener('keydown', function (event) {
  document.body.classList.remove('hide-focus');
});

window.onresize = function (event) {
  updateTooltips();
};

function saveBookmark() {
  var name = document.getElementById('edit_bookmark_name');
  var url = document.getElementById('edit_bookmark_url');
  if (!name?.dataset?.id) return;

  chrome.bookmarks.update(name.dataset.id, {
    'title': name.value,
    'url': url.href
  }, (result) => {
    localStorage.removeItem('open.' + result.id);
    loadColumns();
  });

  var modalToggle = document.getElementById('modal-toggle');
  modalToggle.checked = false;
}
