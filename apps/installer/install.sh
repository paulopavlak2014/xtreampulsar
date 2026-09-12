#!/bin/bash
set -euo pipefail

# ─── Proteção curl | bash ────────────────────────────────────────────────────
# O script, quando executado via `curl ... | sudo bash`, é lido pelo bash pelo STDIN.
# Comandos que consomem stdin como `docker compose exec` engolem o restante do
# script; a instalação falha silenciosamente no passo 6/9 sem erro algum.
# Além disso, ${BASH_SOURCE[0]} é indefinido nesse modo e `set -u` aborta.
# Solução: baixar o script para um arquivo temporário e re-executá-lo.
INSTALLER_URL="${INSTALLER_URL:-https://raw.githubusercontent.com/paulopavlak2014/xtreampulsar/main/apps/installer/install.sh}"
if [[ -z "${XP_REEXEC:-}" && ! -r "${BASH_SOURCE[0]:-}" ]]; then
  XP_SELF="$(mktemp /tmp/xp-install.XXXXXX.sh)"
  if command -v curl &>/dev/null; then
    curl -fsSL "$INSTALLER_URL" -o "$XP_SELF"
  elif command -v wget &>/dev/null; then
    wget -qO "$XP_SELF" "$INSTALLER_URL"
  else
    echo "curl ou wget necessário: apt-get update && apt-get install -y curl" >&2
    exit 1
  fi
  [[ -s "$XP_SELF" ]] || { echo "script de instalação não pôde ser baixado: $INSTALLER_URL" >&2; exit 1; }
  export XP_REEXEC=1 XP_SELF
  exec bash "$XP_SELF" "$@"
fi
# Limpa a cópia temporária após re-execução.
if [[ -n "${XP_SELF:-}" ]]; then
  trap 'rm -f "$XP_SELF"' EXIT
fi

# ─── Colors & Symbols ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'
CHECK="${GREEN}✓${RESET}"
CROSS="${RED}✗${RESET}"

# ─── Logging ─────────────────────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
log_success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_warning() { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_step()    { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }

# ─── Spinner ─────────────────────────────────────────────────────────────────
spinner() {
  local pid=$1
  local msg="${2:-Aguarde...}"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r${CYAN}%s${RESET}  %s" "${frames[$((i % ${#frames[@]}))]}" "$msg"
    i=$((i + 1))
    sleep 0.1
  done
  printf "\r\033[K"
}

# ─── Helpers ─────────────────────────────────────────────────────────────────
generate_password() {
  openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20
}

check_command() {
  command -v "$1" &>/dev/null
}

run_with_spinner() {
  local msg="$1"; shift
  "$@" &>/tmp/xp_install.log &
  local pid=$!
  spinner "$pid" "$msg"
  if ! wait "$pid"; then
    log_error "$msg — falhou. Log: /tmp/xp_install.log"
    cat /tmp/xp_install.log >&2
    exit 1
  fi
}

# ─── Argument Parsing ─────────────────────────────────────────────────────────
LICENSE_KEY=""
SELFHOST_MODE=false
DOMAIN=""
EMAIL=""
INSTALL_DIR="/opt/xtreampulsar"
REPO_URL="https://github.com/paulopavlak2014/xtreampulsar"
LICENSE_SERVER="https://license.xtreampulsar.com"
DEV_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key)     LICENSE_KEY="$2"; shift 2 ;;
    --domain)  DOMAIN="$2";      shift 2 ;;
    --email)   EMAIL="$2";       shift 2 ;;
    --dir)     INSTALL_DIR="$2"; shift 2 ;;
    --dev)     DEV_MODE=true;    shift ;;
    --help|-h)
      echo "Uso: $0 [--key CHAVE_LICENCA] [--domain DOMINIO] [--email EMAIL] [--dev]"
      echo "  --key   Opcional. Se não fornecido, instala em modo código aberto / auto-hospedado (sem licença)."
      echo "  --dev   Modo desenvolvimento: verificação de licença ignorada, chave de teste utilizada"
      exit 0 ;;
    *) log_error "Parâmetro desconhecido: $1"; exit 1 ;;
  esac
done

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat <<'EOF'
 __  __  _____ ______  _____          __  __ _____  _    _ _      _____         _____
 \ \/ / |_   _|  ____|/ ____|        |  \/  |  __ \| |  | | |    / ____|  /\   |  __ \
  \  /    | | | |__  | |     _______ | \  / | |__) | |  | | |   | (___   /  \  | |__) |
  /  \    | | |  __| | |    |_______|| |\/| |  ___/| |  | | |    \___ \ / /\ \ |  _  /
 / /\ \  _| |_| |____| |____         | |  | | |    | |__| | |____ ____) / ____ \| | \ \
/_/  \_\|_____|______|\_____|        |_|  |_|_|     \____/|______|_____/_/    \_\_|  \_\
EOF
echo -e "${RESET}"
echo -e "${BOLD}XtreamPulsar Panel — Assistente de Instalação v1.1${RESET}"
echo -e "────────────────────────────────────────────────────────────────────"

# ─── Pre-flight Checks ───────────────────────────────────────────────────────
log_step "▶ Pré-verificações"

# Lisans opsiyonel: anahtar verilmezse acik-kaynak / self-host modunda kurulur (lisans yok).
if [[ -z "$LICENSE_KEY" && "$DEV_MODE" = false ]]; then
  SELFHOST_MODE=true
  log_info "Chave de licença não fornecida -> modo código aberto / auto-hospedado (sem verificação de licença)."
fi

if [[ "$DEV_MODE" = true ]]; then
  log_warning "MODO DEV ativo — verificação de licença será ignorada, ambiente de teste será instalado"
fi

# Verificação root / sudo
if [[ $EUID -ne 0 ]]; then
  log_error "Este script deve ser executado como root. Tente novamente: sudo $0 $*"
  exit 1
fi
log_success "Permissão root"

# Versão do Ubuntu
if ! check_command lsb_release; then
  apt-get install -y -qq lsb-release &>/dev/null
fi
OS_ID=$(lsb_release -si 2>/dev/null || echo "Unknown")
OS_VER=$(lsb_release -sr 2>/dev/null || echo "0")
if [[ "$OS_ID" != "Ubuntu" ]]; then
  log_error "Apenas Ubuntu é suportado (detectado: $OS_ID)."
  exit 1
fi
if [[ "$OS_VER" != "22.04" && "$OS_VER" != "24.04" ]]; then
  log_warning "Versão do Ubuntu recomendada: 22.04 ou 24.04 (atual: $OS_VER). Continuando..."
fi
log_success "Sistema operacional: Ubuntu $OS_VER"

# Verificação de RAM (mínimo 2 GB)
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [[ "$TOTAL_RAM" -lt 2048 ]]; then
  log_error "RAM insuficiente: ${TOTAL_RAM}MB (mínimo 2048MB necessário)."
  exit 1
fi
log_success "RAM: ${TOTAL_RAM}MB"

# Verificação de disco (mínimo 20 GB)
AVAIL_DISK=$(df -BG / | awk 'NR==2{gsub(/G/,""); print $4}')
if [[ "$AVAIL_DISK" -lt 20 ]]; then
  log_error "Espaço em disco insuficiente: ${AVAIL_DISK}GB (mínimo 20GB necessário)."
  exit 1
fi
log_success "Disco: ${AVAIL_DISK}GB livre"

# ─── Passo 1/9: Atualização do Sistema ──────────────────────────────────────
log_step "[1/9] Atualizando o sistema..."
export DEBIAN_FRONTEND=noninteractive
run_with_spinner "Atualizando lista de pacotes" apt-get update -qq
run_with_spinner "Atualizando sistema" apt-get upgrade -y -qq
run_with_spinner "Instalando ferramentas básicas" apt-get install -y -qq \
  curl wget git unzip ca-certificates gnupg lsb-release ufw openssl
log_success "Sistema atualizado"

# ─── Passo 2/9: Instalação do Docker ────────────────────────────────────────
log_step "[2/9] Instalando Docker..."
if check_command docker; then
  DOCKER_VER=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  log_success "Docker já instalado (v$DOCKER_VER) — pulando"
else
  run_with_spinner "Instalando Docker" bash -c 'curl -fsSL https://get.docker.com | sh'
  log_success "Docker instalado"
fi

if ! docker compose version &>/dev/null; then
  run_with_spinner "Instalando Docker Compose Plugin" bash -c \
    'apt-get install -y -qq docker-compose-plugin'
  log_success "Docker Compose Plugin instalado"
else
  log_success "Docker Compose já instalado"
fi

systemctl enable --now docker &>/dev/null || true
CURRENT_USER="${SUDO_USER:-$USER}"
if [[ -n "$CURRENT_USER" && "$CURRENT_USER" != "root" ]]; then
  usermod -aG docker "$CURRENT_USER" 2>/dev/null || true
  log_info "Usuário '$CURRENT_USER' adicionado ao grupo docker (pode ser necessário reconectar)"
fi

# ─── Passo 3/9: Instalação do FFmpeg ────────────────────────────────────────
log_step "[3/9] Instalando FFmpeg..."
if check_command ffmpeg; then
  FFMPEG_VER=$(ffmpeg -version 2>&1 | head -1 | grep -oP 'version \K\S+')
  log_success "FFmpeg já instalado (v$FFMPEG_VER) — pulando"
else
  run_with_spinner "Instalando FFmpeg" apt-get install -y -qq ffmpeg
  FFMPEG_VER=$(ffmpeg -version 2>&1 | head -1 | grep -oP 'version \K\S+')
  log_success "FFmpeg instalado (v$FFMPEG_VER)"
fi

# ─── Passo 4/9: Verificação de Licença ──────────────────────────────────────
log_step "[4/9] Verificando licença..."
# Primeiro tenta IPv4; se o servidor for apenas IPv6, usa ele.
SERVER_IP=$(curl -s -4 --max-time 10 ifconfig.me 2>/dev/null || \
            curl -s -4 --max-time 10 api.ipify.org 2>/dev/null || \
            curl -s    --max-time 10 ifconfig.me 2>/dev/null || \
            hostname -I | awk '{print $1}')

# Endereços IPv6 precisam de colchetes na URL: http://[2001:db8::1]
# SERVER_IP fica como valor bruto (requisição de licença, CN do certificado);
# SERVER_HOST é usado na construção da URL.
if [[ "$SERVER_IP" == *:* ]]; then
  SERVER_HOST="[${SERVER_IP}]"
  log_warning "Servidor sem IPv4; painel acessível apenas via IPv6."
else
  SERVER_HOST="$SERVER_IP"
fi

log_info "IP do Servidor: $SERVER_IP"

if [[ "$DEV_MODE" = true ]]; then
  log_warning "MODO DEV: Verificação de licença ignorada"
  LICENSE_KEY="DEV-TEST-KEY"
  LICENSE_SERVER="http://localhost:3001"
  log_info "Chave de licença: $LICENSE_KEY (dev)"
elif [[ "$SELFHOST_MODE" = true ]]; then
  log_warning "Modo auto-hospedado: verificação de licença ignorada (sem chave, painel funciona sem licença)."
  LICENSE_KEY=""
else
  log_info "Chave de licença: ${LICENSE_KEY:0:8}****"

  ACTIVATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${LICENSE_SERVER}/licenses/activate" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"${LICENSE_KEY}\", \"serverIp\": \"${SERVER_IP}\"}" \
    --max-time 30 2>/dev/null || echo '{"status":"error"}')

  HTTP_CODE=$(echo "$ACTIVATE_RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$ACTIVATE_RESPONSE" | head -1)

  if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]]; then
    log_error "Ativação da licença falhou (HTTP $HTTP_CODE)."
    log_error "Resposta: $RESPONSE_BODY"
    log_error "Por favor, verifique sua chave de licença ou entre em contato com support@xtreampulsar.com."
    exit 1
  fi

  IS_VALID=$(echo "$RESPONSE_BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "PENDING")
  if [[ "$IS_VALID" == "SUSPENDED" || "$IS_VALID" == "EXPIRED" ]]; then
    log_error "Licença inválida ou suspensa: $IS_VALID"
    exit 1
  fi

  log_success "Licença ativa — Tier: $(echo "$RESPONSE_BODY" | grep -o '"tier":"[^"]*"' | cut -d'"' -f4 || echo 'UNKNOWN')"
fi

# ─── Passo 5/9: Preparar Arquivos ───────────────────────────────────────────
log_step "[5/9] Preparando arquivos de instalação..."
mkdir -p "$INSTALL_DIR"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" &>/dev/null && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"  # apps/installer → 2 níveis acima = raiz do repo

log_info "Diretório do script : $SCRIPT_DIR"
log_info "Raiz do repositório : $REPO_ROOT"
log_info "Diretório de instalação: $INSTALL_DIR"

if [[ -f "$REPO_ROOT/docker-compose.yml" ]]; then
  if [[ "$INSTALL_DIR" != "$REPO_ROOT" ]]; then
    log_info "Copiando arquivos: $REPO_ROOT → $INSTALL_DIR"
    cp -r "$REPO_ROOT/." "$INSTALL_DIR/"
    log_success "Todos os arquivos copiados"
  else
    log_info "Script já no diretório de instalação — cópia pulada"
  fi
else
  log_info "Fonte local não encontrada, baixando do GitHub..."
  # Se $INSTALL_DIR estiver cheio de uma instalação anterior, `git clone` recusa.
  # Por isso clonamos num diretório temporário e copiamos por cima; .env preservado.
  XP_SRC="$(mktemp -d /tmp/xp-src.XXXXXX)"
  rmdir "$XP_SRC"
  run_with_spinner "Baixando fonte" \
    git clone --depth 1 "$REPO_URL" "$XP_SRC"
  cp -r "$XP_SRC/." "$INSTALL_DIR/"
  rm -rf "$XP_SRC"
  log_success "Fonte baixada do GitHub"
fi

# ── [FIX #1] Gerar chaves secretas — incluindo REDIS_PASSWORD ──────────────
# IMPORTANTE: Se a instalação for executada novamente (primeira tentativa incompleta),
# gerar uma nova DB_PASSWORD é fatal. O volume postgres_data foi criado com a
# SENHA ANTIGA e o PostgreSQL só aplica POSTGRES_PASSWORD ao inicializar um
# diretório de dados vazio. A nova senha vai para o .env mas nunca é aplicada à role; resultado:
#   "Authentication failed against database server at `postgres`"
# e consequentemente HTTP 504 na criação do admin.
# Solução: reutilizar as chaves secretas existentes se .env existir.
ENV_FILE="$INSTALL_DIR/.env"

read_env() {  # read_env CHAVE → imprime o valor existente do .env (se vazio)
  [[ -f "$ENV_FILE" ]] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1
}

if [[ -f "$ENV_FILE" ]]; then
  log_info ".env existente encontrado — chaves secretas preservadas (backup: .env.bak)"
  cp "$ENV_FILE" "${ENV_FILE}.bak"
fi

DB_PASSWORD="$(read_env POSTGRES_PASSWORD)"
[[ -n "$DB_PASSWORD" ]] || DB_PASSWORD=$(generate_password)

REDIS_PASSWORD="$(read_env REDIS_PASSWORD)"
[[ -n "$REDIS_PASSWORD" ]] || REDIS_PASSWORD=$(openssl rand -hex 32)

JWT_SECRET="$(read_env JWT_SECRET)"
[[ -n "$JWT_SECRET" ]] || JWT_SECRET=$(openssl rand -hex 32)

JWT_REFRESH_SECRET="$(read_env JWT_REFRESH_SECRET)"
[[ -n "$JWT_REFRESH_SECRET" ]] || JWT_REFRESH_SECRET=$(openssl rand -hex 32)

ADMIN_API_KEY="$(read_env ADMIN_API_KEY)"
[[ -n "$ADMIN_API_KEY" ]] || ADMIN_API_KEY=$(generate_password)

CONTROL_JWT_SECRET="$(read_env CONTROL_JWT_SECRET)"
[[ -n "$CONTROL_JWT_SECRET" ]] || CONTROL_JWT_SECRET=$(openssl rand -hex 32)

# Chave compartilhada do endpoint de métricas do Node (/api/v1/node/metrics).
# No painel, em Servidores > Segurança do Servidor > "API Secret (Chave do Node)",
# insira o MESMO valor; caso contrário, os gráficos de CPU/RAM/Disk não funcionarão.
NODE_SECRET="$(read_env NODE_SECRET)"
[[ -n "$NODE_SECRET" ]] || NODE_SECRET=$(generate_password)

# A senha do admin é gerada a cada instalação; se o usuário já existir,
# /auth/setup retorna 409 e abaixo é exibido "senha existente não alterada".
ADMIN_PASSWORD=$(generate_password)

if [[ -n "$DOMAIN" ]]; then
  SERVER_URL="http://${DOMAIN}"
else
  SERVER_URL="http://${SERVER_HOST}"
fi

if [[ -n "$DOMAIN" ]]; then
  CORS_ORIGINS="https://${DOMAIN},http://${DOMAIN}"
else
  CORS_ORIGINS="http://${SERVER_HOST}"
fi

cat > "$INSTALL_DIR/.env" <<ENV
# ─── Database ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://xtreampulsar:${DB_PASSWORD}@postgres:5432/xtreampulsar
POSTGRES_DB=xtreampulsar
POSTGRES_USER=xtreampulsar
POSTGRES_PASSWORD=${DB_PASSWORD}

# ─── Redis ────────────────────────────────────────────────────────────────
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ─── JWT ──────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── License ──────────────────────────────────────────────────────────────
LICENSE_KEY=${LICENSE_KEY}
LICENSE_SERVER_URL=${LICENSE_SERVER}
LICENSE_ENFORCE=false
LICENSE_OFFLINE_GRACE_HOURS=72
ADMIN_API_KEY=${ADMIN_API_KEY}
DEV_MODE=${DEV_MODE}

# ─── Métricas do Node ──────────────────────────────────────────────────────
# Painel > Servidores > (servidor) > Segurança do Servidor > API Secret (Chave do Node)
# Insira o MESMO valor neste campo.
NODE_SECRET=${NODE_SECRET}

# ─── Suporte / Painel de Controle ────────────────────────────────────────────
# Solicitações de suporte caem no nosso painel de controle. No servidor do cliente,
# esta URL deve sempre apontar para o nosso painel de controle;
# X-License-Key usa a licença do cliente.
CONTROL_PANEL_URL=https://control.xtreampulsar.com
PANEL_LICENSE_KEY=${LICENSE_KEY}
CONTROL_JWT_SECRET=${CONTROL_JWT_SECRET}

# ─── Server ───────────────────────────────────────────────────────────────
SERVER_URL=${SERVER_URL}
CORS_ORIGINS=${CORS_ORIGINS}
MAX_CONNECTIONS_PER_IP=0
GUARD_RESTREAM_ENFORCE=false
RS_WINDOW=300
SERVER_PORT=25461
FFMPEG_PATH=/usr/bin/ffmpeg
HLS_OUTPUT_PATH=/tmp/xtreampulsar/hls
NODE_ENV=production
ENV

chmod 600 "$INSTALL_DIR/.env"
log_success "Diretório de instalação pronto: $INSTALL_DIR"

# ── [FIX #2+#3] Criar diretórios SSL e certificado self-signed ────────────
log_info "Preparando diretórios SSL e certificado inicial..."
mkdir -p "${INSTALL_DIR}/nginx/ssl"
mkdir -p "${INSTALL_DIR}/nginx/webroot"

if [[ -n "$DOMAIN" ]]; then
  # Se houver domínio: começar com self-signed, certbot substitui depois
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${INSTALL_DIR}/nginx/ssl/privkey.pem" \
    -out    "${INSTALL_DIR}/nginx/ssl/fullchain.pem" \
    -subj "/CN=${DOMAIN}" &>/dev/null
  log_success "Certificado self-signed temporário criado (será substituído pelo Let's Encrypt)"
else
  # Sem domínio: acesso por IP, usar configuração HTTP-only do nginx
  if [[ -f "${INSTALL_DIR}/nginx/nginx-http-only.conf" ]]; then
    cp "${INSTALL_DIR}/nginx/nginx-http-only.conf" "${INSTALL_DIR}/nginx/nginx.conf"
    log_success "Configuração HTTP-only do nginx ativada (sem SSL)"
  else
    log_warning "nginx-http-only.conf não encontrado, usando nginx.conf existente"
    # Criar self-signed para IP sem SSL necessário
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "${INSTALL_DIR}/nginx/ssl/privkey.pem" \
      -out    "${INSTALL_DIR}/nginx/ssl/fullchain.pem" \
      -subj "/CN=${SERVER_IP}" &>/dev/null
    log_info "Certificado self-signed criado para IP (exibirá aviso no navegador)"
  fi
  log_warning "Domínio não especificado. Painel acessível via HTTP: http://${SERVER_HOST}"
fi

# ─── Passo 6/9: Iniciar Banco de Dados ─────────────────────────────────────
log_step "[6/9] Iniciando banco de dados..."
cd "$INSTALL_DIR"
run_with_spinner "Iniciando PostgreSQL e Redis" \
  docker compose up -d postgres redis

log_info "Aguardando PostgreSQL ficar pronto (máx 60s)..."
for i in $(seq 1 12); do
  if docker compose exec -T postgres pg_isready -U xtreampulsar </dev/null &>/dev/null; then
    log_success "PostgreSQL pronto"
    break
  fi
  if [[ $i -eq 12 ]]; then
    log_error "PostgreSQL não iniciou em 60 segundos."
    docker compose logs postgres >&2
    exit 1
  fi
  sleep 5
done

# ── Forçar sincronização da senha da role com .env ───────────────────────────
# pg_isready NÃO autentica; diz "pronto" mesmo em volume antigo.
# Se o diretório de dados é de uma instalação anterior, a senha da role
# não bate com o .env. O socket unix do container usa `trust`, então podemos
# ALTER USER sem saber a senha. Em instalação nova, isso é um no-op.
log_info "Sincronizando credenciais do banco com .env..."
if docker compose exec -T postgres \
     psql -v ON_ERROR_STOP=1 -U xtreampulsar -d postgres \
     -c "ALTER USER xtreampulsar WITH PASSWORD '${DB_PASSWORD}';" \
     </dev/null &>/tmp/xp_pgauth.log; then
  log_success "Credenciais do banco sincronizadas"
else
  log_warning "Senha da role não pôde ser atualizada (log: /tmp/xp_pgauth.log)"
fi

# Teste real de autenticação via TCP — idêntico ao que a API fará.
if ! docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" postgres \
       psql -h 127.0.0.1 -U xtreampulsar -d xtreampulsar -c 'SELECT 1' \
       </dev/null &>/dev/null; then
  log_error "Autenticação do PostgreSQL falhou."
  log_error "Provavelmente há um volume de dados de instalação anterior."
  log_error "Se seus dados não são importantes, resete o volume e tente novamente:"
  log_error "  cd $INSTALL_DIR && docker compose down -v && sudo bash apps/installer/install.sh --key <CHAVE>"
  exit 1
fi

log_info "Executando migration..."
docker compose run --rm -T api sh -c \
  "cd /repo/packages/database && npx prisma migrate deploy" \
  </dev/null &>/tmp/xp_migrate.log || {
  log_error "Migration falhou — o painel não funcionará assim, instalação interrompida."
  tail -30 /tmp/xp_migrate.log >&2
  log_error "Log completo: /tmp/xp_migrate.log"
  exit 1
}
log_success "Banco de dados pronto"

# ─── Passo 7/9: Iniciar Serviços ────────────────────────────────────────────
log_step "[7/9] Iniciando serviços..."
cd "$INSTALL_DIR"
run_with_spinner "Compilando e iniciando todos os serviços" docker compose up -d --build

log_info "Aguardando serviços ficarem prontos (30s)..."
sleep 30

# ── Painel local: com domínio o nginx usa HTTPS (e HTTP:80 redireciona p/ 301),
#    sem domínio usa HTTP puro. Testes internos devem acertar o esquema e usar
#    curl -k (aceitar self-signed) — do contrário o health check vê só 301.
if [[ -n "$DOMAIN" ]]; then
  LOCAL_BASE="https://localhost"
else
  LOCAL_BASE="http://localhost"
fi

# Health check
HEALTH_OK=""
for i in $(seq 1 6); do
  HTTP=$(curl -sk -o /dev/null -w "%{http_code}" "${LOCAL_BASE}/api/v1/health" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" || "$HTTP" == "503" ]]; then
    log_success "API respondendo (HTTP $HTTP)"
    HEALTH_OK="1"; break
  fi
  log_info "Aguardando health check, tentando novamente ($i/6, HTTP $HTTP)..."
  sleep 10
done
if [[ -z "$HEALTH_OK" ]]; then
  log_warning "Health check da API falhou. Logs: cd $INSTALL_DIR && docker compose logs api"
fi

# ─── Passo 8/9: Configuração SSL ────────────────────────────────────────────
log_step "[8/9] Configuração SSL..."
if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then
  # ── [FIX #2] Certbot em modo webroot — nginx já rodando, sem conflito de porta ──
  log_info "Obtendo certificado Let's Encrypt (modo webroot): $DOMAIN"

  docker run --rm \
    -v "${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt" \
    -v "${INSTALL_DIR}/nginx/webroot:/var/www/certbot" \
    certbot/certbot certonly --webroot \
    --webroot-path /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos --non-interactive --no-eff-email \
    2>/tmp/xp_certbot.log && {

    # Copiar certificados reais para o diretório ssl do nginx
    SSL_DIR="${INSTALL_DIR}/nginx/ssl/live/${DOMAIN}"
    cp "${SSL_DIR}/fullchain.pem" "${INSTALL_DIR}/nginx/ssl/fullchain.pem"
    cp "${SSL_DIR}/privkey.pem"   "${INSTALL_DIR}/nginx/ssl/privkey.pem"

    docker compose restart nginx
    log_success "Certificado Let's Encrypt obtido e nginx reiniciado"

    # ── [FIX #5] Cron de renovação SSL automática ──────────────────────────
    RENEW_CMD="docker run --rm -v ${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt -v ${INSTALL_DIR}/nginx/webroot:/var/www/certbot certbot/certbot renew --quiet && docker compose -f ${INSTALL_DIR}/docker-compose.yml restart nginx"
    (crontab -l 2>/dev/null | grep -v "certbot/certbot renew"; echo "0 3 * * * ${RENEW_CMD}") | crontab -
    log_success "Cron de renovação SSL automática adicionado (todo dia às 03:00)"
  } || {
    log_warning "Certificado Let's Encrypt não pôde ser obtido (log: /tmp/xp_certbot.log)"
    log_warning "Continuando com certificado self-signed. Você pode obter manualmente depois:"
    log_warning "  cd ${INSTALL_DIR} && sudo bash apps/installer/install.sh --key ${LICENSE_KEY} --domain ${DOMAIN} --email ${EMAIL}"
  }
elif [[ -n "$DOMAIN" && -z "$EMAIL" ]]; then
  log_warning "--email não especificado, SSL ignorado."
  log_warning "Para SSL: $0 --key ${LICENSE_KEY} --domain ${DOMAIN} --email admin@${DOMAIN}"
else
  log_info "Domínio não especificado, SSL ignorado. Continuando via HTTP."
fi

# ─── Passo 9/9: Firewall ────────────────────────────────────────────────────
log_step "[9/9] Configurando firewall..."
ufw allow 22/tcp    comment 'SSH'        &>/dev/null
ufw allow 80/tcp    comment 'HTTP'       &>/dev/null
ufw allow 443/tcp   comment 'HTTPS'      &>/dev/null
ufw allow 25461/tcp comment 'Xtream API' &>/dev/null
ufw --force enable  &>/dev/null
log_success "Regras do firewall aplicadas (22, 80, 443, 25461)"

# ─── [FIX #4] Usuário Admin — endpoint /auth/setup ──────────────────────────
log_info "Criando usuário admin..."
# A API pode estar ainda iniciando nos primeiros requests; receber 504 uma vez
# não é evidência suficiente. Tente 6 vezes com espera crescente.
SETUP_RESPONSE="000"
for i in $(seq 1 6); do
  SETUP_RESPONSE=$(curl -sk -o /dev/null -w "%{http_code}" \
    -X POST "${LOCAL_BASE}/api/v1/auth/setup" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    -d "{\"username\":\"admin\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    --max-time 30 2>/dev/null || echo "000")
  if [[ "$SETUP_RESPONSE" == "201" || "$SETUP_RESPONSE" == "409" ]]; then
    break
  fi
  log_info "Tentando criar admin novamente ($i/6, HTTP $SETUP_RESPONSE)..."
  sleep 10
done

if [[ "$SETUP_RESPONSE" == "201" ]]; then
  log_success "Usuário admin criado"
elif [[ "$SETUP_RESPONSE" == "409" ]]; then
  log_info "Usuário admin já existe (pulando)"
  ADMIN_PASSWORD="(senha existente não alterada)"
else
  log_warning "Usuário admin não pôde ser criado (HTTP $SETUP_RESPONSE)"
  log_warning "Verifique os logs da API:"
  log_warning "  cd $INSTALL_DIR && docker compose logs --tail=50 api"
  log_warning "Depois crie manualmente (execute deste diretório: cd $INSTALL_DIR):"
  log_warning "  docker compose exec api node apps/api/dist/scripts/reset-admin.js admin 'NovaSenha123!'"
  ADMIN_PASSWORD="(será criado manualmente)"
fi

# ─── Concluído ──────────────────────────────────────────────────────────────
PANEL_URL="${SERVER_URL}"

echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          XtreamPulsar installation complete!                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "${BOLD}Informações de Acesso${RESET}"
echo -e "────────────────────────────────────────────────────────────────"
echo -e "  URL do Painel   : ${CYAN}${PANEL_URL}${RESET}"
echo -e "  Xtream API      : ${CYAN}http://${SERVER_HOST}:25461${RESET}"
echo -e "  Usuário Admin   : ${BOLD}admin${RESET}"
echo -e "  Senha Admin     : ${BOLD}${YELLOW}${ADMIN_PASSWORD}${RESET}"
echo -e "  Dir. Instalação : ${INSTALL_DIR}"
echo -e "  Chave do Node   : ${BOLD}${NODE_SECRET}${RESET}"
echo -e "    ${CYAN}Painel > Servidores > (servidor) > Segurança do Servidor > API Secret${RESET}"
echo -e "    ${CYAN}insira este valor no campo; os gráficos de CPU/RAM/Disk funcionarão.${RESET}"
echo ""
echo -e "${BOLD}Comandos Úteis${RESET}"
echo -e "────────────────────────────────────────────────────────────────"
echo -e "  Logs            : cd ${INSTALL_DIR} && docker compose logs -f"
echo -e "  Atualização     : ${INSTALL_DIR}/update.sh"
echo -e "  Verificação     : ${INSTALL_DIR}/health-check.sh"
echo -e "  Desinstalação   : ${INSTALL_DIR}/uninstall.sh"
echo ""
echo -e "${BOLD}Documentação${RESET} : https://docs.xtreampulsar.com"
echo -e "  ${YELLOW}⚠  Salve a senha do admin agora! Não será exibida novamente.${RESET}"
echo ""

# Copiar scripts para o diretório de instalação
cp "$0" "$INSTALL_DIR/install.sh" 2>/dev/null || true
[[ -f "$(dirname "$0")/update.sh" ]]       && cp "$(dirname "$0")/update.sh"       "$INSTALL_DIR/"
[[ -f "$(dirname "$0")/uninstall.sh" ]]    && cp "$(dirname "$0")/uninstall.sh"    "$INSTALL_DIR/"
[[ -f "$(dirname "$0")/health-check.sh" ]] && cp "$(dirname "$0")/health-check.sh" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR"/*.sh 2>/dev/null || true
