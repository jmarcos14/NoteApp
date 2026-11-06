# NoteApp — Finanças, Notas & Projetos

Aplicativo **mobile first** (com modo escuro) que reúne controle financeiro pessoal, notas em Markdown com links bidirecionais, quadros visuais infinitos, Kanban de tarefas e um grafo interativo de conexões.

> React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand (persistência local) · Recharts · d3-force · marked + DOMPurify

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de produção em dist/
npm run preview    # serve o build
```

Os dados ficam no `localStorage` do navegador. No primeiro acesso o app carrega dados de exemplo; em **Configurações** dá para exportar/importar um backup JSON, restaurar os exemplos ou apagar tudo.

## App Android (APK)

O app é empacotado para Android com o [Capacitor](https://capacitorjs.com) (projeto nativo em `android/`).

Requisitos: JDK 21 e Android SDK (platform 36 e build-tools 36) com `ANDROID_HOME` definido, ou `sdk.dir` no arquivo `android/local.properties`.

```bash
npm run android:apk
# APK gerado em android/app/build/outputs/apk/debug/app-debug.apk
```

- `npm run android:sync` copia o build web para o projeto Android. Depois é só abrir `android/` no Android Studio, se preferir.
- O APK de debug serve para instalar direto no aparelho. Para publicar na Play Store, gere um build release assinado (`./gradlew bundleRelease`) com a sua própria keystore.
- Os ícones e a splash vêm das imagens em `assets/`. Para regenerar: `npx @capacitor/assets generate --android`.

## Funcionalidades

### 💰 Módulo financeiro (`/finance`)
- **Dashboard**: saldo em contas, faturas, patrimônio líquido, receitas/despesas e resultado do mês (com taxa de poupança), mini fluxo de caixa, despesas por categoria (donut), contas, cartões, orçamentos e transações recentes.
- **Lançamento rápido**: botão flutuante `+` abre um bottom sheet com valor em destaque, atalhos (+10/+25/+50/+100), categorias em chips, conta/cartão e data. Suporta despesa, receita e transferência (inclusive **pagamento de fatura**).
- **Contas e cartões**: cadastro manual de contas (corrente, poupança, dinheiro, investimentos) com saldo inicial; cartões com limite, dia de fechamento e vencimento, fatura atual e limite disponível.
- **Orçamentos por categoria**: limite mensal por categoria com barra de progresso e alerta de estouro; gestão de categorias (emoji + cor).
- **Gráficos**: fluxo de caixa (receitas × despesas + linha de resultado) e evolução do patrimônio (6 ou 12 meses).
- Navegação por mês e modo **ocultar valores** (privacidade).

### 📝 Notas (`/notes`)
- Markdown com GFM (tabelas, checklists clicáveis no preview, citações, código).
- **Links bidirecionais** `[[Título]]` / `[[Título|apelido]]` com **autocomplete** ao digitar `[[`.
- Links para notas inexistentes aparecem tracejados — clicar cria a nota.
- Links também apontam para **projetos** pelo nome.
- Painel de **backlinks**, links de saída e **menções sem link** (com botão “Linkar”).
- Renomear uma nota (ou projeto) **atualiza todos os links** que apontavam para ela.
- `#tags`, fixar notas, busca e ordenação (recentes, A–Z, mais conectadas).

### 🗂️ Quadros visuais infinitos (`/boards`)
- Canvas infinito com **pan** (arrastar o fundo / scroll), **zoom** (pinça, ctrl+scroll, botões) e “enquadrar tudo”.
- Cartões: **texto** (Markdown), **nota** (embute uma nota existente), **checklist**, **link**, **imagem** e **coluna** (colunas arrastam os cartões contidos nelas).
- Arrastar, redimensionar, cores, duplicar, excluir e **conexões** entre cartões.
- Toque para selecionar, segundo toque (ou duplo clique) para editar; duplo clique no fundo cria um cartão.
- Quadros podem ser vinculados a um projeto.

### ✅ Tarefas / Kanban (`/projects`)
- Kanban (A fazer · Em andamento · Concluído) com **drag & drop** no desktop e botões de mover no mobile (colunas com scroll-snap).
- Visão em lista com checkbox.
- Projetos com cor/descrição; tarefas com prioridade, prazo (destaque se atrasada), projeto e **nota vinculada**.
- Página do projeto mostra as notas que o referenciam e os quadros vinculados.

### 🕸️ Grafo (`/graph`)
- Mapa interativo (simulação de forças) de **notas, projetos, quadros, tags e notas ainda não criadas**.
- Pan, zoom (pinça/scroll), arrastar nós, busca, filtros por tipo e destaque da vizinhança do nó selecionado.
- Painel do nó com vizinhos e botão **Abrir** (ou **Criar nota** para links pendentes).
- Atalho “ver no grafo” a partir de notas e projetos (`/graph?focus=note:<id>`).

### 📱 Navegação e UI
- **Barra inferior** com os 5 módulos no mobile; barra lateral em telas ≥ 768px.
- Tema **claro / escuro / sistema** sem flash na carga, safe-areas do iOS, bottom sheets, manifest PWA.

## Estrutura

```
src/
├── App.tsx                 # rotas (lazy) + layout com navegação
├── types.ts                # modelos de domínio
├── index.css               # Tailwind v4, tema, estilos do Markdown e do canvas
├── components/
│   ├── BottomNav.tsx       # barra inferior (mobile) + lateral (desktop)
│   ├── MarkdownView.tsx    # render de Markdown com wikilinks clicáveis
│   └── ui.tsx              # Sheet, PageHeader, Fab, Segmented, Money, ProgressBar…
├── lib/
│   ├── finance.ts          # saldos, faturas, fluxo de caixa, patrimônio, orçamentos
│   ├── markdown.ts         # marked + extensões [[wikilink]] e #tag, sanitização
│   ├── wikilinks.ts        # extração de links/tags, backlinks, menções
│   └── utils.ts            # formatação (BRL, datas), ids, cores
├── store/                  # Zustand + persist (localStorage)
│   ├── finance.ts · notes.ts · projects.ts · boards.ts · settings.ts
│   └── seed.ts             # dados de exemplo
└── modules/
    ├── finance/            # FinanceLayout, Dashboard, Transactions, Accounts, Budgets, Reports, QuickAddSheet
    ├── notes/              # NotesList, NoteEditor
    ├── boards/             # BoardsList, BoardCanvas, BoardItemView
    ├── projects/           # ProjectsPage (Kanban/lista, projetos, tarefas)
    ├── graph/              # GraphView
    └── settings/           # SettingsPage (tema, privacidade, backup)
```

## Próximos passos sugeridos
- Sincronização na nuvem / multi-dispositivo (ex.: Supabase) e autenticação.
- Service worker para uso offline completo (PWA instalável).
- Transações recorrentes e parceladas; importação de extratos (OFX/CSV).
- Upload de imagens nos quadros e anexos nas notas.
