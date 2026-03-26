#!/bin/bash

npm run build && \
git add -A && git commit -am "prepare release" && \
npm run release

