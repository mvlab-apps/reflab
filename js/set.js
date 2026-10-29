// Aba "Set & specs": equipamento, câmeras, luzes e a planta do set
import { html, useState, useEffect, useMemo, sb, q, acao, erro, toast, useDebounce, KIND } from './core.js';
import { Planta, novoItemId } from './planta.js';

export function SetTab({ d, patch }) {
  const [foco, setFoco] = useState(null); // código da spec em destaque (card ↔ planta)
  const [estado, setEstado] = useState('');
  const gravarPlanta = useDebounce(async (pl) => {
    setEstado('Salvando…');
    const ok = await acao(() => q(sb.from('ref_plantas').upsert({ projeto_id: pl.projeto_id, largura_cm: pl.largura_cm, profundidade_cm: pl.profundidade_cm, itens: pl.itens, atualizado_em: new Date().toISOString() })));
    setEstado(ok ? 'Salvo' : 'Não salvo');
  }, 700);
  const mudarPlanta = (fn) => patch('planta', (pl) => { const nova = fn(pl); gravarPlanta(nova); return nova; });

  return html`<div class="two">
    <div class="stack">
      <${Equipamento} d=${d} patch=${patch} />
      ${['camera', 'luz'].map((tipo) => html`<${Specs} tipo=${tipo} d=${d} patch=${patch} foco=${foco} setFoco=${setFoco} mudarPlanta=${mudarPlanta} />`)}
    </div>
    <div class="stack"><${Planta} planta=${d.planta} specs=${d.specs} onChange=${mudarPlanta} foco=${foco} setFoco=${setFoco} estado=${estado} /></div>
  </div>`;
}

// ------------------------------------------------------------------ equipamento (ligado às categorias do gestor)
let inventario;
async function carregarInventario() {
  if (inventario) return inventario;
  const [cats, eqs] = await Promise.all([
    q(sb.from('categorias').select('nome,grupo,ordem').order('ordem')),
    q(sb.from('equipamentos').select('categoria,status')),
  ]);
  const porCat = {};
  eqs.forEach((e) => { const c = (porCat[e.categoria] ||= { total: 0, ok: 0 }); c.total++; if (e.status === 'ok') c.ok++; });
  return (inventario = { cats, porCat });
}

function Equipamento({ d, patch }) {
  const [inv, setInv] = useState(null);
  const [rasc, setRasc] = useState(null); // lista em edição
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { carregarInventario().then(setInv).catch(() => setInv({ cats: [], porCat: {} })); }, []);

  const salvar = async () => {
    setOcupado(true);
    const linhas = rasc.filter((r) => r.tipo.trim() || (r.modelos || '').trim())
      .map((r, i) => ({ projeto_id: d.p.id, quantidade: Math.max(0, parseInt(r.quantidade) || 0), tipo: r.tipo.trim(), modelos: (r.modelos || '').trim() || null, categoria: r.categoria || null, ordem: i }));
    try {
      await q(sb.from('ref_equipamento').delete().eq('projeto_id', d.p.id));
      const novos = linhas.length ? await q(sb.from('ref_equipamento').insert(linhas).select()) : [];
      patch('equip', novos); setRasc(null); toast('Equipamento salvo.');
    } catch (e) { erro(e); }
    setOcupado(false);
  };
  const set = (i, k) => (e) => { const v = e.target.value; setRasc((l) => l.map((r, j) => (j === i ? { ...r, [k]: v } : r))); };

  return html`<section class="panel"><header><h2>Equipamento</h2><span class="chip">integrado ao inventário</span><div class="act">${rasc
    ? html`<button class="btn sm" onClick=${() => setRasc(null)}>Cancelar</button><button class="btn sm gold" disabled=${ocupado} onClick=${salvar}>Salvar</button>`
    : html`<button class="btn sm" onClick=${() => setRasc(d.equip.map((x) => ({ ...x })))}>Editar</button>`}</div></header>
    <div class="body">${rasc ? html`<div class="eq-edit">
        ${rasc.map((r, i) => html`<div class="eq-row">
          <input type="number" min="0" aria-label="Quantidade" value=${r.quantidade} onInput=${set(i, 'quantidade')} />
          <input aria-label="Tipo" placeholder="câmeras, mics de podcast…" value=${r.tipo} onInput=${set(i, 'tipo')} />
          <input aria-label="Modelos" placeholder="Modelos (Sony FX3, FX30…)" value=${r.modelos || ''} onInput=${set(i, 'modelos')} />
          <select aria-label="Categoria do inventário" value=${r.categoria || ''} onChange=${set(i, 'categoria')}><option value="">Sem vínculo com o inventário</option>
            ${(inv?.cats || []).map((c) => html`<option value=${c.nome}>${c.nome}</option>`)}</select>
          <button class="btn sm" aria-label="Remover linha" onClick=${() => setRasc(rasc.filter((_, j) => j !== i))}>×</button></div>`)}
        <button class="btn sm" onClick=${() => setRasc([...rasc, { quantidade: 1, tipo: '', modelos: '', categoria: '' }])}>+ Item</button>
        <p class="muted sm">Vincular a uma categoria do inventário mostra quantos itens dela estão disponíveis no gestor.</p></div>`
      : d.equip.length ? html`<div class="gear">${d.equip.map((g) => {
          const c = g.categoria && inv?.porCat[g.categoria];
          return html`<div><span class="q">${g.quantidade}<small>${g.tipo}</small></span><span class="m">${g.modelos || ''}</span>
            ${g.categoria ? html`<span class=${'stock' + (c && c.ok < g.quantidade ? ' low' : '')} title=${g.categoria}>● ${c ? `${c.ok} de ${c.total} ok no inventário` : 'categoria sem itens'}</span>` : ''}</div>`;
        })}</div>`
      : html`<p class="vazio">Nenhum item. Clique em Editar para listar o que o set precisa (3 câmeras, 4 mics, 5 pontos de luz…).</p>`}</div></section>`;
}

// ------------------------------------------------------------------ câmeras e luzes
function proxCodigo(tipo, specs) {
  const usados = new Set(specs.filter((s) => s.tipo === tipo).map((s) => s.codigo));
  for (let n = 0; ; n++) { const c = tipo === 'camera' ? (n < 26 ? String.fromCharCode(65 + n) : 'C' + (n + 1)) : 'L' + (n + 1); if (!usados.has(c)) return c; }
}

function Specs({ tipo, d, patch, foco, setFoco, mudarPlanta }) {
  const K = KIND[tipo];
  const lista = d.specs.filter((s) => s.tipo === tipo);
  const [editando, setEditando] = useState(null);

  // nova spec copia a última do mesmo tipo (câmeras de um set costumam estar casadas) e entra na planta
  const adicionar = async (base) => {
    const codigo = proxCodigo(tipo, d.specs), src = base || lista[lista.length - 1];
    const linha = { projeto_id: d.p.id, tipo, codigo, ordem: lista.length,
      nome: tipo === 'camera' ? `Câmera ${codigo}` : base ? `${base.nome} (cópia)` : 'Nova luz',
      campos: src ? { ...src.campos } : {}, extra: src ? src.extra.map((x) => ({ ...x })) : [], nota: null };
    try {
      const nova = await q(sb.from('ref_specs').insert(linha).select().single());
      patch('specs', (s) => [...s, nova]);
      mudarPlanta((pl) => ({ ...pl, itens: [...pl.itens, { id: novoItemId(), t: tipo === 'camera' ? 'cam' : 'soft', x: Math.round(pl.largura_cm / 2), y: tipo === 'camera' ? Math.round(pl.profundidade_cm * 0.85) : Math.round(pl.profundidade_cm * 0.25), r: tipo === 'camera' ? 0 : 180, label: codigo, spec: codigo }] }));
      setEditando(nova.id); setFoco(codigo);
    } catch (e) { erro(e); }
  };
  const copiar = () => {
    const txt = lista.map((c) => `CAM ${c.codigo} · ${[c.campos.corpo, c.campos.lente, c.campos.focal, c.campos.iso && 'ISO ' + c.campos.iso, c.campos.iris, c.campos.shutter, c.campos.nd, c.campos.wb, c.campos.fps, c.campos.perfil].filter((v) => v && v !== '—').join(' · ')}`).join('\n');
    navigator.clipboard.writeText(`${d.p.nome}\n${txt}`).then(() => toast('Setup das câmeras copiado.'), () => toast('Não foi possível copiar neste navegador.', 'erro'));
  };

  return html`<section class="panel"><header><h2>${K.titulo}</h2><span class="chip">${lista.length}</span><div class="act">
      ${tipo === 'camera' && lista.length > 0 && html`<button class="btn sm" onClick=${copiar}>Copiar setup</button>`}
      <button class="btn sm gold" onClick=${() => adicionar()}>${K.novo}</button></div></header>
    <div class="body speccards">
      ${lista.map((s) => html`<${SpecCard} key=${s.id} s=${s} K=${K} tipo=${tipo} ed=${editando === s.id} setEd=${(v) => setEditando(v ? s.id : null)}
        hl=${foco === s.codigo} onFoco=${() => setFoco(s.codigo)} patch=${patch} mudarPlanta=${mudarPlanta} duplicar=${() => adicionar(s)} />`)}
      ${!lista.length && html`<p class="vazio">Nenhuma ${tipo === 'camera' ? 'câmera' : 'luz'}. Use “${K.novo}”.</p>`}
    </div>
    ${K.fields.filter(([, , o]) => Array.isArray(o)).map(([k, , o]) => html`<datalist id=${`dl-${tipo}-${k}`}>${o.map((v) => html`<option value=${v} />`)}</datalist>`)}
  </section>`;
}

function SpecCard({ s, K, tipo, ed, setEd, hl, onFoco, patch, mudarPlanta, duplicar }) {
  const [r, setR] = useState(null); // rascunho
  const [armado, setArmado] = useState(false);
  useEffect(() => { setR(ed ? { nome: s.nome, campos: { ...s.campos }, extra: s.extra.map((x) => ({ ...x })), nota: s.nota || '' } : null); setArmado(false); }, [ed]);

  if (!ed || !r) {
    const cells = K.fields.filter(([k]) => !K.skip.includes(k) && s.campos[k])
      .map(([k, l]) => html`<div><dt>${l}</dt><dd>${k === 'kelvin' && s.campos.cor ? html`<span class="sw" style=${{ background: s.campos.cor }}></span>` : ''}${s.campos[k]}</dd></div>`)
      .concat(s.extra.filter((x) => x.k || x.v).map((x) => html`<div><dt>${x.k}</dt><dd>${x.v}</dd></div>`));
    return html`<article class=${'spec' + (hl ? ' hl' : '')} onMouseEnter=${onFoco}>
      <header><span class=${'id ' + K.cls}>${K.badge(s)}</span><strong>${s.nome}</strong><span class="model">${K.sub(s.campos)}</span>
        <button class="btn sm edit" onClick=${() => setEd(true)}>Editar</button></header>
      ${cells.length > 0 && html`<dl>${cells}</dl>`}${s.nota && html`<p>${s.nota}</p>`}</article>`;
  }

  const setC = (k) => (e) => { const v = e.target.value; setR((x) => ({ ...x, campos: { ...x.campos, [k]: v } })); };
  const setX = (i, k) => (e) => { const v = e.target.value; setR((x) => ({ ...x, extra: x.extra.map((y, j) => (j === i ? { ...y, [k]: v } : y)) })); };
  const salvar = async () => {
    const campos = Object.fromEntries(Object.entries(r.campos).filter(([, v]) => v !== '' && v != null));
    const dados = { nome: r.nome.trim() || s.codigo, campos, extra: r.extra.filter((x) => x.k.trim() || x.v.trim()), nota: r.nota.trim() || null };
    if (await acao(() => q(sb.from('ref_specs').update(dados).eq('id', s.id)), `${dados.nome} salvo.`)) { patch('specs', (l) => l.map((x) => (x.id === s.id ? { ...x, ...dados } : x))); setEd(false); }
  };
  const excluir = async () => {
    if (!armado) return setArmado(true);
    if (await acao(() => q(sb.from('ref_specs').delete().eq('id', s.id)), `${s.nome} excluído e removido da planta.`)) {
      patch('specs', (l) => l.filter((x) => x.id !== s.id));
      mudarPlanta((pl) => ({ ...pl, itens: pl.itens.filter((i) => i.spec !== s.codigo) }));
    }
  };

  return html`<article class="spec editing hl">
    <header><span class=${'id ' + K.cls}>${K.badge(s)}</span><input class="nm" aria-label="Nome" placeholder="Nome" value=${r.nome} onInput=${(e) => { const v = e.target.value; setR((x) => ({ ...x, nome: v })); }} /></header>
    <div class="edit-grid">${K.fields.map(([k, l, o]) => html`<label class="field"><span class="label">${l}</span>${o === 'color'
      ? html`<input type="color" value=${r.campos[k] || '#ffffff'} onInput=${setC(k)} />`
      : html`<input list=${`dl-${tipo}-${k}`} autocomplete="off" placeholder="—" value=${r.campos[k] || ''} onInput=${setC(k)} onFocus=${(e) => e.target.select()} />`}</label>`)}</div>
    <div class="xbox"><span class="label">Campos extras</span>
      ${r.extra.map((x, i) => html`<div class="xrow"><input placeholder="Campo (ex.: Gimbal)" value=${x.k} onInput=${setX(i, 'k')} /><input placeholder="Valor" value=${x.v} onInput=${setX(i, 'v')} />
        <button class="btn sm" aria-label="Remover campo" onClick=${() => setR({ ...r, extra: r.extra.filter((_, j) => j !== i) })}>×</button></div>`)}
      <button class="btn sm" onClick=${() => setR({ ...r, extra: [...r.extra, { k: '', v: '' }] })}>+ Campo</button></div>
    <label class="field nota"><span class="label">Nota</span><textarea rows="2" placeholder="Posição, cuidados, o que aprendemos…" value=${r.nota} onInput=${(e) => { const v = e.target.value; setR((x) => ({ ...x, nota: v })); }}></textarea></label>
    <footer><button class="btn sm gold" onClick=${salvar}>Salvar</button><button class="btn sm" onClick=${() => setEd(false)}>Cancelar</button>
      <button class="btn sm" onClick=${() => { setEd(false); duplicar(); }}>Duplicar</button>
      <button class=${'btn sm danger' + (armado ? ' armed' : '')} onClick=${excluir}>${armado ? 'Confirmar exclusão' : 'Excluir'}</button></footer>
  </article>`;
}
