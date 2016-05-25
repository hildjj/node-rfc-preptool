//- Pretty-format the XML output. (Note: there are many tools that do an
//- adequate job.)

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
