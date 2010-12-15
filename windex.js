var Cc = Components.classes;
var Ci = Components.interfaces;

var isNode = function (object) {
  if (object instanceof Ci.nsIDOMText) return false;
  return (object instanceof Ci.nsIDOMNode) ||
      (object instanceof Ci.nsIDOMHTMLDocument) ||
      (object instanceof Ci.nsIDOMWindow);
}

var Windex = exports = function(selector, context) {
  // no sense in wrapping the nodes twice
  if (selector instanceof WindexNodes) { return selector; }

  if (isNode(selector)) { return new WindexNodes([selector]); }

  if (typeof selector != "string") {
    throw new Error("$(" + selector + ", " + context + "): selector is not a Node or a String");
  }

  // TODO: return documents, windows
  if (selector == "body") return Windex(defaultContext());
  if (selector == "!document") {
    var document = defaultContext().ownerDocument;
    return Windex(document);
  }
  if (selector == "!window") {
    return Windex(defaultContext());
    var document = defaultContext().ownerDocument;
    var window = document.defaultView;
    return Windex(window);
  }

  if (!context) {
    return Windex(selector, defaultContext());
  }

  // if passed in a list of nodes, meant the first one
  if (context instanceof WindexNodes) { context = context[0]; }
  if (!isNode(context)) {
    throw new Error("$(" + selector + ", " + context + "): context is not a Node or a String");
  }
  context = new XPCNativeWrapper(context);

  return new WindexNodes([context], selector, context).find(selector);
};

Windex.prototype.defaultContext = null;

// See: http://api.jquery.com/jQuery.extend/
Windex.extend = function () {
  if (arguments.length == 1) { return this._extendWindex(arguments[0]); };
  return this._extendDestructiveMerge.apply(this, arguments);
}

Windex._extendWindex = function (methods) {
  for (name in methods) { this[name] = methods[name]; }
};

Windex._extendDestructiveMerge = function () {
  var target = (arguments[0]) ? arguments[0] : {};
  for (var i = 1; i < arguments.length; i++) {
    var object = arguments[i];
    for (key in object) {
      target[key] = object[key];
    }
  }
  return target;
};

var is_array = exports.is_array = function (obj) {
  return Object.prototype.toString.apply(obj) === "[object Array]";
};

Windex.each = function (a, f) {
  if (is_array(a) || a instanceof WindexNodes) {
    a.forEach(function (e, i) { f(i, e); });
    return;
  }
  for (key in a) { f(key, a[key]); }
};
Windex.map = function (a, f) { return a.map(f); };

Windex.inArray = function (e, a) {
  return a.some(function (aE) { return e == aE; });
};

// See: http://github.com/jeresig/sizzle/blob/master/sizzle.js
Windex.contains = function (ancestor, descendant) {
  return !!(ancestor.compareDocumentPosition(descendant) & 16);
};

var WindexNodes = function (nodes, selector, context) {
  for (i = 0; i < nodes.length; i++) {
    // See: https://developer.mozilla.org/en/XPCNativeWrapper
    this.push(new XPCNativeWrapper(nodes[i]));
  }
  this._selector = selector;
  this._context = context;
};

WindexNodes.prototype = new Array();

// MozRepl freaks out when trying to print WindexNodes
WindexNodes.prototype.toString = function () { return "[object WindexNodes]"; };

WindexNodes.prototype.find = function (selector) {
  var context = this[0];
  try {
    // See: https://developer.mozilla.org/En/DOM/Element.querySelectorAll
    var matches = context.querySelectorAll(selector);
  } catch (e if (e.name == "NS_ERROR_DOM_SYNTAX_ERR")) {
    throw new Error("invalid selector: '" + selector + "'");
  }

  // turn the matches NodeList into an array
  var nodes = [];
  for (i = 0; i < matches.length; i++) { nodes.push(matches[i]); }

  return new WindexNodes(nodes, selector, context);
};

WindexNodes.prototype.toArray = function () { return [].concat(this); }

WindexNodes.prototype.each = function (f) { return Windex.each(this, f); };

WindexNodes.prototype.filter = function (f) {
  return Array.prototype.filter.apply(this,[function (n,i) { return f(i,n); }]);
};

// See: http://api.jquery.com/children/
WindexNodes.prototype.children = function (selector) {
  var children = [];
  if (selector) { return this._childrenMatching(selector); }
  this.forEach(function (node) {
    var nodeList = node.childNodes;
    for (i = 0; i < nodeList.length; i++) {
      var node = nodeList[i];
      if (isNode(node)) {
        children.push(node);
      }
    }
  });
  return new WindexNodes(children);
};

WindexNodes.prototype._childrenMatching = function (selector) {
  var children = [];
  this.forEach(function (node) {
    var matches = new WindexNodes([node], selector, node).find(selector);
    matches.forEach(function (windexNode) { children.push(windexNode); });
  });
  return new WindexNodes(children, selector, this[0]);
};

// See: http://api.jquery.com/addClass/
WindexNodes.prototype.addClass = function (className) {
  var classesToAdd = className.split(" ");
  this.forEach(function (node) {
    var classes = (node.className) ? node.className.split(" ") : [];
    classesToAdd.forEach(function (classToAdd) {
      if (!classes.some(function (class) { return classToAdd == class; })) {
        classes.push(classToAdd);
      }
    });
    node.className = classes.join(" ");
  });
  return this;
};

// See: http://api.jquery.com/removeClass/
WindexNodes.prototype.removeClass = function (className) {
  if (!className) { return this._removeAllClasses(); }

  var classesToRemove = className.split(" ");
  this.forEach(function (node) {
    var classes = (node.className) ? node.className.split(" ") : [];
    classes = classes.filter(function (class) {
      return classesToRemove.every(function (classToRemove) {
        return class != classToRemove;
      });
    });
    node.className = classes.join(" ");
  });
  return this;
};

WindexNodes.prototype._removeAllClasses = function () {
  this.forEach(function (node) { node.className = ''; });
};

// See: http://api.jquery.com/toggleClass/
WindexNodes.prototype.toggleClass = function (className, add) {
  if (add === true) { return this.addClass(className); }
  if (add === false) { return this.removeClass(className); }
  var classesToToggle = className.split(" ");
  this.forEach(function (node) {
    var classes = node.className.split(" ");
    classesToToggle.forEach(function (classToToggle) {
      // if node has the class, remove it
      if (classes.some(function (class) { return class == classToToggle; })) {
        classes = classes.
            filter(function (class) {return class != classToToggle; });
      }
      // otherwise, add it
      else {
        classes.push(classToToggle);
      }
    });
    node.className = classes.join(" ");
  });
  return this;
};

// See: http://api.jquery.com/hasClass/
WindexNodes.prototype.hasClass = function (className) {
  var classesToFind = className.split(" ");
  return this.some(function (node) {
    var classes = node.className.split(" ");
    return classesToFind.every(function (class) {
      return Windex.inArray(class, classes);
    });
  });
};

// See: http://api.jquery.com/size/
WindexNodes.prototype.size = function () { return this.length; };

// See: http://api.jquery.com/empty/
WindexNodes.prototype.empty = function () {
  this.forEach(function (node) {
    if (!node.hasChildNodes()) { return; }
    while (node.childNodes.length >= 1){
      node.removeChild(node.firstChild);
    }
  });
  return this;
};

// See: http://api.jquery.com/remove/
// TODO: optional selector
WindexNodes.prototype.remove = function () {
  this.forEach(function (node) {
    // in case a node is already removed
    if (!node.parentNode) { return; }
    node.parentNode.removeChild(node);
  });
  return this;
};

// See: http://api.jquery.com/append/
WindexNodes.prototype.append = function (arg) {
  if (typeof arg == "string" || typeof arg == "number") {
    if (this[0].ownerDocument instanceof Ci.nsIImageDocument) {
      return this._appendHTMLtoImageDocument(arg);
    }
    return this._appendHTML(arg);
  }
  if (isNode(arg)) { return this._appendNode(arg); }
  if (arg instanceof WindexNodes) { return this._appendWindexNodes(arg); }
  throw new Error("'" + arg + "' is not a String, Node, or WindexNodes");
};

WindexNodes.prototype._appendHTML = function (html) {
  this.forEach(function (node) {
    var holder = node.ownerDocument.createElement("div");
    holder.innerHTML = html;
    while (holder.firstChild) {
      node.appendChild(holder.firstChild);
    }
  });
  return this;
};

// See: https://bugzilla.mozilla.org/show_bug.cgi?id=550612
// See: http://userscripts.org/guides/9
WindexNodes.prototype._appendHTMLtoImageDocument = function (html) {
  this.forEach(function (node) {
    var document = node.ownerDocument;
    var docType = document.implementation.createDocumentType(
      "html",
      "-//W3C//DTD HTML 4.01 Transitional//EN",
      "http://www.w3.org/TR/html4/loose.dtd"
    );
    var holderDoc = document.implementation.createDocument('', '', docType);
    var holder = holderDoc.createElement('html');
    holder.innerHTML = html;
    while (holder.firstChild) {
      node.appendChild(holder.firstChild);
    }
  });
  return this;
};
// See: https://developer.mozilla.org/En/DOM/Node.cloneNode
WindexNodes.prototype._appendNode = function (nodeToAppend) {
  this.forEach(function (node) {
    node.appendChild(nodeToAppend.cloneNode(true));
  });
  return this;
};

// See: https://developer.mozilla.org/En/DOM/Node.cloneNode
WindexNodes.prototype._appendWindexNodes = function (windexNodes) {
  this.forEach(function (node) {
    windexNodes.forEach(function (nodeToAppend) {
      node.appendChild(nodeToAppend.cloneNode(true));
    });
  });
  return this;
};

// See: https://developer.mozilla.org/En/DOM/Node.cloneNode
WindexNodes.prototype.clone = function () {
  var node = this[0];
  return node.cloneNode(true);
};

// See: http://api.jquery.com/before/
WindexNodes.prototype.before = function (arg) {
  if (typeof arg == "string" || typeof arg == "number") {
    return this._beforeHTML(arg);
  }
  if (isNode(arg)) { return this._beforeNode(arg); }
  if (arg instanceof WindexNodes) { return this._beforeWindexNodes(arg); }
  throw new Error("'" + arg + "' is not a String, Node, or WindexNodes");
};

// See: https://bugzilla.mozilla.org/show_bug.cgi?id=550612
// See: https://developer.mozilla.org/en/Code_snippets/HTML_to_DOM
WindexNodes.prototype._beforeHTML = function (html) {
  this.forEach(function (node) {
    if (node.ownerDocument instanceof Components.interfaces.nsIImageDocument) {
      var fragment = Components.classes["@mozilla.org/feed-unescapehtml;1"].
          getService(Components.interfaces.nsIScriptableUnescapeHTML).
          parseFragment(html, false, null, node);
      node.parentNode.insertBefore(fragment, node);
    } else {
      node.innerHTML = node.innerHTML + html;
    }
  });
  return this;
};

// See: https://developer.mozilla.org/En/DOM/Node.cloneNode
WindexNodes.prototype._beforeNode = function (nodeToAppend) {
  this.forEach(function (node) {
    node.parentNode.insertBefore(nodeToAppend.cloneNode(true), node);
  });
  return this;
};

// See: https://developer.mozilla.org/En/DOM/Node.cloneNode
WindexNodes.prototype._beforeWindexNodes = function (windexNodes) {
  this.forEach(function (node) {
    windexNodes.forEach(function (nodeToAppend) {
      node.parentNode.insertBefore(nodeToAppend.cloneNode(true), node);
    });
  });
  return this;
};

// See: http://api.jquery.com/html/
WindexNodes.prototype.html = function (replacement) {
  if (!replacement) { return this._htmlGet(); };
  return this._htmlSet(replacement);
};

// FIXME: innerHTML does work on ImageDocuments in FF < 4
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=550612
WindexNodes.prototype._htmlGet = function () {
  var html = "";
  this.forEach(function (node) {
    if (node.ownerDocument instanceof Components.interfaces.nsIImageDocument) {
      throw new Error("html() does not work on ImageDocuments. See: https://bugzilla.mozilla.org/show_bug.cgi?id=550612");
    }
    html += node.innerHTML;
  });
  return html;
};

WindexNodes.prototype._htmlSet = function (replacement) {
  this.forEach(function (node) { Windex(node).empty().append(replacement); });
  return this;
};

// See: http://api.jquery.com/replaceWith/
// See: http://james.padolsey.com/javascript/asynchronous-innerhtml/
// TODO: can also take a function
// TODO: can take an element or a windexNodes
WindexNodes.prototype.replaceWith = function (html) {
  this.forEach(function (node) {
    if (!node.parentNode) { return; };
    var document = node.ownerDocument;
    var div = document.createElement("div");
    Windex(div).html(html);
    var fragment = document.createDocumentFragment();
    while (div.firstChild) { fragment.appendChild(div.firstChild); }
    node.parentNode.replaceChild(fragment, node);
  });
  return this;
};

// See: http://api.jquery.com/css/
WindexNodes.prototype.css = function (name, value) {
  if (value === undefined && typeof name == "string") {
    return this._cssGet(name);
  };
  if (typeof name != "object") { return this._cssSet(name, value); };

  for (var key in name) { this._cssSet(key, name[key]); };
  return this;
};

// See: https://developer.mozilla.org/en/DOM/window.getComputedStyle
WindexNodes.prototype._cssGet = function (name) {
  var node = this[0];
  var window = node.ownerDocument.defaultView;
  var computedStyle = window.getComputedStyle(node, null);
  return computedStyle.getPropertyValue(name);
};

WindexNodes.prototype._cssSet = function (name, value) {
  var dims = ["height", "width", "top", "left", "right", "bottom"];
  if (typeof(value) == "number" &&
      dims.some(function (dim) { return name == dim; })) {
    value = parseInt(value) + "px";
  }
  var translations = {
    "z-index": "zIndex",
    "overflow-y": "overflowY",
    "overflow-x": "overflowX"
  };
  if (translations[name]) { name = translations[name]; }
  this.forEach(function (node) { node.style[name] = value; });
  return this;
};

// See: http://api.jquery.com/height/
// See: http://api.jquery.com/width/
// TODO: convert everything to px instead of pretending em == pt == px
["height", "width"].forEach(function (dim) {
  var capitalized = dim.replace(
    /^(.)(.+)/ ,
    function(m, p1, p2) { return p1.toUpperCase() + p2; }
  );

  WindexNodes.prototype[dim] = function (replacement) {
    if (!replacement) { return this["_" + dim + "Get"](); };
    return this["_" + dim + "Set"](replacement);
  };

  WindexNodes.prototype["_" + dim + "Get"] = function () {
    var node = this[0];
    if (node instanceof Components.interfaces.nsIDOMHTMLDocument) {
      return this["_" + dim + "GetForDocument"]();
    }
    if (node instanceof Components.interfaces.nsIDOMWindow) {
      return this["_" + dim + "GetForWindow"]();
    }
    return this["_" + dim + "GetForNode"]();
  };

  WindexNodes.prototype["_" + dim + "GetForNode"] = function () {
    var node = this[0];
    var value = parseInt(Windex(node)._cssGet(dim));
    return (value) ? value : 0;
  };

  WindexNodes.prototype["_" + dim + "GetForDocument"] = function () {
    var node = this[0];
    return node.documentElement["client" + capitalized];
  };

  WindexNodes.prototype["_" + dim + "GetForWindow"] = function () {
    var node = this[0];
    return node["inner" + capitalized];
  };

  WindexNodes.prototype["_" + dim + "Set"] = function (replacement) {
    this.forEach(function (node) {
      if (node instanceof Components.interfaces.nsIDOMHTMLDocument) {
        return setters[dim + "ForDocument"](node, replacement);
      }
      if (node instanceof Components.interfaces.nsIDOMWindow) {
        return setters[dim + "ForWindow"](node, replacement);
      }
      setters[dim + "ForNode"](node, replacement);
    });
    return this;
  };

  // work on a node at a time
  var setters = {};
  setters[dim + "ForNode"] = function (node, replacement) {
    return Windex(node)._cssSet(dim, (replacement) ? replacement + "px" : 0);
  };

  setters[dim + "ForDocument"] = function (node, replacement) {
    return node[dim] = replacement;
  };

  setters[dim + "ForWindow"] = function (node, replacement) {
    return node["inner" + capitalized] = replacement;
  };
});

// See: http://api.jquery.com/outerWidth/
WindexNodes.prototype.outerWidth = function (includeMargin) {
  var dims = {
    padding: 0,
    margin: 0,
    border: 0
  };
  var node = this;
  for (key in dims) {
    ["left", "right"].forEach(function (side) {
      if (includeMargin) {
        var attribute = parseInt(node.css(key + "-" + side + "-width"));
        dims[key] += (isNaN(attribute)) ? 0 : attribute;
      }
    });
  }
  var val = this[0].offsetWidth;
  if (includeMargin) { return val + dims.margin; }
  return val - dims.padding - dims.border;
};

// See: http://api.jquery.com/outerHeight/
WindexNodes.prototype.outerHeight = function (includeMargin) {
  var node = this;
  var dims = {
    padding: 0,
    margin: 0,
    border: 0
  };
  for (key in dims) {
    ["top", "bottom"].forEach(function (side) {
      if (includeMargin) {
        var attribute = parseInt(node.css(key + "-" + side + "-height"));
        dims[key] += (isNaN(attribute)) ? 0 : attribute;
      }
    });
  }
  var val = this[0].offsetHeight;
  if (includeMargin) { return val + dims.margin; }
  return val - dims.padding - dims.border;
};

// See: http://api.jquery.com/trigger/
// See: https://developer.mozilla.org/en/Code_snippets/Interaction_between_privileged_and_non-privileged_pages
WindexNodes.prototype.trigger = function (name) {
  this.forEach(function (node) {
    if (typeof node[name] == "function") {
      node[name]();
    } else {
      var event = node.ownerDocument.createEvent("Events");
      event.initEvent(name, true, false);
      node.dispatchEvent(event);
    }
  });
  return this;
};

WindexNodes.prototype.triggerHandler = function (name) {
  this.trigger(name);
  return this;
};


var events = [];

// See: http://api.jquery.com/bind/
WindexNodes.prototype.bind = function (name, handler) {
  this.forEach(function (node) {
    var wrapped = function (event) { handler.apply(node, [event]); };
    if (!events[node]) { events[node] = {}; }
    if (!events[node][name]) { events[node][name] = []; }
    events[node][name].push({ wrapped: wrapped, handler: handler });
    node.addEventListener(name, wrapped, false, false);
  });
  return this;
};

// See: http://api.jquery.com/unbind
WindexNodes.prototype.unbind = function (name, handler) {
  if (!name) { return this._unbindAll(); }
  return this._unbindEvent(name, handler);
}

WindexNodes.prototype._unbindAll = function () {
  this.forEach(function (node) {
    for (name in events[node]) {
      events[node][name].forEach(function (bridge) {
        node.removeEventListener(name, bridge.wrapped, false);
      });
    }
    delete events[node];
  });
  return this;
};

WindexNodes.prototype._unbindEvent = function (name, handler) {
  this.forEach(function (node) {
    if (!events[node][name]) return;
    events[node][name] = events[node][name].filter(function (bridge) {
      if (bridge.handler !== handler) return true;
      node.removeEventListener(name, bridge.wrapped, false);
      return false;
    });
  });
  return this;
};

[
  "click", // See: http://api.jquery.com/click/
  "mousedown",
  "mouseup",
  "mousemove",
  "keypress", // See: http://api.jquery.com/keypress/
  "keydown",
  "keyup",
  "resize", // See: http://api.jquery.com/resize/
  "submit", // See: http://api.jquery.com/submit/
  "focus", // See: http://api.jquery.com/focus/
  "blur", // See: http://api.jquery.com/blur/
  "command"
].forEach(function (event) {
  WindexNodes.prototype[event] = function (handler) {
    if (!handler) { return this.trigger(event); }
    return this.bind(event, handler);
  };
});

// See: http://api.jquery.com/live
WindexNodes.prototype.live = function (name, handler) {
  var selector = this._selector;
  var context = this._context;
  var delegater = function (event) {
    Windex(selector, context).forEach(function (node) {
      var isTarget = (node == event.originalTarget);
      var containsTarget = Windex.contains(node, event.originalTarget);
      if (isTarget || containsTarget) { handler.apply(node, [event]); }
    });
  };
  context.addEventListener(name, delegater, false);
};

// See: http://api.jquery.com/attr/
WindexNodes.prototype.attr = function (name, value) {
  if (typeof name == "object") { return this._attrSetObj(name); }
  if (value === undefined) { return this._attrGet(name); }
  return this._attrSet(name, value);
};

WindexNodes.prototype._attrGet = function (name) {
  var node = this[0];
  return node.getAttribute(name);
};

WindexNodes.prototype._attrSet = function (name, value) {
  if (name == "class") {
    this.forEach(function (node) { node.className = value; });
    return this;
  }
  this.forEach(function (node) {
    node.setAttribute(name, value);
    if(name === 'checked' && (node.type === 'checkbox' || node.type === 'radio')) {
      node.checked = value;
    }
  });
  return this;
};

WindexNodes.prototype._attrSetObj = function (obj) {
  for (key in obj) { this._attrSet(key, obj[key]); }
  return this;
};

// See: http://api.jquery.com/removeAttr/
WindexNodes.prototype.removeAttr = function (name) {
  this.forEach(function (node) {
    node.removeAttribute(name);
    if(name === 'checked' && node.type === 'checkbox') {
      node.checked = false;
    }
  });
  return this;
};

// See: http://api.jquery.com/val/
WindexNodes.prototype.val = function (replacement) {
  if (replacement === undefined) { return this._valGet(); }
  return this._valSet(replacement);
};

WindexNodes.prototype._valGet = function () {
  var node = this[0];
  return node.value;
};

WindexNodes.prototype._valSet = function (replacement) {
  this.forEach(function (node) { node.value = replacement; });
  return this;
};

// See: http://api.jquery.com/hide/
WindexNodes.prototype.hide = function () {
  this.forEach(function (node) {
    if (Windex(node).css("display") == "none") return;
    Windex(node).attr("olddisplay", Windex(node).css("display"));
    Windex(node).css("display", "none");
  });
  return this;
};

// See: http://api.jquery.com/show/
WindexNodes.prototype.show = function () {
  this.forEach(function (node) {
    node = Windex(node);
    if (node.css("display") != "none") return;
    var display = (node.attr("olddisplay")) ? node.attr("olddisplay") : "block";
    node.css("display", display).removeAttr("olddisplay");
  });
  return this;
};

WindexNodes.prototype.toggle = function () {
  this.forEach(function (node) {
    node = Windex(node);
    if (node.css("display") == "none") { node.show(); } else { node.hide(); }
  });
  return this;
};

// See: http://api.jquery.com/text/
WindexNodes.prototype.text = function (replacement) {
  if (replacement === undefined) { return this._textGet(); }
  return this._textSet(replacement);
};

WindexNodes.prototype._textGet = function () {
  return this.map(function (node) { return node.textContent; }).join(" ");
};

WindexNodes.prototype._textSet = function (replacement) {
  this.forEach(function (node) { node.textContent = replacement; });
  return this;
};

// See: http://api.jquery.com/position/
WindexNodes.prototype.position = function () {
  var node = this[0];
  return { top: node.offsetTop, left: node.offsetLeft };
};

// See: http://api.jquery.com/scrollTop/
// See: http://api.jquery.com/scrollLeft/
[
  "Top",
  "Left"
].forEach(function (direction) {
  var axis = (direction == "Top") ? "Y" : "X";

  WindexNodes.prototype["scroll" + direction] = function (replacement) {
    if (!replacement) { return this["_scroll" + direction + "Get"](); }
    return this["_scroll" + direction + "Set"](replacement);
  };

  WindexNodes.prototype["_scroll" + direction + "Get"] = function () {
    var node = this[0];
    if (node instanceof Components.interfaces.nsIDOMHTMLDocument) {
      return this["_scroll" + direction + "GetForDocument"]();
    }
    if (node instanceof Components.interfaces.nsIDOMWindow) {
      return this["_scroll" + direction + "GetForWindow"]();
    }
    return this["_scroll" + direction + "GetForNode"]();
  };

  WindexNodes.prototype["_scroll" + direction + "GetForDocument"] = function() {
    var node = this[0];
    return node.defaultView["scroll" + axis];
  };

  WindexNodes.prototype["_scroll" + direction + "GetForWindow"] = function () {
    var node = this[0];
    return node["scroll" + axis];
  };

  WindexNodes.prototype["_scroll" + direction + "GetForNode"] = function () {
    var node = this[0];
    return node["scroll" + direction];
  };

  var setters = {
    document: function (n, r) { n.defaultView["scroll" + axis] = r; },
    window: function (n, r) { n["scroll" + axis] = r; },
    node: function (n, r) { n["scroll" + direction] = r; }
  };

  WindexNodes.prototype["_scroll" + direction + "Set"] = function (replacement){
    this.forEach(function (node) {
      if (node instanceof Components.interfaces.nsIDOMHTMLDocument) {
        return setters.document(replacement);
      }
      if (node instanceof Components.interfaces.nsIDOMWindow) {
        return setters.window(replacement);
      }
      setters.node(replacement);
    });
    return this;
  };
});

WindexNodes.prototype.first = function () {
  var node = this[0];
  return new WindexNodes([node], this._selector, this._context);
};

WindexNodes.prototype.last = function () {
  var node = this[this.length - 1];
  return new WindexNodes([node], this._selector, this._context);
};

WindexNodes.prototype.next = function () {
  var selector = this._selector;
  var context = this._context;
  var node = this[0];
  if (!node.nextSibling) { return new WindexNodes([], selector, context); }
  node = node.nextSibling; // adjacent text node
  if (!node.nextSibling) { return new WindexNodes([], selector, context); }
  return new WindexNodes([node.nextSibling], selector, context);
};

WindexNodes.prototype.prev = function () {
  var selector = this._selector;
  var context = this._context;
  var node = this[0];
  if (!node.previousSibling) { return new WindexNodes([], selector, context); }
  node = node.previousSibling; // adjacent text node
  if (!node.previousSibling) { return new WindexNodes([], selector, context); }
  return new WindexNodes([node.previousSibling], selector, context);
};

Windex.url = { setUrl: function (url) { return new WindexUrl(url); } };

var WindexUrl = function (url) {
  this._url = {
    spec: "",
    host: "",
    path: ""
  };
  try {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"].
        getService(Components.interfaces.nsIIOService);
    var nsiUri = ioService.newURI(url, null, null);
    for (var key in this._url) {
      this._url[key] = nsiUri[key];
    }
  } catch (e) {}
  return this;
};

// See: https://developer.mozilla.org/en/nsIURI
// See: https://developer.mozilla.org/en/nsIIOService#newURI.28.29
WindexUrl.prototype.attr = function (name) { return this._url[name]; };

Windex.browser = {};
