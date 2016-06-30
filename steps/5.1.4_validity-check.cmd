# Check the input against the RNG in [I-D.iab-xml2rfc]. If the input is not
# valid, give an error.

xmllint --relaxng "$STEPS_DIR/xml2rfcv3.rng" -
