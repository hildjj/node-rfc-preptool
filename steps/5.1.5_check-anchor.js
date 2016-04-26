// Check all elements for “anchor” attributes. If any “anchor” attribute begins
// with “s-“, “f-“, “t-“, or “i-“, give an error.
"use strict";

module.exports = (state) => {
  var doc = state.xml;
  for (let anchor of doc.find('//*[@anchor]/@anchor')) {
    const val = anchor.value();
    if (val.match(/^[sift]-/)) {
      const msg = "Invalid anchor attribute: " + val;
      const e = new Error(msg);
      e.msg = msg;
      e.line = anchor.line()
      e.element = anchor.parent();
      throw e;
    }
  }
  return doc;
}
