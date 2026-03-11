#!/bin/sh
set -e

APP_NAME="mass-test-runner"
APP_PATH="/mass-test-runner/"
SOURCE_DIR="/home/ndemiguel/mass-test-runner/frontend"

HOST_NGINX_ROOT="/home/jromano/docker/nginx"
TARGET_HTML_DIR="$HOST_NGINX_ROOT/html/$APP_NAME"
TARGET_CONFIG_DIR="$HOST_NGINX_ROOT/config"
TARGET_CONFIG_FILE="$TARGET_CONFIG_DIR/${APP_NAME}_nginx.config"

NODE_IMAGE="node:20-alpine"

echo "==> Deploy de $APP_NAME"

echo "==> Build dentro de container Node"
docker run --rm \
  -v "$SOURCE_DIR:/app" \
  -w /app \
  "$NODE_IMAGE" \
  sh -c "npm install && npm run build"

echo "==> Creando directorios destino"
mkdir -p "$TARGET_HTML_DIR"
mkdir -p "$TARGET_CONFIG_DIR"

echo "==> Limpiando deploy anterior"
rm -rf "$TARGET_HTML_DIR"/*

echo "==> Copiando build al html de nginx"
cp -R "$SOURCE_DIR/dist/"* "$TARGET_HTML_DIR"/

echo "==> Corrigiendo permisos para nginx"
chmod -R 755 "$TARGET_HTML_DIR"

echo "==> Generando config nginx"

cat > "$TARGET_CONFIG_FILE" <<EOF
location ~ ^$APP_PATH {
  try_files \$uri ${APP_PATH}index.html;

  proxy_set_header        Upgrade \$http_upgrade;
  proxy_set_header        Connection upgrade;
  proxy_set_header        Host \$host;
  proxy_set_header        X-Real-IP \$remote_addr;
  proxy_set_header        X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header        X-Forwarded-Proto \$scheme;
  proxy_set_header        Cookie \$http_cookie;
}
EOF

echo "==> Deploy completado"
echo
echo "HTML publicado en:"
echo "$TARGET_HTML_DIR"
echo
echo "Config nginx generada en:"
echo "$TARGET_CONFIG_FILE"
echo
echo "Reiniciar container nginx para aplicar cambios"
