#!/usr/bin/env bash
# Script de commits do MEMBRO 1 - Autenticacao e Utilizadores
# Corre dentro da pasta do repositorio ja clonado.
set -e

echo "=== Commits do Membro 1: Autenticacao e Utilizadores ==="
read -p "O teu nome (para o Git): " NOME
read -p "O teu email (o da conta GitHub): " EMAIL
git config user.name "$NOME"
git config user.email "$EMAIL"
echo "Git configurado para: $NOME <$EMAIL>"
echo

# Commit 1 - middleware de autenticacao
git add middleware/auth.js
git commit -m "Backend: middleware de autenticacao JWT e controlo de papeis"

# Commit 2 - rota de login
git add routes/auth.js
git commit -m "Backend: rota de autenticacao (login)"

# Commit 3 - gestao de utilizadores
git add routes/users.js public/users.html public/js/users.js
git commit -m "Gestao de utilizadores (backend e pagina de admin)"

# Commit 4 - login e camada partilhada do frontend
git add public/index.html public/js/app.js
git commit -m "Frontend: pagina de login e utilitarios partilhados (sessao, RBAC)"

echo
echo "A sincronizar com o GitHub..."
git pull --rebase origin main
git push
echo "=== Concluido! Commits do Membro 1 enviados. ==="
