#!/usr/bin/env bash
# Compila tippecanoe (felt/tippecanoe) dentro del proyecto, sin sudo: .herramientas/bin/tippecanoe
# Solo necesita gcc/g++, make y zlib, que trae build-essential. SQLite se compila desde su amalgamación.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="$RAIZ/.herramientas"
TIPPECANOE_VERSION="2.79.0"
SQLITE_URL="https://www.sqlite.org/2024/sqlite-amalgamation-3450100.zip"

if [ -x "$DESTINO/bin/tippecanoe" ]; then
  echo "tippecanoe ya está instalado: $("$DESTINO/bin/tippecanoe" --version 2>&1)"
  exit 0
fi

mkdir -p "$DESTINO/src" "$DESTINO/bin" "$DESTINO/sqlite"
cd "$DESTINO/src"

echo "→ SQLite (amalgamación)"
curl -sSL -o sqlite.zip "$SQLITE_URL"
python3 -c "import zipfile; zipfile.ZipFile('sqlite.zip').extractall('.')"
SQLITE_DIR="$(ls -d sqlite-amalgamation-*/ | head -1)"
gcc -O2 -DSQLITE_THREADSAFE=1 -c "$SQLITE_DIR/sqlite3.c" -o "$DESTINO/sqlite/sqlite3.o"
ar rcs "$DESTINO/sqlite/libsqlite3.a" "$DESTINO/sqlite/sqlite3.o"
cp "$SQLITE_DIR/sqlite3.h" "$DESTINO/sqlite/"

echo "→ tippecanoe $TIPPECANOE_VERSION"
curl -sSL -o tippecanoe.tar.gz "https://github.com/felt/tippecanoe/archive/refs/tags/$TIPPECANOE_VERSION.tar.gz"
tar xzf tippecanoe.tar.gz
cd "tippecanoe-$TIPPECANOE_VERSION"
# El Makefile toma las rutas de cabeceras de INCLUDES. Se usan rutas relativas porque make parte las
# rutas absolutas si el proyecto está en una carpeta con espacios. -ldl lo necesita la SQLite estática.
make -j"$(nproc)" \
  INCLUDES="-I../../sqlite -I. -Iclipper2/include" \
  LDFLAGS="-L../../sqlite -ldl" \
  tippecanoe tile-join
cp tippecanoe tile-join "$DESTINO/bin/"
echo "✓ $("$DESTINO/bin/tippecanoe" --version 2>&1)"
