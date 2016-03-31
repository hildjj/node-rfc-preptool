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
  'dt',
  'li',
  'note',
  'references',
  'sourcecode',
  't',
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
  if (e.name() === 'references') {
    var back = e.parent()
    if (!back || (back.name() !== 'back')) {
      console.error('references not a child of back')
      return null;
    }
    var num = e.doc().find('/rfc/middle/section').length + 1;

    if (back.find('references').length == 1) {
      // if there's only one reference, next section after last in middle.
      return 'sn-' + num;
    } else {
      // if there's more than one, there's a phantom section as the parent.
      var all = e.find('count(preceding::references)') + 1;
      return 'sn-' + num + '.' + all;
    }
  }
  var sn;
  var s = e.get('ancestor::section[1]');
  if (s != null) {
    if (s.get('ancestor::back')) {
      sn = exports.appendix(s);
    } else {
      sn = exports.section(s);
    }
  } else {
    s = e.get('ancestor::abstract');
    if (s != null) {
      sn = 'abstract';
    }
    else {
      s = e.get('ancestor::note');
      if (s != null) {
        sn = "note-" + exports.sequentialNumber(s);
      } else {
        return null;
      }
    }
  }
  var pn = s.find('descendant::*').filter(exports.isPart).indexOf(e) + 1;
  if (pn == 0) {
    console.error(e.toString());
    console.error(s.find('*').map(function(t) { t.name() }));
    process.exit();
  }
  return "p-" + sn + "-" + pn;
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

att = function(e, a) {
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

exports.liNum = function(li) {
  // get the number of this li or dt.  For nested, dot them.  Guess
  // with mixed nested lists.  Users will have to be surprised.
  var ret = '';
  while (li) {
    var container = li.get('ancestor::*[self::ol or self::dl or self::ul][1]');
    if (ret) {
      ret = '.' + ret;
    }
    // ol always has @start.  ul and dl don't.
    var start = parseInt(att(container, 'start')) || 1;
    var prev = li.get('count(preceding-sibling::' + li.name() + ')')
    ret = ( start + prev ) + ret;
    li = container.get('ancestor::*[self::li or self::dt][1]');
  }
  return ret;
}
