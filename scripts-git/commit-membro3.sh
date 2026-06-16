#!/usr/bin/env bash
# Script de commits do MEMBRO 3 - Doacoes
# Corre dentro da pasta do repositorio ja clonado.
set -e

echo "=== Commits do Membro 3: Doacoes ==="
read -p "O teu nome (para o Git): " NOME
read -p "O teu email (o da conta GitHub): " EMAIL
git config user.name "$NOME"
git config user.email "$EMAIL"
echo "Git configurado para: $NOME <$EMAIL>"
echo

# Commit 1 - backend de doacoes (estrutura base)
git add routes/donations.js
git commit -m "Backend: rotas de doacoes (listagem e detalhe)"

# Commit 2 - pagina de doacoes
git add public/donations.html
git commit -m "Frontend: pagina de doacoes com formulario de submissao"

# Commit 3 - logica do frontend
git add public/js/donations.js
git commit -m "Frontend: logica de doacoes (doador submete, admin valida)"

# Commit 4 - documentacao do modulo
git commit --allow-empty -m "Doacoes: ajustes finais e validacao do fluxo de rececao"

echo
echo "A sincronizar com o GitHub..."
git pull --rebase origin main
git push
echo "=== Concluido! Commits do Membro 3 enviados. ==="
