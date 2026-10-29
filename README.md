# REF LAB · MV LAB

Biblioteca de referências de set da MV LAB: equipamento, configurações de câmera e luz, planta do set vista de cima, stills por câmera e fotos de bastidor.

Usa **o mesmo projeto Supabase do gestor de equipamentos** (`MVLAB - Gestor de inventário`). O login é o mesmo: quem é membro ativo no gestor entra no REF LAB.

## Rodar

Site estático, sem build. Sirva a pasta:

```bash
python3 -m http.server 8000   # → http://localhost:8000
```

Para publicar, suba a pasta para o GitHub Pages (ou qualquer hospedagem estática). Depois, no Supabase, em **Authentication → URL Configuration**, adicione o endereço publicado em *Redirect URLs* para o link de “Esqueci a senha” funcionar.

## Estrutura

```
index.html        ← carrega supabase-js (CDN), config.js e js/main.js
config.js         ← URL e chave publicável do Supabase, link do gestor
styles.css        ← tokens visuais herdados do gestor
js/core.js        ← cliente Supabase, fotos (redimensionar/enviar), campos de câmera e luz
js/main.js        ← login, biblioteca, ficha do projeto, notas
js/set.js         ← equipamento, cards de câmera e luz
js/planta.js      ← montador da planta do set (SVG)
js/midias.js      ← stills, behind the scenes e visualizador
supabase/001_reflab.sql ← tabelas, regras de acesso e bucket (já aplicado)
```

Preact + htm vêm do unpkg (`htm@3.1.1/preact/standalone.module.js`), sem etapa de build.

## Banco

| Tabela | O que guarda |
|---|---|
| `ref_projetos` | nome, cliente, formato, local, tags, notas, capa |
| `ref_specs` | câmeras e luzes (`tipo`), código (A, B, L1…), `campos` e `extra` em JSON |
| `ref_equipamento` | lista resumida (3 câmeras, 4 mics…), ligada às `categorias` do gestor |
| `ref_plantas` | itens da planta em JSON, tamanho da sala em cm |
| `ref_midias` | stills e BTS: arquivo, miniatura, câmera, diária, categoria, legenda |

Fotos ficam no bucket privado `ref-midias`. O navegador reduz cada foto para 2560 px e gera uma miniatura de 640 px antes de enviar.

**Acesso:** membros ativos leem e editam tudo. Apagar projeto ou foto: admin ou quem criou.

### Campos de câmera e luz

As listas de sugestões ficam em `js/core.js` (`CAM_FIELDS`, `LIGHT_FIELDS`). Para incluir um campo fixo novo, acrescente uma linha ali; não precisa mudar o banco. Para um campo pontual, use **+ Campo** no próprio card.
