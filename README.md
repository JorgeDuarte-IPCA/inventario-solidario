# Inventário Solidário

Sistema web de gestão de inventário para associações de caridade. Permite registar e distribuir bens doados por doadores e entregues a beneficiários, com gestão de armazéns, validades, doações, pedidos e transferências entre armazéns.

Projeto académico desenvolvido no âmbito do CTESP de Redes e Sistemas Informáticos do IPCA, por um grupo de quatro elementos.

## Funcionalidades principais

- **Autenticação e papéis** — administrador, técnico social, operador de armazém, doador e beneficiário, com controlo de acessos por papel (JWT + bcrypt).
- **Registo e aprovação de contas** — doadores e beneficiários registam-se e ficam pendentes até aprovação por administrador ou técnico social.
- **Catálogo de produtos** — definição dos tipos de artigo (nome, família, localização). O stock real entra pelas doações.
- **Gestão de armazéns** — armazéns por distrito, com morada e contacto, geolocalizados para associar utilizadores ao armazém mais próximo.
- **Doações** — o doador submete os bens (quantidade, validade e estado); a associação valida e receciona, momento em que os bens entram no stock.
- **Pedidos** — o beneficiário pede bens; o pedido percorre uma máquina de estados até à entrega, momento em que os bens saem do stock.
- **Validade por lotes** — o mesmo artigo pode ter vários lotes com validades diferentes; o sistema sinaliza por cores os bens a expirar.
- **Transferências entre armazéns** — documento com código que agrupa vários artigos transferidos de um armazém para outro.
- **Painel (dashboard)** — indicadores-chave e gráficos (stock por família/distrito, estados, distribuição mensal de doações e entregas).
- **Assistente de ajuda** — chatbot de FAQ sobre o funcionamento do site, com possibilidade de ligação a uma IA externa.
- **Notificações por email** — confirmação de registo, aprovação de conta e mudanças de estado dos pedidos.

## Tecnologias

- **Backend:** Node.js + Express
- **Base de dados:** MySQL
- **Frontend:** HTML, CSS e JavaScript (sem framework)
- **Gráficos:** Chart.js
- **Email:** API Brevo
- **Geolocalização:** OpenStreetMap / Nominatim
- **Alojamento:** Render (aplicação) + Aiven (base de dados)

## Estrutura do projeto

```
charity-inventory/
├── server.js                 # Ponto de entrada da aplicação Express
├── config/                   # Ligação à BD, mailer, geolocalização, init
├── middleware/               # Autenticação e autorização (JWT)
├── routes/                   # Rotas da API (auth, users, products, donations, requests, ...)
├── database/                 # Esquema (schema.sql) e dados de exemplo (seed.sql)
├── public/                   # Frontend (HTML, CSS, JS)
│   ├── css/                  # Folha de estilos
│   └── js/                   # Lógica do cliente
└── docs/                     # Documentação e diagramas
```

## Instalação local

Requisitos: Node.js e um servidor MySQL.

```bash
# 1. Instalar dependências
npm install

# 2. Configurar a base de dados (variáveis de ambiente)
#    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# 3. Criar a estrutura e dados de exemplo
#    correr database/schema.sql e database/seed.sql

# 4. Arrancar o servidor
npm start
```

A aplicação fica disponível em `http://localhost:3000` (ou na porta definida em `PORT`).

## Variáveis de ambiente

| Variável         | Descrição                                          |
|------------------|----------------------------------------------------|
| `DB_HOST`        | Endereço do servidor MySQL                         |
| `DB_PORT`        | Porta do MySQL                                      |
| `DB_USER`        | Utilizador da base de dados                         |
| `DB_PASSWORD`    | Palavra-passe da base de dados                      |
| `DB_NAME`        | Nome da base de dados                               |
| `DB_SSL`         | `true` para ligações com SSL (necessário no Aiven) |
| `DB_AUTO_INIT`   | `true` para criar e popular a BD no arranque       |
| `JWT_SECRET`     | Chave para assinar os tokens JWT                    |
| `GEMINI_API_KEY` | (Opcional) Chave da IA para o chatbot              |

A configuração do email (Brevo) é feita na página de **Definições** da aplicação.

## Utilizadores de demonstração

Todos com a palavra-passe `password123`:

| Papel               | Email                  |
|---------------------|------------------------|
| Administrador       | admin@caridade.pt      |
| Técnico social      | tecnico@caridade.pt    |
| Operador de armazém | armazem@caridade.pt    |

## Documentação

A pasta `docs/` contém o relatório do projeto e os diagramas UML (casos de uso, classes, sequência, atividades e estados), disponíveis em SVG (para visualização) e em formato editável draw.io.

## Autores

Projeto de grupo (quatro elementos) — IPCA, CTESP Redes e Sistemas Informáticos.
