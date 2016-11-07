"use strict";

const FILE_RE = /^([0-9.]+)_([^.]+)\.(cmd|pug|js)$/;

class Version {
  constructor (nm, strver, desc, typ) {
    this.nm     = nm;
    this.strver = strver;
    this.ver    = strver.split('.').map(d => parseInt(d));
    this.desc   = desc;
    this.typ    = typ;
  }

  cmp(other) {
    if (!other) {
      return 1;
    }
    for (let i=0; i<Math.max(this.ver.length, other.ver.length); i++) {
      const a = this.ver[i];
      const b = other.ver[i];
      // one must be non-null at this point
      if (!a) { return -1; }
      if (!b) { return 1; }
      if (a !== b) { return a - b };
    }
    return 0;
  }

  static make(filename) {
    if (!filename) {
      return null;
    }
    const m = filename.match(FILE_RE);
    if (!m) {
      return null;
    }
    return new Version(filename, m[1], m[2], m[3]);
  }

  static makeAll(files) {
    var ret = files.reduce((good, f) => {
      const v = Version.make(f);
      if (v) { good.push(v); }
      return good;
    }, []);
    return ret.sort(Version.compare);
  }

  static compare(va,vb) {
    if (!va || !vb) {
      if (!va && !vb) { return 0; }
      if (!va) { return -1; }
      return 1;
    }
    return va.cmp(vb);
  }
}
module.exports = Version;
