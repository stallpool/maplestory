#!/bin/bash

SELF=$(cd `dirname $0`; pwd)
cd $SELF
mkdir -p local/{libwebsockets,libuv,wz}

echo Building [libuv] ...
pushd local/libuv
mkdir dist
cmake -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../libuv
make
popd

echo Building [libwebsockets] ...
pushd local/libwebsockets
mkdir dist
cmake -DLWS_WITHOUT_EXTENSIONS=OFF -DLWS_WITH_ZLIB=ON -DLWS_WITH_SSL=OFF -DLWS_WITH_THREADPOOL=ON -DLWS_WITH_PLUGINS=ON -DLWS_STATIC_PIC=ON \
      -DLIBUV_INCLUDE_DIRS=`pwd`/../libuv/dist/include -DLIBUV_LIBRARIES=`pwd`/../libuv/dist/lib/libuv_a.a -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../libwebsockets
make
popd

echo Building [wz] ...
pushd local/wz
mkdir dist
cmake -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../wz
make
popd
