# Guia — Pôr online (gratuito, sem cartão): Aiven + Render

Esta é a forma de pôr o projeto online **gratuitamente e sem cartão de crédito**, mantendo o MySQL:
- **Base de dados MySQL** → **Aiven** (grátis, sem cartão, não expira)
- **Aplicação Node.js** → **Render** (plano gratuito sem cartão)

> Nota: no plano gratuito do Render, a app "adormece" após 15 min sem uso e demora ~1 min a acordar no primeiro acesso. Para uma demonstração é normal.

---

## Passo 0 — Pôr o projeto no GitHub

1. Cria um repositório no GitHub (ver `GUIA-GITHUB.md` para a divisão pelos 4 membros).
2. Faz push do projeto.

---

## Passo 1 — Criar a base de dados MySQL no Aiven

1. Vai a **aiven.io** e cria conta (sem cartão).
2. **Create service** → **MySQL** → escolhe o plano **Free**.
3. Escolhe uma região europeia (ex.: Frankfurt ou Londres) para menor latência.
4. Dá um nome ao serviço e cria. Aguarda uns minutos até ficar "Running".
5. No separador **Overview / Connection information**, anota:
   - **Host** (algo como `mysql-xxxx.aivencloud.com`)
   - **Port** (ex.: `12345`)
   - **User** (normalmente `avnadmin`)
   - **Password**
   - **Database name** (normalmente `defaultdb`)

> Não é preciso criar as tabelas manualmente! A aplicação cria-as sozinha no
> primeiro arranque (ver o passo seguinte, variável `DB_AUTO_INIT`).

---

## Passo 2 — Alojar a aplicação no Render

1. Vai a **render.com** e cria conta (sem cartão), liga o GitHub.
2. **New** → **Web Service** → escolhe o teu repositório.
3. Configura:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Em **Environment / Environment Variables**, adiciona:

   | Variável | Valor |
   |----------|-------|
   | `DB_HOST` | host do Aiven |
   | `DB_PORT` | porta do Aiven |
   | `DB_USER` | `avnadmin` |
   | `DB_PASSWORD` | password do Aiven |
   | `DB_NAME` | `defaultdb` |
   | `DB_SSL` | `true` |
   | `DB_AUTO_INIT` | `true` |
   | `JWT_SECRET` | uma frase secreta à tua escolha |

   A variável **`DB_AUTO_INIT=true`** faz a app criar as tabelas e inserir os
   dados de exemplo automaticamente no primeiro arranque (só se a base estiver vazia).

5. **Create Web Service.** O Render instala e arranca a app. Nos logs verás
   `[init-db] Base de dados pronta.` quando criar tudo.
6. Quando terminar, tens um URL público tipo `https://o-teu-projeto.onrender.com`.

---

## Passo 3 — Testar

- Abre o URL do Render.
- Entra com `admin@caridade.pt` / `password123`.
- (Primeiro acesso pode demorar ~1 min se a app tiver adormecido.)

> Depois de a base estar criada, podes deixar `DB_AUTO_INIT=true` à vontade —
> a app deteta que as tabelas já existem e não faz nada. Se algum dia quiseres
> recriar tudo do zero, apaga as tabelas no Aiven e reinicia a app.

---

## (Alternativa) Criar a base de dados a partir do teu PC

Se preferires, em vez do `DB_AUTO_INIT`, podes criar as tabelas manualmente
correndo o setup a apontar para o Aiven:

**Linux / Mac:**
```bash
DB_HOST=mysql-xxxx.aivencloud.com DB_PORT=12345 DB_USER=avnadmin \
DB_PASSWORD=a_tua_password DB_NAME=defaultdb DB_SSL=true DB_CLOUD=true npm run setup
```
**Windows (PowerShell):**
```powershell
$env:DB_HOST="..."; $env:DB_PORT="12345"; $env:DB_USER="avnadmin"; $env:DB_PASSWORD="..."; $env:DB_NAME="defaultdb"; $env:DB_SSL="true"; $env:DB_CLOUD="true"; npm run setup
```

---

## Notas

- **Email (SMTP):** depois de online, configura o SMTP na página **Configurações** do painel de admin para os emails serem enviados a sério.
- **Geolocalização:** funciona normalmente (o Render acede ao Nominatim).
- **Segredos:** usa um `JWT_SECRET` próprio e, idealmente, muda as passwords de demonstração.
- **CA do Aiven (ligação mais segura):** se quiseres validar o certificado em vez de aceitar qualquer um, mete o conteúdo do `ca.pem` numa variável `DB_SSL_CA` (no Render). Sem isso, o código liga na mesma por SSL mas sem validar o CA — suficiente para uma demo.
