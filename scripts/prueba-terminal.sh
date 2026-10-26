#!/usr/bin/env bash
# Pruebas de terminal de la protección (entrega 2). El nivel de este sistema es «abierto, solo agregados»: no hay compuerta,
# porque todo lo publicado es dato abierto agregado. Lo que se prueba es lo contrario de una compuerta: que NADA delicado
# esté al alcance de un curl (ni los crudos, ni claves, ni el historial de git) y que lo publicado no traiga campos de persona.
#
#   scripts/prueba-terminal.sh https://su-sistema.vercel.app     # el sistema publicado
#   scripts/prueba-terminal.sh http://localhost:3000             # local: npm run build && npm start
#
# Cada prueba imprime OK o FALLA; termina con código 1 si alguna falla.
BASE="${1:-http://localhost:3000}"
fallas=0
codigo() { curl -s -o /dev/null -w "%{http_code}" --max-time 40 "$BASE$1"; }
espera() {  # espera <ruta> <código esperado> <qué se prueba>
  local c; c=$(codigo "$1")
  if [[ "$c" == "$2" ]]; then echo "OK    $c  $1  — $3"; else echo "FALLA $c (se esperaba $2)  $1  — $3"; fallas=$((fallas+1)); fi
}

echo "== Lo público abre (es dato abierto agregado, sin clave por decisión escrita)"
espera /                                  200 "la página"
espera /data/lago/catalogo.json           200 "el catálogo de fuentes"
espera /data/lago/seguridad.json          200 "conteos de seguridad por comuna"

echo "== Los crudos y los secretos no están al alcance"
espera /datos/crudos/victimas_viales.ndjson 404 "crudos de víctimas viales (fuera de git y del despliegue)"
espera /datos/crudos/construcciones.ndjson  404 "crudos de construcciones"
espera /ingesta/registro_fuentes.json       404 "el código de ingesta no se sirve"
espera /.env                                404 "archivo de entorno"
espera /.git/config                         404 "carpeta .git"
espera /.next/server/app/page.js            404 "build interno de Next"

echo "== Lo publicado no trae campos de persona"
ruta=$(dirname "$0")/..
if "$ruta/.venv/bin/python" "$ruta/ingesta/verificar.py" | grep -q "campo de persona"; then
  echo "FALLA un campo de persona está publicado (corre ingesta/verificar.py)"; fallas=$((fallas+1))
else echo "OK    ningún campo de persona en public/data (verificar.py)"; fi
if curl -s --max-time 40 "$BASE/data/lago/seguridad.json" | grep -q -i -E '"(sexo|edad|estado_civil|ocupacion|discapacidad|radicado)"'; then
  echo "FALLA seguridad.json publicado trae campos de persona"; fallas=$((fallas+1))
else echo "OK    seguridad.json publicado no trae sexo, edad, ocupación ni radicado"; fi

echo "== El historial de git no tiene claves"
if git -C "$ruta" log -p --all -- . ':!package-lock.json' ':!public/data' ':!*.pmtiles' ':!docs' ':!README.md' \
     | grep -i -E "^\+.*(api[_-]?key|secret[_-]?key|password\s*[:=]|bearer [a-z0-9]|ghp_[A-Za-z0-9]|AKIA[0-9A-Z]{16})" | head -3 | grep -q .; then
  echo "FALLA hay algo que parece una clave en el historial (revisa y cambia la clave: borrar el archivo no la saca del historial)"; fallas=$((fallas+1))
else echo "OK    sin claves en el historial"; fi
git -C "$ruta" check-ignore -q datos/crudos && echo "OK    datos/crudos está en .gitignore" || { echo "FALLA datos/crudos no está en .gitignore"; fallas=$((fallas+1)); }
git -C "$ruta" check-ignore -q .env && echo "OK    .env está en .gitignore" || { echo "FALLA .env no está en .gitignore"; fallas=$((fallas+1)); }

echo; [[ $fallas -eq 0 ]] && echo "✓ todas las pruebas pasan" || echo "✗ $fallas pruebas fallan"
exit $((fallas > 0))
