(function(global) {
	
	var handlers = {};
	
	// function to replace values between double curly braces
	function injectData(data, string) {
		return string.
			replace(/\{\{![^\}]+\}\}/, ''). // remove comments
			replace(/\{\{([\w_.]+)\}\}/g, function($0, $1) { // inject data
				return resolve(data, $1) || '';
			}
		);
	}
	// move up the scope chain until the attribute is found
	// return the value or null
	function resolve(data, attrVal) {
		var value, path;
		path = attrVal.replace(/^\{\{(.+?)\}\}$/, '$1').split('.');
		value = dive(data, path);
		if (value !== undefined) {
			return value;
		}
		if ('__PARENT__' in data) {
			return resolve(data.__PARENT__, attrVal);
		}
		return '';
	}
	function dive(data, path) {
		var attr;
		while (path.length > 0 && data !== undefined) {
			attr = path.shift();
			data = data[attr];
		}
		return data;
	}
	// return true if a varialbe is falsy or an empty array
	function isEmpty(v) {
		return !v || (v.slice === Array.prototype.slice && v.length === 0);
	}
	// remove a node
	function remove(el) {
		el.parentNode.removeChild(el);
	}
	
	// function to recursively walk the DOM to handle data-repeat attributes
	// and handle attributes and inner text that contains curly braces
	function walk(el, data) {       
		var i, len;
		// replace curlies in text nodes
		if (el.nodeType === 3) {
			// text node
			el.nodeValue = injectData(data, el.nodeValue);
			return;
		}
		if (el.nodeType !== 1) {
			// not dom node (e.g. html comment)
			return;
		}
		// replace string values in attributes
		for (i = 0, len = el.attributes.length; i < len; i++) {
			if (!(el.attributes[i].name in handlers)) {
				el.setAttribute(el.attributes[i].name, injectData(data, el.attributes[i].value));
			}
		}	
		// run all handlers
		if (runAllHandlers(el, data) === false) {
			return;
		}
		if (el.parentNode && el.hasChildNodes()) {
			for (i = 0, len = el.childNodes.length; i < len; i++) {
				if (el.childNodes[i]) {
					// some nodes could be removed and be undefined now
					walk(el.childNodes[i], data);
				}
			}
		} 
	
	}
	
	function addHandler(attr, callback) {
		handlers[attr] = callback;
		return global.baffi;
	}
	
	function runAllHandlers(el, data) {
		var attr, result;
		for (attr in handlers) {
			if (!handlers.hasOwnProperty(attr) || !el.hasAttribute(attr) ) {
				continue;
			}
			result = handlers[attr].call(el, data, el.getAttribute(attr));
			el.removeAttribute(attr);
			if (result === false) {
				return false;
			}
		}
		return true;
	}
	
	// remove node if falsy
	addHandler('data-if', function ifHandler(data, attrVal) {
		if ( isEmpty( resolve(data, attrVal) ) ) {
			remove(this);
			return false;
		}
	});
	
	// remove node if truthy
	addHandler('data-if-not', function ifNotHandler(data, attrVal) {
		if ( !isEmpty( resolve(data, attrVal) ) ) {
			remove(this);
			return false;
		}
	});
	
	// loop
	addHandler('data-repeat', function repeatHandler(data, attrVal) {
		var items, i, len, clone;
		items = resolve(data, attrVal);
		// check that we have an array with one or more items
		if (!isEmpty(items)) {
			for (i = 0, len = items.length; i < len; i++) {
				this.removeAttribute('data-repeat');
				clone = this.cloneNode();
				this.parentNode.insertBefore(clone, this);
				if (typeof items[i] == 'object') {
					items[i].__PARENT__ = data;
				}
				walk(clone, items[i]);
				delete items[i].__PARENT__;
			}
		}		
		// remove this node
		remove(this);
		return false;
	});
	
    // define plugin function
    global.baffi = walk;
	global.baffi.addHandler = addHandler;
	global.baffi.injectData = injectData;
	global.baffi.version = '0.1.0';
	
})(window);