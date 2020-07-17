#!/bin/bash

SELF=$(cd `dirname $0`; pwd)
cd $SELF
mkdir -p local/{libwebsockets,wz}

echo Building [libwebsockets] ...
pushd local/libwebsockets
mkdir dist
cmake -DLWS_WITH_SSL=OFF -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../libwebsockets
make
popd

echo Building [wz] ...
pushd local/wz
mkdir dist
cmake -DLWS_WITH_SSL=OFF -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../wz
make
popd
