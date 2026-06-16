#!/usr/bin/env bash
# Script de commits do MEMBRO 2 - Inventario, Familias, Armazens, Dashboard
# Corre dentro da pasta do repositorio ja clonado.
set -e

echo "=== Commits do Membro 2: Inventario, Familias, Armazens, Dashboard ==="
read -p "O teu nome (para o Git): " NOME
read -p "O teu email (o da conta GitHub): " EMAIL
git config user.name "$NOME"
git config user.email "$EMAIL"
echo "Git configurado para: $NOME <$EMAIL>"
echo

# Commit 1 - estilos partilhados
git add public/css/style.css
git commit -m "Frontend: folha de estilos da aplicacao"

# Commit 2 - produtos
git add routes/products.js public/products.html public/js/products.js
git commit -m "Modulo de produtos (backend, pagina e edicao)"

# Commit 3 - familias
git add routes/families.js public/families.html public/js/families.js
git commit -m "Gestao de familias de produtos"

# Commit 4 - armazens
git add routes/warehouses.js public/warehouses.html public/js/warehouses.js
git commit -m "Gestao de armazens por distrito"

# Commit 5 - movimentos de stock e dashboard
git add routes/inventory.js routes/dashboard.js public/dashboard.html public/js/dashboard.js
git commit -m "Movimentos de stock e dashboard com KPIs e graficos"

echo
echo "A sincronizar com o GitHub..."
git pull --rebase origin main
git push
echo "=== Concluido! Commits do Membro 2 enviados. ==="
