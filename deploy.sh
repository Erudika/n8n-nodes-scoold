#!/bin/bash

echo "Last tag was:" $(git describe --tags --abbrev=0)
read -e -p "(p)atch or (m)inor? P/m " ver
git add -A && git commit -m "prepare release"
if [[ "$ver" = "m" ]]; then
	npm version minor
else
	npm version patch
fi
git push origin main && git push --tags



#npm run build && \
#git add -A && git commit -am "prepare release"
#npm run release

