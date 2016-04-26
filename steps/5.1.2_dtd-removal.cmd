# Fully process any DTDs in the input document, then remove the DTD. At a
# minimum, this entails processing the entityrefs and includes for external
# files.

xmllint -noent --dropdtd -
