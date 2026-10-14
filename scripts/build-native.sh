#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backend/native
c++ -std=c++17 -O2 -shared -fPIC native/spatial.cpp -o backend/native/libgeobusiness.so
