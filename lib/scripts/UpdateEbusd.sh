#!/bin/sh

sudo service ebusd stop

cd ~
cd projects
cd ebusd

git fetch

git pull 
git checkout tags/25.1

cmake .

make

./src/ebusd/ebusd --help

./src/ebusd/ebusd --version

make install

sudo service ebusd start


edit /etc/default/ebusd