# Process all <x:include> elements. Note: <x:include>d XML may include more
# <x:include>s (with relative URLs rooted at the xml:base). The tool may be
# configurable with a limit on the depth of recursion.

xmllint --xinclude -
