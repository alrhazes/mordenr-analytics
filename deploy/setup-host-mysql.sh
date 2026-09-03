#!/usr/bin/env bash
# One-time host MySQL setup for stt_electorals (run as root on the droplet).
set -euo pipefail

KNOWLEDGE_PASSWORD="${KNOWLEDGE_MYSQL_PASSWORD:?set KNOWLEDGE_MYSQL_PASSWORD}"

if ! command -v mysql >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y mysql-server
fi

# Bind all interfaces — Docker reaches via host.docker.internal (172.17.0.1).
# deploy/setup-host-mysql.sh adds iptables rules blocking public 3306 access.
cat > /etc/mysql/mysql.conf.d/99-sentra.cnf <<'EOF'
[mysqld]
bind-address = 0.0.0.0
mysqlx-bind-address = 127.0.0.1
innodb_buffer_pool_size = 2G
max_connections = 80
EOF

systemctl enable mysql
systemctl restart mysql

# Allow localhost + Docker bridge networks only (block public 3306).
iptables -C INPUT -p tcp -s 127.0.0.1 --dport 3306 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 1 -p tcp -s 127.0.0.1 --dport 3306 -j ACCEPT
iptables -C INPUT -p tcp -s 172.16.0.0/12 --dport 3306 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 2 -p tcp -s 172.16.0.0/12 --dport 3306 -j ACCEPT
iptables -C INPUT -p tcp --dport 3306 -j DROP 2>/dev/null \
  || iptables -A INPUT -p tcp --dport 3306 -j DROP

mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS stt_electorals
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'bdcat'@'localhost' IDENTIFIED BY '${KNOWLEDGE_PASSWORD}';
CREATE USER IF NOT EXISTS 'bdcat'@'%' IDENTIFIED BY '${KNOWLEDGE_PASSWORD}';
GRANT SELECT ON stt_electorals.* TO 'bdcat'@'localhost';
GRANT SELECT ON stt_electorals.* TO 'bdcat'@'%';
FLUSH PRIVILEGES;
SQL

if [[ -f /tmp/stt_electorals.sql.gz ]]; then
  echo "==> Importing /tmp/stt_electorals.sql.gz"
  gunzip -c /tmp/stt_electorals.sql.gz | mysql -uroot stt_electorals
  echo "==> Import complete"
else
  echo "==> No /tmp/stt_electorals.sql.gz yet — database created, import pending"
fi

mysql -uroot -e "
SELECT table_schema AS db,
       ROUND(SUM(data_length+index_length)/1024/1024/1024,2) AS size_gb,
       COUNT(*) AS tables
FROM information_schema.tables
WHERE table_schema='stt_electorals'
GROUP BY table_schema;"

echo "==> Host MySQL ready on 127.0.0.1:3306"
