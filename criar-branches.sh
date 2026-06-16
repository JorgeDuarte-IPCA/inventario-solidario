#!/bin/bash
# ============================================================
# criar-branches.sh
# Cria as 4 branches do projeto e envia-as para o GitHub.
#
# COMO USAR:
#   1. Criar o repositorio no GitHub (vazio, sem README).
#   2. Na pasta do projeto, correr:
#        git init
#        git add .
#        git commit -m "Commit inicial - estrutura base"
#        git branch -M main
#        git remote add origin https://github.com/UTILIZADOR/REPO.git
#        git push -u origin main
#   3. Depois, correr este script:
#        bash criar-branches.sh
# ============================================================

set -e

echo "A criar as 4 branches do projeto..."

git checkout main

# Criar as branches (uma por elemento)
git branch jorge-auth-users 2>/dev/null || echo "  (jorge-auth-users ja existe)"
git branch joao-inventario-armazens 2>/dev/null || echo "  (joao-inventario-armazens ja existe)"
git branch albino-doacoes 2>/dev/null || echo "  (albino-doacoes ja existe)"
git branch jose-pedidos-transferencias 2>/dev/null || echo "  (jose-pedidos-transferencias ja existe)"

echo "A enviar as branches para o GitHub..."
git push origin jorge-auth-users
git push origin joao-inventario-armazens
git push origin albino-doacoes
git push origin jose-pedidos-transferencias

echo ""
echo "Concluido! As 4 branches estao no GitHub:"
echo "  - jorge-auth-users            (Jorge: Autenticacao, Utilizadores, Definicoes)"
echo "  - joao-inventario-armazens    (Joao: Inventario, Armazens, Dashboard)"
echo "  - albino-doacoes              (Albino: Doacoes, Catalogo)"
echo "  - jose-pedidos-transferencias (Jose: Pedidos, Transferencias, Assistente)"
echo ""
echo "Cada elemento deve mudar para a sua branch com: git checkout NOME-DA-BRANCH"
