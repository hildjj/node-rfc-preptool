# node-rfc-preptool

Prototype implementation of
[draft-iab-rfcv3-preptool](https://github.com/paulehoffman/rfcv3-preptool), used
for checking the validity of that Internet-Draft.

This tool is NOT designed to be fast.  It's designed to match the spec
literally.  Many of the steps (in the `steps/` directory) could be done all in
the same pass, avoiding XML parsing and serialization.

## Pre-requisites

You'll need the following installed on your system:

* `xmllint` from [libxml2](http://www.xmlsoft.org/)
* [nodejs](https://nodejs.org/)
* A C++ compiler, in order to install [libxmljs](https://github.com/polotek/libxmljs)

On OSX, make sure [XCode](https://developer.apple.com/xcode/download/) and it's
command-line tools are installed.  Install [homebrew](http://brew.sh/) (for
example) then:

```bash
brew install libxml2 node
```

## Installation

``` bash
npm install -g rfc-preptool
```

## Running

``` bash
rfc-preptool <input file> <output file>
```
