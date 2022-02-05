/*
 * The smallest html5 string to vdom parser - 0.9kb gzipped
 * Code only runs on browsers as there is still a dom dependency to decode &quot; etc
 * Original code by Erik Arvidsson, Mozilla Public License (http://erik.eae.net/simplehtmlparser/simplehtmlparser.js)
 * Original code by John Resig (ejohn.org) (http://ejohn.org/blog/pure-javascript-html-parser/)
 * Original Code from HTML5 Parser By Sam Blowes (https://github.com/blowsie/Pure-JavaScript-HTML5-Parser)
 */
(function () {'use strict';
	// Regular Expressions for parsing tags and attributes
	var startTagRegex = /^<([a-zA-Z][^\s\/>]*)((?:\s+[^\s\/>"'=]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)\s*>/,
			attrRegex = /\s+([^\s\/>"'=]+)(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^>\s]+)))?/g,
	
			dummyEl = document.createElement('div'), // for attribute unquoting
			// Empty Elements - HTML 5
			empty = {AREA:1,BASE:1,BR:1,COL:1,HR:1,IMG:1,INPUT:1,LINK:1,META:1,PARAM:1,EMBED:1,COMMAND:1,KEYGEN:1,SOURCE:1,TRACK:1,WBR:1},
			// Special Elements (can contain anything)
			special = {
				SCRIPT: /^([\s\S]*?)<\/script[^>]*>/i,
				STYLE: /^([\s\S]*?)<\/style[^>]*>/i
			};

	/**
	 * @typedef VNode
	 * @property {11|1|3|8|4} nodeType node type numbered just like native Node.nodeType
	 * 11 = fragment, 1 = element, 3 = text, 8 = comment, 4 = cdata
	 * @property {string} tagName tag name for element nodes only
	 * @property {Record<string,string>} attributes attributes for element nodes only
	 * @property {VNode[]} childNodes children for element and fragment nodes only
	 * @property {string} nodeValue value (just like Node.nodeValue) for text, comment and cdata nodes only
	 */

	window.toVdom = function (html) {
		//remove trailing spaces
		html = html.trim();

		var index, chars, match,
			last = html,
			/** @type {VNode} */
			newDoc = { nodeType: 11, childNodes: [] },
			vdomStack = [newDoc],
			curParentNode = newDoc;

		// temp vars
		var tagName, unary, text, attributes, attrMatch, attrValue, elem;

		var specialReplacer = function (all, text) {
			addTextVDom(text);
			return '';
		};

		var parseEndTag = function (tagName /** uppercase only */) {
			var pos;
			if (tagName) {
				// Find the closest opened tag of the same type
				for (pos = vdomStack.length - 1; pos >= 0; pos -= 1)
					if (vdomStack[pos].tagName === tagName)
						break;
				// If no tag name is provided, clean shop
			} else pos = 0;

			if (pos >= 0) {
				// Close all the open elements, up the stack
				// * manage vdom | end tag *
				vdomStack.length = pos;
				curParentNode = vdomStack[vdomStack.length - 1];
			}
		}

		var addTextVDom = function (nodeValue) {
			// * manage vdom | add text *
			var childNodes = curParentNode.childNodes;
			if (childNodes) {
				// combine consecutive text nodes
				var prevSibling = childNodes[childNodes.length - 1];
				if (prevSibling && prevSibling.nodeType === 3) {
					prevSibling.nodeValue += nodeValue;
				} else {
					curParentNode.childNodes.push({ nodeType: 3, nodeValue: nodeValue });
				}
			}
		}

		while (html) {
			chars = true;

			//Handle script and style tags
			if (special[curParentNode.tagName]) {
				html = html.replace(special[curParentNode.tagName], specialReplacer);
				chars = false;

				parseEndTag(curParentNode.tagName);

				// end tag
			} else if (html.slice(0, 2) === '</') {
				index = html.indexOf('>');

				if (index >= 0) {
					parseEndTag(html.slice(2, index).trim().toUpperCase());
					html = html.slice(index + 1)
					chars = false;
				}

				// Comment
			} else if (html.slice(0, 4) === '<!--') {
				index = html.indexOf('-->');

				if (index >= 0) {
					// * manage vdom | add comment *
					curParentNode.childNodes.push({ nodeType: 8, nodeValue: html.slice(4, index) });
					html = html.slice(index + 3);
					chars = false;
				}

				//CDATA
			} else if (html.slice(0, 9).toUpperCase() === '<![CDATA[') {
				index = html.indexOf('>');

				if (index >= 0) {
					// * manage vdom | add cdata *
					curParentNode.childNodes.push({ nodeType: 4, nodeValue: html.slice(9, index - 2) });
					html = html.slice(index + 1);
					chars = false;
				}

			} else if (html[0] === '<') {
				match = html.match(startTagRegex);
				if (match) {
					html = html.slice(match[0].length);

					attributes = {};
					// find attributes
					attrRegex.lastIndex = 0; // reset from previous use
					while ((attrMatch = attrRegex.exec(match[2]))) {
						attrValue = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';
						// handle & encoding like &quot;
						if (attrValue.indexOf('&') > -1) {
							dummyEl.setAttribute('t', attrValue);
							attrValue = dummyEl.getAttribute('t');
						}
						attributes[attrMatch[1]] = attrValue;
					}
					tagName = match[1].toUpperCase();
					unary = !!match[3] || empty[tagName];

					// * manage vdom | add element *
					elem = {
						nodeType: 1,
						tagName: tagName,
						attributes: attributes,
						childNodes: [],
					};
	
					curParentNode.childNodes.push(elem);
	
					if (!unary) {
						vdomStack.push(elem);
						curParentNode = elem;
					}
					// * done with vdom *
				} else { //ignore the angle bracket
					html = html.slice(1);
					addTextVDom('<');
				}

				chars = false;
			}

			if (chars) {
				index = html.indexOf('<');

				text = index < 0 ? html : html.slice(0, index);
				html = index < 0 ? '' : html.slice(index);

				addTextVDom(text);
			}

			if (html === last)
				throw 'Parse Error: ' + html;
			last = html;
		}

		// Clean up any remaining tags
		parseEndTag();

		return newDoc;
	};
}());