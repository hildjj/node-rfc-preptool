# node-rfc-preptool

Prototype implementation of
[draft-iab-rfcv3-preptool](https://github.com/paulehoffman/rfcv3-preptool), used
for checking the validity of that Internet-Draft.

This tool is NOT designed to be fast.  It's designed to match the spec
literally.  Many of the steps (in the `steps/` directory) could be done all in
the same pass, avoiding XML parsing and serialization.

## Installation

''' bash
npm install -g rfc-preptool
'''

## Running

'''
rfc-preptool <input file> <output file>
'''
