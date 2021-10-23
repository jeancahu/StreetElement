#!/bin/bash

sed 's|#[ ]*sourceMappingURL=.\{0,26\}\.map||g' ./dist/main.bundle.js -i

exit 0
