#!/usr/bin/env sh

SHELL_PATH=`dirname $0`
cd $SHELL_PATH/../lib/node_modules/node-s3-file-manager/lib

node --harmony index.js $*
