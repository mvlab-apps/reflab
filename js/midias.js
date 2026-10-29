// Abas "Stills" e "Behind the scenes": envio, galeria e visualizador
import { html, useState, useEffect, sb, q, acao, erro, toast, useUrls, enviarFoto, apagarFoto, hoje, Modal, KIND, CATEGORIAS_BTS } from './core.js';

export function Galeria({ tipo, d, patch, projeto, setProjeto }) {
  const still = tipo === 'still';
  const lista = d.midias.filter((m) => m.tipo === tipo);
  const cams = d.specs.filter((s) => s.tipo === 'camera');
  const [filtro, setFiltro] = useState('Todas');
  const [envio, setEnvio] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [sobre, setSobre] = useState(false);
  const thumbs = useUrls(lista.map((m) => m.thumb_path || m.path));

  const chave = (m) => (still ? m.diaria || 'Sem diária' : m.categoria || 'Outras');
  const opcoes = [...new Set(lista.slice().reverse().map(chave))];
  const vis = lista.filter((m) => filtro === 'Todas' || chave(m) === filtro);
  const grupos = still
    ? opcoes.filter((o) => filtro === 'Todas' || o === filtro).map((o) => [o, vis.filter((m) => chave(m) === o).sort((a, b) => (a.camera || 'zz').localeCompare(b.camera || 'zz'))])
    : [[null, vis.slice().reverse()]];

  const abrirEnvio = (files) => setEnvio({ files: [...(files || [])].filter((f) => f.type.startsWith('image/') || /\.heic$/i.test(f.name)), camera: cams[0]?.codigo || '', diaria: lista[lista.length - 1]?.diaria || hoje(), categoria: CATEGORIAS_BTS[0], legenda: '' });
  const soltar = (e) => { e.preventDefault(); setSobre(false); if (e.dataTransfer.files.length) abrirEnvio(e.dataTransfer.files); };
  const atualizar = (m) => patch('midias', (l) => l.map((x) => (x.id === m.id ? m : x)));

  return html`<section class=${'galeria' + (sobre ? ' sobre' : '')} onDragOver=${(e) => { e.preventDefault(); setSobre(true); }} onDragLeave=${(e) => e.currentTarget === e.target && setSobre(false)} onDrop=${soltar}>
    <div class="gal-head"><h2>${still ? 'Stills por câmera' : 'Behind the scenes'}</h2>
      ${opcoes.length > 1 && ['Todas', ...opcoes].map((o) => html`<button class=${'chip' + (filtro === o ? ' on' : '')} onClick=${() => setFiltro(o)}>${o}</button>`)}
      <button class="btn sm gold push" onClick=${() => abrirEnvio([])}>+ ${still ? 'Adicionar stills' : 'Enviar fotos'}</button></div>
    ${!lista.length && html`<div class="drop-vazio"><strong>${still ? 'Nenhum still ainda' : 'Nenhuma foto de bastidor ainda'}</strong>
      <span>${still ? 'Arraste aqui os frames exportados (um por câmera) ou use o botão acima.' : 'Arraste aqui as fotos da montagem, da luz e do set pronto. Do celular, use o botão acima.'}</span></div>`}
    ${grupos.map(([g, ms]) => html`${g && html`<p class="label grupo">Diária · ${g}</p>`}
      <div class=${still ? 'stills' : 'bts'}>${ms.map((m) => still
        ? html`<button class="still" onClick=${() => setAberta(m.id)}><div class="frame">${thumbs[m.thumb_path || m.path] && html`<img src=${thumbs[m.thumb_path || m.path]} alt=${m.legenda || ''} loading="lazy" />`}${m.camera && html`<span class="tag">CAM ${m.camera}</span>`}${projeto.capa_midia_id === m.id && html`<span class="tc">CAPA</span>`}</div>
            <div class="cap"><b>${m.camera ? 'Câmera ' + m.camera : 'Sem câmera'}</b><span>${m.legenda || KIND.camera.sub(cams.find((c) => c.codigo === m.camera)?.campos || {})}</span></div></button>`
        : html`<figure onClick=${() => setAberta(m.id)}><div class="frame" style=${{ aspectRatio: `${m.largura || 4}/${m.altura || 3}` }}>${thumbs[m.thumb_path || m.path] && html`<img src=${thumbs[m.thumb_path || m.path]} alt=${m.legenda || ''} loading="lazy" />`}</div>
            <figcaption>${m.legenda && html`<b>${m.legenda}</b>`}<span class="ph">${m.categoria || ''}</span></figcaption></figure>`)}</div>`)}
    ${envio && html`<${Envio} still=${still} envio=${envio} setEnvio=${setEnvio} cams=${cams} lista=${lista} projetoId=${projeto.id} onFeito=${(novas) => patch('midias', (l) => [...l, ...novas])} />`}
    ${aberta && html`<${Visualizador} id=${aberta} lista=${grupos.flatMap(([, ms]) => ms)} still=${still} cams=${cams} projeto=${projeto} setProjeto=${setProjeto}
      onFechar=${() => setAberta(null)} setAberta=${setAberta} atualizar=${atualizar} remover=${(id) => { patch('midias', (l) => l.filter((x) => x.id !== id)); setAberta(null); }} />`}
  </section>`;
}

function Envio({ still, envio, setEnvio, cams, lista, projetoId, onFeito }) {
  const [prog, setProg] = useState(null);
  const set = (k) => (e) => { const v = e.target.value; setEnvio((x) => ({ ...x, [k]: v })); };
  const diarias = [...new Set(lista.map((m) => m.diaria).filter(Boolean))];
  const enviar = async (e) => {
    e.preventDefault();
    const novas = [];
    for (let i = 0; i < envio.files.length; i++) {
      setProg({ feito: i, total: envio.files.length });
      try {
        novas.push(await enviarFoto(projetoId, still ? 'still' : 'bts', envio.files[i], still
          ? { camera: envio.camera || null, diaria: envio.diaria.trim() || null, legenda: envio.legenda.trim() || null }
          : { categoria: envio.categoria || null, legenda: envio.legenda.trim() || null, diaria: envio.diaria.trim() || null }));
      } catch (err) { erro(err); }
    }
    onFeito(novas); setEnvio(null);
    toast(novas.length === envio.files.length ? `${novas.length} ${novas.length === 1 ? 'foto enviada' : 'fotos enviadas'}.` : `${novas.length} de ${envio.files.length} fotos enviadas.`, novas.length === envio.files.length ? '' : 'erro');
  };
  return html`<${Modal} titulo=${still ? 'Adicionar stills' : 'Enviar fotos de bastidor'} onFechar=${() => !prog && setEnvio(null)}>
    <form class="form" onSubmit=${enviar}>
      <label class="field span2 arquivo"><span class="label">Fotos</span>
        <input id="m-files" type="file" accept="image/*" multiple onChange=${(e) => { const fs = [...e.target.files]; setEnvio((x) => ({ ...x, files: [...x.files, ...fs] })); }} />
        <span class="muted sm">${envio.files.length ? `${envio.files.length} ${envio.files.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}` : 'Nenhum arquivo. Você também pode arrastar fotos para a página.'} As fotos são reduzidas para 2560 px antes do envio.</span></label>
      ${still && html`<label class="field"><span class="label">Câmera</span><select id="m-cam" value=${envio.camera} onChange=${set('camera')}><option value="">Sem câmera</option>${cams.map((c) => html`<option value=${c.codigo}>CAM ${c.codigo} · ${c.nome}</option>`)}</select></label>`}
      ${!still && html`<label class="field"><span class="label">Categoria</span><select id="m-cat" value=${envio.categoria} onChange=${set('categoria')}>${CATEGORIAS_BTS.map((c) => html`<option>${c}</option>`)}</select></label>`}
      <label class="field"><span class="label">Diária / episódio</span><input id="m-diaria" list="dl-diarias" value=${envio.diaria} onInput=${set('diaria')} placeholder="Ex.: Ep. 08 · 12/09" />
        <datalist id="dl-diarias">${diarias.map((x) => html`<option value=${x} />`)}</datalist></label>
      <label class="field span2"><span class="label">Legenda (para todas)</span><input id="m-leg" value=${envio.legenda} onInput=${set('legenda')} placeholder=${still ? 'Plano aberto, close do convidado…' : 'Grid de luz montado antes da talent…'} /></label>
      <div class="form-actions span2">${prog && html`<span class="muted">Enviando ${prog.feito + 1} de ${prog.total}…</span>`}
        <button type="button" class="btn" disabled=${!!prog} onClick=${() => setEnvio(null)}>Cancelar</button>
        <button class="btn gold" disabled=${!envio.files.length || !!prog}>Enviar ${envio.files.length || ''} ${envio.files.length === 1 ? 'foto' : 'fotos'}</button></div>
    </form><//>`;
}

function Visualizador({ id, lista, still, cams, projeto, setProjeto, onFechar, setAberta, atualizar, remover }) {
  const i = lista.findIndex((m) => m.id === id), m = lista[i];
  const [armado, setArmado] = useState(false);
  const urls = useUrls(m ? [m.path] : []);
  useEffect(() => setArmado(false), [id]);
  useEffect(() => {
    const f = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowRight' && lista[i + 1]) setAberta(lista[i + 1].id);
      if (e.key === 'ArrowLeft' && lista[i - 1]) setAberta(lista[i - 1].id);
    };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  });
  if (!m) return null;
  const cam = cams.find((c) => c.codigo === m.camera);
  const salvar = (k) => async (e) => {
    const v = e.target.value.trim() || null; if (v === m[k]) return;
    if (await acao(() => q(sb.from('ref_midias').update({ [k]: v }).eq('id', m.id)))) atualizar({ ...m, [k]: v });
  };
  const capa = async () => { if (await acao(() => q(sb.from('ref_projetos').update({ capa_midia_id: m.id }).eq('id', projeto.id)), 'Capa do projeto atualizada.')) setProjeto({ ...projeto, capa_midia_id: m.id }); };
  const excluir = async () => { if (!armado) return setArmado(true); if (await acao(() => apagarFoto(m), 'Foto excluída.')) remover(m.id); };

  return html`<div class="lb" role="dialog" aria-label="Foto">
    <div class="img" onClick=${(e) => e.target === e.currentTarget && onFechar()}>
      ${urls[m.path] ? html`<img src=${urls[m.path]} alt=${m.legenda || ''} />` : html`<span class="muted">Carregando…</span>`}
      ${lista[i - 1] && html`<button class="nav prev" aria-label="Anterior" onClick=${() => setAberta(lista[i - 1].id)}>‹</button>`}
      ${lista[i + 1] && html`<button class="nav next" aria-label="Próxima" onClick=${() => setAberta(lista[i + 1].id)}>›</button>`}
      <button class="btn close" onClick=${onFechar}>Fechar · Esc</button></div>
    <aside key=${m.id}><span class="label">${still ? 'Still' : 'Behind the scenes'} · ${i + 1} de ${lista.length}</span>
      <h3>${still ? (cam ? `CAM ${cam.codigo} · ${cam.nome}` : 'Sem câmera') : m.legenda || m.categoria || 'Foto'}</h3>
      ${still && cam && html`<dl class="kv">${KIND.camera.fields.filter(([k]) => cam.campos[k]).map(([k, l]) => html`<dt>${l}</dt><dd>${cam.campos[k]}</dd>`)}</dl>${cam.nota && html`<p class="muted sm">${cam.nota}</p>`}`}
      ${still && html`<label class="field"><span class="label">Câmera</span><select value=${m.camera || ''} onChange=${salvar('camera')}><option value="">Sem câmera</option>${cams.map((c) => html`<option value=${c.codigo}>CAM ${c.codigo} · ${c.nome}</option>`)}</select></label>`}
      ${!still && html`<label class="field"><span class="label">Categoria</span><select value=${m.categoria || ''} onChange=${salvar('categoria')}><option value="">Outras</option>${CATEGORIAS_BTS.map((c) => html`<option>${c}</option>`)}</select></label>`}
      <label class="field"><span class="label">Legenda</span><input value=${m.legenda || ''} onChange=${salvar('legenda')} placeholder="Descreva a foto" /></label>
      <label class="field"><span class="label">Diária / episódio</span><input value=${m.diaria || ''} onChange=${salvar('diaria')} /></label>
      <span class="muted sm">${m.largura}×${m.altura} px · enviada em ${new Date(m.criado_em).toLocaleDateString('pt-BR')}</span>
      <div class="row">${projeto.capa_midia_id === m.id ? html`<span class="chip on">Capa do projeto</span>` : html`<button class="btn sm" onClick=${capa}>Usar como capa</button>`}
        ${urls[m.path] && html`<a class="btn sm" href=${urls[m.path]} target="_blank" rel="noopener">Abrir original</a>`}
        <button class=${'btn sm danger' + (armado ? ' armed' : '')} onClick=${excluir}>${armado ? 'Confirmar exclusão' : 'Excluir'}</button></div>
    </aside></div>`;
}
