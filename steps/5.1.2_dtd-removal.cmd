# Fully process any Document Type Definitions (DTDs) in the input document, then
# remove the DTD. At a minimum, this entails processing the entity references
# and includes for external files.

xmllint -noent --dropdtd -
