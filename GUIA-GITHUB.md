# Guia — Pôr o projeto no GitHub (grupo de 4)

Objetivo: ter o projeto no GitHub com os commits repartidos pelos 4 elementos, de forma honesta (cada um commita a sua parte).

> **Importante:** o que torna um commit "vosso" no GitHub é o **email** configurado no Git ser o mesmo da vossa conta GitHub. Confirmem isso antes de commitar.

---

## Divisão por membro

| Membro | Módulo | Ficheiros principais |
|--------|--------|----------------------|
| **1** | Autenticação e Utilizadores | `routes/auth.js`, `routes/users.js`, `middleware/auth.js`, `public/index.html`, `public/users.html`, `public/js/users.js`, `public/js/app.js` |
| **2** | Inventário, Famílias, Armazéns, Dashboard | `routes/products.js`, `routes/families.js`, `routes/warehouses.js`, `routes/inventory.js`, `routes/dashboard.js`, páginas e JS correspondentes, `public/css/style.css` |
| **3** | Doações | `routes/donations.js`, `public/donations.html`, `public/js/donations.js` |
| **4** | Pedidos e Entregas | `routes/requests.js`, `public/requests.html`, `public/js/requests.js` |

---

## Passo 1 — Criar o repositório (UMA pessoa só)

1. No GitHub: **New repository** → nome (ex.: `inventario-solidario`) → criar **vazio** (sem README, sem .gitignore — para não dar conflito).
2. Copiar o URL (ex.: `https://github.com/USER/inventario-solidario.git`).

## Passo 2 — Commit inicial com a base (a MESMA pessoa)

Dentro da pasta `charity-inventory` descompactada:

```bash
cd charity-inventory
git init
git config user.name "Nome Pessoa 1"
git config user.email "email-github-1@exemplo.com"

git add package.json package-lock.json .gitignore .env.example README.md server.js config/ database/ docker-compose.yml Dockerfile .dockerignore scripts/
git commit -m "Estrutura inicial do projeto e configuracao"

git branch -M main
git remote add origin https://github.com/USER/inventario-solidario.git
git push -u origin main
```

## Passo 3 — Cada membro commita a sua parte

Combinem uma **ordem** (Membro 1, depois 2, 3, 4) para não haver conflitos no push.

Cada membro, no seu PC:

```bash
git clone https://github.com/USER/inventario-solidario.git
cd inventario-solidario
```

E depois corre o **script do seu número** (ver abaixo), OU faz os commits à mão.

### Opção A — Usar o script (mais fácil)

Os scripts estão na pasta `scripts-git/`. Cada membro corre o seu:

```bash
# Exemplo para o Membro 3:
bash scripts-git/commit-membro3.sh
```

O script vai:
1. perguntar o nome e o email (da conta GitHub);
2. configurar o Git;
3. fazer vários commits pequenos da parte do membro;
4. fazer `pull --rebase` e `push`.

### Opção B — À mão (exemplo do Membro 3)

```bash
git config user.name "O Meu Nome"
git config user.email "o-meu-email-github@exemplo.com"

git add routes/donations.js
git commit -m "Backend: rotas de doacoes"

git add public/donations.html
git commit -m "Frontend: pagina de doacoes"

git add public/js/donations.js
git commit -m "Frontend: logica de doacoes (submissao e gestao)"

git pull --rebase origin main
git push
```

---

## Notas

- **Ordem importa:** se dois fizerem push ao mesmo tempo, o segundo leva erro. Solução: `git pull --rebase origin main` e `git push` outra vez. Os scripts já fazem isto.
- **Números de commits parecidos:** cada script faz 3-4 commits, por isso os 4 membros ficam equilibrados.
- **Verificar quem commitou o quê:** no GitHub, separador **Insights → Contributors**, ou `git shortlog -sne` no terminal.
- **O `public/js/app.js` e o `public/css/style.css`** são partilhados; ficam atribuídos a quem os commitar primeiro (Membro 1 e Membro 2, respetivamente). Tudo bem.
