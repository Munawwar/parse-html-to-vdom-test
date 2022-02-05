/*
 * The smallest html5 string to vdom parser - 0.9kb gzipped
 * Code only runs on browsers as there is still a dom dependency to decode &quot; etc
 * Original code by Erik Arvidsson, Mozilla Public License (http://erik.eae.net/simplehtmlparser/simplehtmlparser.js)
 * Original code by John Resig (ejohn.org) (http://ejohn.org/blog/pure-javascript-html-parser/)
 * Original Code from HTML5 Parser By Sam Blowes (https://github.com/blowsie/Pure-JavaScript-HTML5-Parser)
 */
(function () {'use strict';
	// Regular Expressions for parsing tags and attributes
	var startTagRegex = /<([a-zA-Z][^\s\/>]*)((?:\s+[^\s\/>"'=]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)\s*>/y,
			attrRegex = /\s+([^\s\/>"'=]+)(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^>\s]+)))?/g,
	
			dummyEl = document.createElement('div'), // for attribute unquoting
			// Empty Elements - HTML 5
			empty = {AREA:1,BASE:1,BR:1,COL:1,HR:1,IMG:1,INPUT:1,LINK:1,META:1,PARAM:1,EMBED:1,COMMAND:1,KEYGEN:1,SOURCE:1,TRACK:1,WBR:1},
			// Special Elements (can contain anything)
			special = {
				SCRIPT: /([\s\S]*?)<\/script[^>]*>/iy,
				STYLE: /([\s\S]*?)<\/style[^>]*>/iy
			};

	function matchFrom(str, regexWithYFlag, index) {
		regexWithYFlag.lastIndex = index;
		return regexWithYFlag.exec(str);
	}

	/**
	 * @typedef VNode
	 * @property {11|1|3|8|4} nodeType node type numbered just like native Node.nodeType
	 * 11 = fragment, 1 = element, 3 = text, 8 = comment, 4 = cdata
	 * @property {string} tagName tag name for element nodes only
	 * @property {Record<string,string>} attributes attributes for element nodes only
	 * @property {VNode[]} childNodes children for element and fragment nodes only
	 * @property {string} nodeValue value (just like Node.nodeValue) for text, comment and cdata nodes only
	 */

	 window.toVdom = function toVdom (html) {
		//remove trailing spaces
		html = html.trim();

		var index = 0,
			last = 0,
			chars,
			match,
			matchIndex,
			/** @type {VNode} */
			newDoc = { nodeType: 11, childNodes: [] },
			vdomStack = [newDoc],
			curParentNode = newDoc;

		// temp vars
		var tagName, unary, attributes, attrMatch, attrValue, elem, regex;

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

		while (index < html.length) {
			chars = true;

			//Handle script and style tags
			if ((regex = special[curParentNode.tagName])) {
				match = matchFrom(html, regex, index);
				addTextVDom(match[1]);
				index = regex.lastIndex;
				chars = false;

				parseEndTag(curParentNode.tagName);

				// end tag
			} else if (html.substr(index, 2) === '</') {
				matchIndex = html.indexOf('>', index);

				if (matchIndex >= 0) {
					parseEndTag(html.slice(index + 2, matchIndex).trim().toUpperCase());
					index = matchIndex + 1;
					chars = false;
				}

				// Comment
			} else if (html.substr(index, 4) === '<!--') {
				matchIndex = html.indexOf('-->', index);

				if (matchIndex >= 0) {
					// * manage vdom | add comment *
					curParentNode.childNodes.push({ nodeType: 8, nodeValue: html.slice(index + 4, matchIndex) });
					index = matchIndex + 3;
					chars = false;
				}

				//CDATA
			} else if (html.substr(index, 9).toUpperCase() === '<![CDATA[') {
				matchIndex = html.indexOf('>', index);

				if (matchIndex >= 0) {
					// * manage vdom | add cdata *
					curParentNode.childNodes.push({ nodeType: 4, nodeValue: html.slice(index + 9, matchIndex - 2) });
					index = matchIndex + 1;
					chars = false;
				}

			} else if (html[index] === '<') {
				match = matchFrom(html, startTagRegex, index);
				if (match) {
					tagName = match[1].toUpperCase();

					attributes = {};
					// find attributes
					attrRegex.lastIndex = 0;
					while ((attrMatch = attrRegex.exec(match[2]))) {
						attrValue = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';
						// handle & encoding like &quot;
						if (attrValue.indexOf('&') > -1) {
							dummyEl.setAttribute('t', attrValue);
							attrValue = dummyEl.getAttribute('t');
						}
						attributes[attrMatch[1]] = attrValue;
					}
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

					index = startTagRegex.lastIndex;
				} else { //ignore the angle bracket
					index += 1;
					addTextVDom('<');
				}

				chars = false;
			}

			if (chars) {
				matchIndex = html.indexOf('<', index);
				if (matchIndex < 0) matchIndex = Infinity;
				addTextVDom(html.slice(index, matchIndex));
				index = matchIndex;
			}

			if (index === last)
				throw 'Parse Error: at ' + html.slice(index);
			last = index;
		}

		// Clean up any remaining tags
		parseEndTag();

		return newDoc;
	};
}());