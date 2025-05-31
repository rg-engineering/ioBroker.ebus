#!/bin/sh

cd ~
mkdir projects
cd projects

git clone https://github.com/john30/ebusd.git
cd ebusd

git checkout tags/25.1

./autogen.sh

cmake .

make

make install-strip


sudo systemctl enable ebusd
sudo service ebusd start

