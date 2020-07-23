#!/bin/bash

SELF=$(cd `dirname $0`; pwd)
cd $SELF
mkdir -p local/{libwebsockets,libuv,wz}

echo Building [openssl] ...
pushd local
OPENSSL=openssl-1.1.1g
curl -O https://www.openssl.org/source/${OPENSSL}.tar.gz
tar zxf ${OPENSSL}.tar.gz
mv ${OPENSSL} openssl
cd openssl
mkdir dist
./config --prefix=`pwd`/dist -fpic
make
make install
popd

echo Building [libuv] ...
pushd local/libuv
mkdir dist
cmake -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../libuv
make
make install
popd

echo Building [libwebsockets] ...
pushd local/libwebsockets
mkdir dist
cmake -DLWS_WITHOUT_EXTENSIONS=OFF -DLWS_WITH_ZLIB=ON -DLWS_WITH_SSL=OFF -DLWS_WITH_THREADPOOL=ON -DLWS_WITH_PLUGINS=ON -DLWS_STATIC_PIC=ON \
      -DLIBUV_INCLUDE_DIRS=`pwd`/../libuv/dist/include -DLIBUV_LIBRARIES=`pwd`/../libuv/dist/lib/libuv_a.a -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../libwebsockets
make
make install
popd

echo Building [wz] ...
pushd local/wz
mkdir dist
cmake -DCMAKE_INSTALL_PREFIX=`pwd`/dist ../../wz
make
popd
