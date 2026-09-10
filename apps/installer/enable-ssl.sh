#!/usr/bin/env bash
#
# XtreamPulsar — adiciona Let's Encrypt SSL a uma instalação existente.
#
# Se install.sh foi executado sem --domain, o painel sobe com configuração HTTP-only.
# Quando você obtém um domínio, este script ativa o SSL:
#   - Serve o caminho /.well-known/acme-challenge/
#   - Obtém o certificado via certbot (modo webroot, com nginx rodando)
#   - Ativa a configuração do nginx com SSL
#   - Instala cron de renovação automática todo dia às 03:00
#
# Idempotente: pode ser executado várias vezes.
#
# Uso:
#   sudo bash apps/installer/enable-ssl.sh --domain painel.exemplo.com --email voce@exemplo.com
#   sudo bash apps/installer/enable-ssl.sh --domain ... --email ... --staging   # certificado de teste
#   sudo bash apps/installer/enable-ssl.sh --domain ... --email ... --force     # pular verificação DNS
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[*]${NC} $*"; }
log_success() { echo -e "${GREEN}[+]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $*"; }
log_error()   { echo -e "${RED}[x]${NC} $*" >&2; }
log_step()    { echo -e "\n${BLUE}==>${NC} $*"; }

INSTALL_DIR="${INSTALL_DIR:-/opt/xtreampulsar}"
DOMAIN=""
EMAIL=""
STAGING=0
FORCE=0
EXTRA_DOMAINS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)      DOMAIN="${2:-}"; shift 2 ;;
    --alt)         EXTRA_DOMAINS+=("${2:-}"); shift 2 ;;
    --email)       EMAIL="${2:-}"; shift 2 ;;
    --install-dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --staging)     STAGING=1; shift ;;
    --force)       FORCE=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) log_error "Parâmetro desconhecido: $1"; exit 1 ;;
  esac
done

[[ -n "$DOMAIN" ]] || { log_error "--domain obrigatório. Exemplo: --domain painel.exemplo.com"; exit 1; }
[[ -n "$EMAIL"  ]] || { log_error "--email obrigatório (para avisos de renovação do Let's Encrypt)."; exit 1; }
[[ -d "$INSTALL_DIR" ]] || { log_error "Diretório de instalação não existe: $INSTALL_DIR"; exit 1; }
[[ $EUID -eq 0 ]] || { log_error "Execute como root (sudo)."; exit 1; }

cd "$INSTALL_DIR"
[[ -f docker-compose.yml ]] || { log_error "$INSTALL_DIR não contém docker-compose.yml."; exit 1; }

CERT_DOMAINS=(-d "$DOMAIN")
for d in "${EXTRA_DOMAINS[@]:-}"; do
  [[ -n "$d" ]] && CERT_DOMAINS+=(-d "$d")
done

# ─── 1/6 Verificação DNS ────────────────────────────────────────────────────
log_step "[1/6] Verificação DNS"
SERVER_IP="$(curl -4 -s --max-time 10 https://ifconfig.me || curl -4 -s --max-time 10 https://api.ipify.org || echo '')"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || echo '')"
log_info "IP do Servidor : ${SERVER_IP:-desconhecido}"
log_info "IP do Domínio  : ${DOMAIN_IP:-não resolvido}"

if [[ -z "$DOMAIN_IP" ]]; then
  log_error "$DOMAIN não resolveu. Primeiro crie o registro A."
  [[ $FORCE -eq 1 ]] || exit 1
elif [[ -n "$SERVER_IP" && "$DOMAIN_IP" != "$SERVER_IP" ]]; then
  log_error "$DOMAIN -> $DOMAIN_IP, mas este servidor é $SERVER_IP."
  log_error "A verificação do Let's Encrypt falhará. Corrija o registro A ou use --force."
  [[ $FORCE -eq 1 ]] || exit 1
else
  log_success "DNS correto: $DOMAIN -> $DOMAIN_IP"
fi

# ─── 2/6 Diretórios + caminho ACME ──────────────────────────────────────────
log_step "[2/6] Preparando caminho de verificação ACME"
mkdir -p nginx/ssl nginx/webroot/.well-known/acme-challenge

if ! grep -q 'acme-challenge' nginx/nginx.conf 2>/dev/null; then
  if [[ -f nginx/nginx-http-only.conf ]] && grep -q 'acme-challenge' nginx/nginx-http-only.conf; then
    cp nginx/nginx.conf "nginx/nginx.conf.bak.$(date +%s)" 2>/dev/null || true
    cp nginx/nginx-http-only.conf nginx/nginx.conf
    log_success "Configuração HTTP com caminho acme-challenge ativada"
  else
    log_error "A configuração nginx ativa não tem /.well-known/acme-challenge/ e nenhum template foi encontrado."
    log_error "Execute 'git pull' primeiro (nginx-http-only.conf foi atualizado)."
    exit 1
  fi
fi

docker compose up -d nginx >/dev/null 2>&1 || true
docker compose restart nginx >/dev/null 2>&1 || true
sleep 3

TOKEN="xp-selftest-$$"
echo "$TOKEN" > "nginx/webroot/.well-known/acme-challenge/$TOKEN"
GOT="$(curl -s --max-time 15 "http://${DOMAIN}/.well-known/acme-challenge/${TOKEN}" || echo '')"
rm -f "nginx/webroot/.well-known/acme-challenge/$TOKEN"
if [[ "$GOT" == "$TOKEN" ]]; then
  log_success "Self-test ACME bem-sucedido (porta 80 acessível externamente)"
else
  log_error "Self-test ACME falhou. http://${DOMAIN}/.well-known/acme-challenge/ não pode ser lido externamente."
  log_error "Verifique: firewall 80/tcp aberto, DNS propagado, nginx rodando?"
  [[ $FORCE -eq 1 ]] || exit 1
fi

# ─── 3/6 Self-signed temporário (para carregar a config SSL) ────────────────
log_step "[3/6] Verificando arquivos de certificado"
if [[ ! -f nginx/ssl/fullchain.pem || ! -f nginx/ssl/privkey.pem ]]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem \
    -subj "/CN=${DOMAIN}" &>/dev/null
  log_success "Certificado self-signed temporário criado (será substituído em breve)"
else
  log_info "Arquivos de certificado existentes encontrados"
fi

# ─── 4/6 Let's Encrypt ─────────────────────────────────────────────────────
log_step "[4/6] Obtendo certificado Let's Encrypt"
CERTBOT_ARGS=(certonly --webroot --webroot-path /var/www/certbot
  "${CERT_DOMAINS[@]}" --email "$EMAIL"
  --agree-tos --non-interactive --no-eff-email --keep-until-expiring)
[[ $STAGING -eq 1 ]] && CERTBOT_ARGS+=(--staging)

if ! docker run --rm \
  -v "${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt" \
  -v "${INSTALL_DIR}/nginx/webroot:/var/www/certbot" \
  certbot/certbot "${CERTBOT_ARGS[@]}" 2>&1 | tee /tmp/xp_certbot.log; then
  log_error "Não foi possível obter o certificado. Log: /tmp/xp_certbot.log"
  exit 1
fi

SSL_LIVE="nginx/ssl/live/${DOMAIN}"
[[ -f "${SSL_LIVE}/fullchain.pem" ]] || { log_error "Certificado esperado não encontrado: ${SSL_LIVE}"; exit 1; }
cp "${SSL_LIVE}/fullchain.pem" nginx/ssl/fullchain.pem
cp "${SSL_LIVE}/privkey.pem"   nginx/ssl/privkey.pem
chmod 600 nginx/ssl/privkey.pem
log_success "Certificado obtido: $DOMAIN"

# ─── 5/6 Ativar configuração nginx com SSL ──────────────────────────────────
log_step "[5/6] Ativando configuração SSL do nginx"
TMP_CONF="$(mktemp)"
if git -C "$INSTALL_DIR" show HEAD:nginx/nginx.conf > "$TMP_CONF" 2>/dev/null && grep -q 'listen 443' "$TMP_CONF"; then
  cp nginx/nginx.conf "nginx/nginx.conf.bak.$(date +%s)"
  cp "$TMP_CONF" nginx/nginx.conf
  log_success "Configuração SSL escrita (git HEAD:nginx/nginx.conf)"
else
  log_warning "Template de configuração SSL não pôde ser obtido do git; configuração nginx atual preservada."
fi
rm -f "$TMP_CONF"

if ! docker compose exec -T nginx nginx -t >/dev/null 2>&1; then
  log_error "Teste da configuração nginx falhou. Restaurando último backup."
  LAST_BAK="$(ls -1t nginx/nginx.conf.bak.* 2>/dev/null | head -1 || true)"
  [[ -n "$LAST_BAK" ]] && cp "$LAST_BAK" nginx/nginx.conf
  docker compose restart nginx >/dev/null 2>&1 || true
  exit 1
fi
docker compose restart nginx >/dev/null 2>&1
sleep 3
log_success "nginx reiniciado"

# ─── 6/6 Renovação automática + firewall ────────────────────────────────────
log_step "[6/6] Configurando renovação automática"
RENEW_CMD="docker run --rm -v ${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt -v ${INSTALL_DIR}/nginx/webroot:/var/www/certbot certbot/certbot renew --quiet --webroot --webroot-path /var/www/certbot --deploy-hook 'cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/letsencrypt/fullchain.pem && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/letsencrypt/privkey.pem' && docker compose -f ${INSTALL_DIR}/docker-compose.yml restart nginx"
(crontab -l 2>/dev/null | grep -v 'certbot/certbot renew'; echo "0 3 * * * ${RENEW_CMD}") | crontab -
log_success "Cron de renovação instalado (todo dia às 03:00)"

command -v ufw >/dev/null 2>&1 && ufw allow 443/tcp comment 'HTTPS' >/dev/null 2>&1 || true

echo
log_success "SSL ativo: https://${DOMAIN}"
log_info "Atualize o valor SERVER_URL no .env para https://${DOMAIN} e execute"
log_info "'docker compose up -d --build && docker compose restart nginx'."
log_warning "A porta 80 agora redireciona para HTTPS. Para clientes Xtream, a porta HTTP é: 25461"
