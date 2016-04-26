// Pretty-format the XML output. (Note: tools like
// https://github.com/hildjj/dentin do an adequate job.)

module.exports = (state) => {
  var dentin = require('dentin');
  return dentin.dentToString(state.xml, {
    doublequote: true,
    ignore: [
      "artwork",
      "sourcecode"
    ]
  });
}
