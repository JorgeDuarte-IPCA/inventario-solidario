#!/usr/bin/env bash
# Script de commits do MEMBRO 4 - Pedidos e Entregas
# Corre dentro da pasta do repositorio ja clonado.
set -e

echo "=== Commits do Membro 4: Pedidos e Entregas ==="
read -p "O teu nome (para o Git): " NOME
read -p "O teu email (o da conta GitHub): " EMAIL
git config user.name "$NOME"
git config user.email "$EMAIL"
echo "Git configurado para: $NOME <$EMAIL>"
echo

# Commit 1 - backend de pedidos (maquina de estados)
git add routes/requests.js
git commit -m "Backend: rotas de pedidos e maquina de estados"

# Commit 2 - pagina de pedidos
git add public/requests.html
git commit -m "Frontend: pagina de pedidos com formulario de submissao"

# Commit 3 - logica do frontend
git add public/js/requests.js
git commit -m "Frontend: logica de pedidos (carenciado submete, gestao de estados)"

# Commit 4 - ajustes finais
git commit --allow-empty -m "Pedidos: validacao do fluxo de aprovacao e entrega"

echo
echo "A sincronizar com o GitHub..."
git pull --rebase origin main
git push
echo "=== Concluido! Commits do Membro 4 enviados. ==="
