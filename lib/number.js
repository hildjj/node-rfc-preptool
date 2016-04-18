'use strict';

var fs = require('fs');
var path = require('path');
var dataUri = require('strong-data-uri');
var url = require('url');
var urllibsync = require('urllib-sync');
var xml = require('libxmljs');

exports.section = function(e) {
  var all = e.find('ancestor-or-self::section');
  var num = all.map(function(a){
    return a.get('count(preceding-sibling::section)')+1;
  }).join('.');
  if (e.get('ancestor::boilerplate')) {
    num = 'boilerplate-' + num;
  }
  return num;
};

exports.appendix = function(e) {
  var all = e.find('ancestor-or-self::section');
  return all.map(function(a, i){
    var c = a.get('count(preceding-sibling::section)')+1;
    if (i == 0) {
      c = String.fromCharCode(64 + c);
    }
    return c;
  }).join('.');
};

var parts = [
  'abstract',
  'artwork',
  'aside',
  'blockquote',
  'dd',
  'dl',
  'dt',
  'li',
  'list',
  'ol',
  'references',
  'sourcecode',
  't',
  'ul',
];

exports.isPart = function(e) {
  if (e == null) {return false};
  if ((typeof(e.get) === "function") && e.get('ancestor::reference')) {
    return false;
  }
  var nm = e;
  if (typeof(e) !== "string") {
    var p = e.parent && e.parent()
    if (p && p.name && (p.name() === 't')) {
      return false;
    }
    nm = e.name();
  }
  return (parts.indexOf(nm) >= 0);
};

exports.partNumber = function(e) {
  if (!exports.isPart(e)) {
    return null;
  }

  var prev = e.get('preceding-sibling::*[@pn][1]/@pn');
  if (prev) {
    return prev.value().replace(/\d+$/, n => parseInt(n)+1)
  }
  var s = e.get('ancestor::*[@pn][1]');
  if (!s) {
    console.error('invalid doc')
    return null;
  }
  var pn = att(s, 'pn');
  // or table or figure.  toplevel.
  switch(s.name()) {
    case 'section':
    case 'table':
    case 'figure':
      return  pn + '-1';
    default:
      return pn + '.1';
  }
};

exports.sequentialNumber = function(e) {
  return "" + (e.find('count(preceding::' + e.name() + ")") + 1);
};

var TLPs = {
  'trust200902': ["", ""],
  'noModificationTrust200902':
    ["  This document may not be modified, and derivative works of it may not be created, except to format it for publication as an RFC or to translate it into languages other than English.",
     ""],
  'noDerivativesTrust200902':
    ["  This document may not be modified, and derivative works of it may not be created, and it may not be published except as an Internet-Draft.",
     ""],
  'pre5378Trust200902':
    ["",
     "This document may contain material from IETF Documents or IETF Contributions published or made publicly available before November 10, 2008.  The person(s) controlling the copyright in some of this material may not have granted the IETF Trust the right to allow modifications of such material outside the IETF Standards Process. Without obtaining an adequate license from the person(s) controlling the copyright in such materials, this document may not be modified outside the IETF Standards Process, and derivative works of it may not be created outside the IETF Standards Process, except to format it for publication as an RFC or to translate it into languages other than English."]
};

exports.ipr = function(val) {
  return TLPs[val] || TLPs['trust200902'];
};

exports.normalize = function(t) {
  t = t.replace(/\.\s*\n\s+/gm, '.  ');
  return t.replace(/\s*\n\s+/gm, ' ');
};

var att = function(e, a) {
  var attr = e.attr(a);
  if (!attr) { return null; }
  return attr.value();
}

exports.defaultAttr = function(e, a, val) {
  if (e && a && val && !e.attr(a)) {
    e.attr(a, val);
  }
}

exports.scripts = function(text) {
  var punycode = require('punycode');
  var unicode = require('unicode-properties');
  var s = new Set();
  var decoded = punycode.ucs2.decode(text);
  var i;
  for (i=0; i<decoded.length; i++) {
    s.add(unicode.getScript(decoded[i]));
  }
  var all = [];
  s.forEach(function(scr){
     all.push(scr);
  });
  return all.sort();
}

exports.cmpAnchor = function(a, b) {
  var aa = att(a, 'anchor');
  var adr = a.get('//displayreference[@target="' + aa + '"]/@to')
  if (adr) {
    aa = adr.value();
  }

  var ba = att(b, 'anchor');
  var bdr = b.get('//displayreference[@target="' + ba + '"]/@to')
  if (bdr) {
    ba = bdr.value();
  }

  if (aa === ba) {
    return 0;
  }
  if (aa < ba) {
    return -1;
  }
  return 1;
}

exports.elementToDate = function(e) {
  var yr = att(e, 'year');
  var mn = att(e, 'month');
  var dy = att(e, 'day');
  if (!(yr && mn && dy)) {
    return null;
  }
  return new Date(yr, mn-1, dy);
}

function base26(num, start) {
  const s = num.toString(26); // 27 -> 11
  const start_code = start.charCodeAt(0);
  return s
    .split('')
    .map(c => String.fromCodePoint(start_code + parseInt(c) - 1))
    .join('')
}

exports.liNum = function(li) {
  const ol = li.parent()
  if (ol.name() !== 'ol') {
    return null;
  }

  const start = parseInt(att(ol, 'start')) || 1;
  const num = start + li.get('count(preceding-sibling::' + li.name() + ')')
  const typ = att(ol, 'type');
  switch (typ) {
    case 'a':
    case 'A':
      return base26(num, typ);
    case 'i':
      return require('roman-numerals').toRoman(num).toLowerCase();
    case 'I':
      return require('roman-numerals').toRoman(num);
    default:
      return num.toString();
  }
}
