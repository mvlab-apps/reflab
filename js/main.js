// Shell do app: login, biblioteca de projetos e ficha do projeto
import { html, render, useState, useEffect, useRef, sb, q, acao, erro, toast, useRota, ir, useDebounce, useUrls, dataBR, Modal, FORMATOS, GESTOR_URL } from './core.js';
import { SetTab } from './set.js';
import { Galeria } from './midias.js';

// ------------------------------------------------------------------ login (mesmas contas do gestor)
function Login() {
  const [f, setF] = useState({ email: '', senha: '' });
  const [modo, setModo] = useState('entrar');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e) => {
    e.preventDefault(); setOcupado(true);
    if (modo === 'entrar') await acao(() => q(sb.auth.signInWithPassword({ email: f.email.trim(), password: f.senha })));
    else await acao(() => q(sb.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: location.origin + location.pathname })), 'Enviamos um link para redefinir a senha.');
    setOcupado(false);
  };
  return html`<div class="login"><form class="panel login-box" onSubmit=${enviar}>
    <div class="brand big">REF <b>LAB</b></div>
    <p class="muted">Entre com a mesma conta do gestor de equipamentos.</p>
    <label class="field"><span class="label">E-mail</span><input id="l-email" type="email" required autocomplete="username" value=${f.email} onInput=${(e) => { const v = e.target.value; setF((x) => ({ ...x, email: v })); }} /></label>
    ${modo === 'entrar' && html`<label class="field"><span class="label">Senha</span><input id="l-senha" type="password" required autocomplete="current-password" value=${f.senha} onInput=${(e) => { const v = e.target.value; setF((x) => ({ ...x, senha: v })); }} /></label>`}
    <button class="btn gold" disabled=${ocupado}>${modo === 'entrar' ? 'Entrar' : 'Enviar link'}</button>
    <button type="button" class="link" onClick=${() => setModo(modo === 'entrar' ? 'senha' : 'entrar')}>${modo === 'entrar' ? 'Esqueci a senha' : 'Voltar para o login'}</button>
    <p class="muted sm">Ainda não tem conta? Peça acesso ${GESTOR_URL ? html`no <a href=${GESTOR_URL}>gestor de equipamentos</a>` : 'no gestor de equipamentos'}.</p>
  </form></div>`;
}

function NovaSenha({ onFim }) {
  const [s, setS] = useState('');
  const salvar = async (e) => { e.preventDefault(); if (await acao(() => q(sb.auth.updateUser({ password: s })), 'Senha atualizada.')) onFim(); };
  return html`<div class="login"><form class="panel login-box" onSubmit=${salvar}>
    <div class="brand big">REF <b>LAB</b></div><p class="muted">Escolha uma nova senha.</p>
    <label class="field"><span class="label">Nova senha</span><input id="n-senha" type="password" minlength="6" required autocomplete="new-password" value=${s} onInput=${(e) => setS(e.target.value)} /></label>
    <button class="btn gold">Salvar senha</button></form></div>`;
}

// ------------------------------------------------------------------ barra superior
function Topo({ perfil, busca, setBusca }) {
  const ref = useRef();
  useEffect(() => {
    const f = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); ref.current?.focus(); } };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }, []);
  const ini = (perfil?.nome || perfil?.email || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return html`<div class="top"><div class="wrap">
    <a class="brand" href="#/">REF <b>LAB</b> <small>MV LAB</small></a>
    <label class="search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="busca" ref=${ref} placeholder="Buscar projeto, cliente, câmera, luz…" value=${busca} onInput=${(e) => { setBusca(e.target.value); if (location.hash.startsWith('#/p/')) ir('#/'); }} /><kbd>⌘K</kbd></label>
    <div class="user"><span>${perfil?.nome || perfil?.email}</span><div class="avatar">${ini}</div>
      <button class="btn sm ghost" onClick=${() => sb.auth.signOut()}>Sair</button></div>
  </div></div>`;
}

// ------------------------------------------------------------------ formulário de projeto (novo / editar)
function ProjetoForm({ projeto, projetos, onFechar, onSalvo }) {
  const novo = !projeto;
  const [f, setF] = useState(projeto ? { ...projeto, tags: (projeto.tags || []).join(', ') } : { nome: '', cliente: '', formato: '', local: '', diretor_foto: '', ultima_gravacao: '', tags: '', base: '' });
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const set = (k) => (e) => { const v = e.target.value; setF((x) => ({ ...x, [k]: v })); };
  const formatos = [...new Set([...FORMATOS, ...projetos.map((p) => p.formato).filter(Boolean)])];

  const salvar = async (e) => {
    e.preventDefault(); setOcupado(true);
    const dados = { nome: f.nome.trim(), cliente: f.cliente || null, formato: f.formato || null, local: f.local || null, diretor_foto: f.diretor_foto || null,
      ultima_gravacao: f.ultima_gravacao || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), atualizado_em: new Date().toISOString() };
    try {
      if (novo) {
        const p = await q(sb.from('ref_projetos').insert(dados).select().single());
        if (f.base) await duplicarConteudo(f.base, p.id);
        toast(f.base ? 'Projeto criado a partir do set escolhido.' : 'Projeto criado.');
        onSalvo(p);
      } else {
        await q(sb.from('ref_projetos').update(dados).eq('id', projeto.id));
        toast('Dados salvos.'); onSalvo({ ...projeto, ...dados });
      }
    } catch (err) { erro(err); setOcupado(false); }
  };
  const excluir = async () => {
    if (!confirmar) return setConfirmar(true);
    if (await acao(() => q(sb.from('ref_projetos').delete().eq('id', projeto.id)), 'Projeto excluído.')) { onFechar(); ir('#/'); }
  };

  return html`<${Modal} titulo=${novo ? 'Novo projeto' : 'Dados do projeto'} onFechar=${onFechar}>
    <form class="form" onSubmit=${salvar}>
      <label class="field span2"><span class="label">Nome</span><input id="p-nome" required value=${f.nome} onInput=${set('nome')} placeholder="Ex.: Mind Asset" /></label>
      <label class="field"><span class="label">Cliente</span><input id="p-cliente" value=${f.cliente || ''} onInput=${set('cliente')} /></label>
      <label class="field"><span class="label">Formato</span><input id="p-formato" list="dl-formatos" value=${f.formato || ''} onInput=${set('formato')} placeholder="Podcast, entrevista…" /></label>
      <label class="field"><span class="label">Local</span><input id="p-local" value=${f.local || ''} onInput=${set('local')} placeholder="Estúdio MV LAB · SP" /></label>
      <label class="field"><span class="label">Diretor de foto</span><input id="p-dop" value=${f.diretor_foto || ''} onInput=${set('diretor_foto')} /></label>
      <label class="field"><span class="label">Última gravação</span><input id="p-data" type="date" value=${f.ultima_gravacao || ''} onInput=${set('ultima_gravacao')} /></label>
      <label class="field"><span class="label">Tags</span><input id="p-tags" value=${f.tags} onInput=${set('tags')} placeholder="estúdio, luz quente, 3 câmeras" /></label>
      ${novo && html`<label class="field span2"><span class="label">Começar a partir de</span>
        <select id="p-base" value=${f.base} onChange=${set('base')}><option value="">Projeto vazio</option>${projetos.map((p) => html`<option value=${p.id}>${p.nome} (copia specs, equipamento e planta)</option>`)}</select></label>`}
      <datalist id="dl-formatos">${formatos.map((x) => html`<option value=${x} />`)}</datalist>
      <div class="form-actions span2">
        ${!novo && html`<button type="button" class=${'btn danger' + (confirmar ? ' armed' : '')} onClick=${excluir}>${confirmar ? 'Confirmar: apagar projeto, specs e fotos' : 'Excluir projeto'}</button>`}
        <button type="button" class="btn" onClick=${onFechar}>Cancelar</button>
        <button class="btn gold" disabled=${ocupado}>${novo ? 'Criar projeto' : 'Salvar'}</button>
      </div>
    </form><//>`;
}

async function duplicarConteudo(de, para) {
  const [specs, equip, planta] = await Promise.all([
    q(sb.from('ref_specs').select('tipo,codigo,nome,campos,extra,nota,ordem').eq('projeto_id', de)),
    q(sb.from('ref_equipamento').select('quantidade,tipo,modelos,categoria,ordem').eq('projeto_id', de)),
    q(sb.from('ref_plantas').select('largura_cm,profundidade_cm,itens').eq('projeto_id', de).maybeSingle()),
  ]);
  if (specs.length) await q(sb.from('ref_specs').insert(specs.map((s) => ({ ...s, projeto_id: para }))));
  if (equip.length) await q(sb.from('ref_equipamento').insert(equip.map((s) => ({ ...s, projeto_id: para }))));
  if (planta) await q(sb.from('ref_plantas').insert({ ...planta, projeto_id: para }));
}

// ------------------------------------------------------------------ biblioteca
const SELECT_LISTA = '*, capa:ref_midias!ref_projetos_capa_fkey(thumb_path), midias:ref_midias!ref_midias_projeto_id_fkey(thumb_path,tipo), specs:ref_specs(tipo,campos)';

function Biblioteca({ busca, projetos, recarregar }) {
  const [filtro, setFiltro] = useState('Todos');
  const [novo, setNovo] = useState(false);
  const formatos = ['Todos', ...new Set(projetos.map((p) => p.formato).filter(Boolean))];
  const t = busca.trim().toLowerCase();
  const lista = projetos.filter((p) => (filtro === 'Todos' || p.formato === filtro) &&
    (!t || [p.nome, p.cliente, p.formato, p.local, p.diretor_foto, ...(p.tags || []), ...p.specs.flatMap((s) => Object.values(s.campos || {}))].join(' ').toLowerCase().includes(t)));
  const capas = useUrls(projetos.map((p) => p.capa?.thumb_path || p.midias.find((m) => m.tipo === 'still')?.thumb_path || p.midias[0]?.thumb_path).filter(Boolean));

  return html`<div class="wrap">
    <div class="lib-head"><div><h1>Biblioteca de sets</h1><p>${projetos.length} ${projetos.length === 1 ? 'projeto' : 'projetos'}${projetos[0] ? ` · último atualizado: ${projetos[0].nome}` : ''}</p></div>
      <button class="btn gold" onClick=${() => setNovo(true)}>+ Novo projeto</button></div>
    ${formatos.length > 2 && html`<div class="filters">${formatos.map((x) => html`<button class=${'chip' + (filtro === x ? ' on' : '')} onClick=${() => setFiltro(x)}>${x}</button>`)}</div>`}
    <div class="grid">
      ${lista.map((p) => {
        const th = p.capa?.thumb_path || p.midias.find((m) => m.tipo === 'still')?.thumb_path || p.midias[0]?.thumb_path;
        const n = (tp) => p.specs.filter((s) => s.tipo === tp).length;
        return html`<a class="card" href=${'#/p/' + p.id}>
          <div class="frame card-cover">${th && capas[th] ? html`<img src=${capas[th]} alt="" loading="lazy" />` : html`<div class="sem-foto">${p.nome.slice(0, 2).toUpperCase()}</div>`}
            ${p.formato && html`<span class="tag">${p.formato.toUpperCase()}</span>`}${p.ultima_gravacao && html`<span class="tc">${dataBR(p.ultima_gravacao)}</span>`}</div>
          <div class="meta"><h3>${p.nome}</h3><div class="sub">${[p.cliente, p.local].filter(Boolean).join(' · ') || '—'}</div>
            <div class="specs"><span>${n('camera')} CAM</span><span>${n('luz')} LUZ</span><span>${p.midias.length} FOTOS</span></div></div></a>`;
      })}
      ${!lista.length && projetos.length > 0 && html`<p class="vazio">Nada encontrado para “${busca}”.</p>`}
      <button class="card new-card" onClick=${() => setNovo(true)}><strong>${projetos.length ? 'Novo projeto' : 'Crie o primeiro projeto'}</strong><span>Do zero ou duplicando um set parecido</span></button>
    </div>
    ${novo && html`<${ProjetoForm} projetos=${projetos} onFechar=${() => setNovo(false)} onSalvo=${(p) => { setNovo(false); recarregar(); ir('#/p/' + p.id); }} />`}
  </div>`;
}

// ------------------------------------------------------------------ ficha do projeto
function Projeto({ id, aba, projetos, recarregarLista }) {
  const [d, setD] = useState(null);
  const [editar, setEditar] = useState(false);
  const carregar = async () => {
    try {
      const [p, specs, equip, planta, midias] = await Promise.all([
        q(sb.from('ref_projetos').select('*').eq('id', id).maybeSingle()),
        q(sb.from('ref_specs').select('*').eq('projeto_id', id).order('ordem').order('codigo')),
        q(sb.from('ref_equipamento').select('*').eq('projeto_id', id).order('ordem')),
        q(sb.from('ref_plantas').select('*').eq('projeto_id', id).maybeSingle()),
        q(sb.from('ref_midias').select('*').eq('projeto_id', id).order('criado_em')),
      ]);
      setD(p ? { p, specs, equip, planta: planta || { projeto_id: id, largura_cm: 600, profundidade_cm: 450, itens: [] }, midias } : 'nao');
    } catch (e) { erro(e); }
  };
  useEffect(() => { setD(null); carregar(); }, [id]);
  // marca o projeto como atualizado (ordena a biblioteca)
  const tocar = useDebounce(() => sb.from('ref_projetos').update({ atualizado_em: new Date().toISOString() }).eq('id', id).then(() => recarregarLista()), 1500);
  const patch = (k, v) => { setD((x) => ({ ...x, [k]: typeof v === 'function' ? v(x[k]) : v })); tocar(); };

  if (d === 'nao') return html`<div class="wrap vazio-pg"><p>Projeto não encontrado.</p><a class="btn" href="#/">Voltar à biblioteca</a></div>`;
  if (!d) return html`<div class="wrap vazio-pg">Carregando projeto…</div>`;
  const { p } = d;
  const stills = d.midias.filter((m) => m.tipo === 'still'), bts = d.midias.filter((m) => m.tipo === 'bts');
  const tabs = [['set', 'Set & specs'], ['stills', 'Stills', stills.length], ['bts', 'Behind the scenes', bts.length], ['notas', 'Notas & aprendizados']];
  const tab = tabs.some(([k]) => k === aba) ? aba : 'set';
  const copiarLink = () => navigator.clipboard.writeText(location.href).then(() => toast('Link copiado.'), () => toast('Não foi possível copiar. Copie da barra de endereço.', 'erro'));

  return html`<div class="wrap">
    <div class="crumb"><a href="#/">Biblioteca</a><span>/</span><span>${p.nome}</span></div>
    <div class="p-head"><div><h1>${p.nome}</h1>
      <div class="facts">${[['Cliente', p.cliente], ['Formato', p.formato], ['Local', p.local], ['Última gravação', p.ultima_gravacao && new Date(p.ultima_gravacao + 'T12:00').toLocaleDateString('pt-BR')], ['Diretor de foto', p.diretor_foto]]
        .filter(([, v]) => v).map(([k, v]) => html`<span>${k} <b>${v}</b></span>`)}
        ${(p.tags || []).map((t) => html`<span class="chip">${t}</span>`)}</div></div>
      <div class="p-actions"><button class="btn" onClick=${copiarLink}>Copiar link</button><button class="btn" onClick=${() => setEditar(true)}>Editar dados</button></div></div>
    <nav class="tabs">${tabs.map(([k, n, c]) => html`<a class=${tab === k ? 'on' : ''} href=${`#/p/${id}/${k}`}>${n}${c != null && html`<span class="n">${c}</span>`}</a>`)}</nav>
    ${tab === 'set' && html`<${SetTab} d=${d} patch=${patch} />`}
    ${tab === 'stills' && html`<${Galeria} tipo="still" d=${d} patch=${patch} projeto=${p} setProjeto=${(np) => setD((x) => ({ ...x, p: np }))} />`}
    ${tab === 'bts' && html`<${Galeria} tipo="bts" d=${d} patch=${patch} projeto=${p} setProjeto=${(np) => setD((x) => ({ ...x, p: np }))} />`}
    ${tab === 'notas' && html`<${Notas} p=${p} onSalvo=${(notas) => setD((x) => ({ ...x, p: { ...x.p, notas } }))} />`}
    ${editar && html`<${ProjetoForm} projeto=${p} projetos=${projetos} onFechar=${() => setEditar(false)} onSalvo=${(np) => { setEditar(false); setD((x) => ({ ...x, p: np })); recarregarLista(); }} />`}
  </div>`;
}

function Notas({ p, onSalvo }) {
  const [txt, setTxt] = useState(p.notas || '');
  const [st, setSt] = useState('');
  const salvar = useDebounce(async (v) => {
    setSt('Salvando…');
    if (await acao(() => q(sb.from('ref_projetos').update({ notas: v, atualizado_em: new Date().toISOString() }).eq('id', p.id)))) { setSt('Salvo'); onSalvo(v); } else setSt('Não salvo');
  }, 900);
  return html`<section class="panel notas"><header><h2>Notas & aprendizados</h2><span class="muted sm">${st}</span></header>
    <div class="body"><textarea id="notas" rows="14" value=${txt} placeholder=${'O que deu certo, o que mudar na próxima diária, tempo de montagem, cuidados com a locação…\n\nEx.: Convidado de óculos: subir o L1 uns 20 cm e abrir 15° para tirar o reflexo.'}
      onInput=${(e) => { setTxt(e.target.value); setSt('Editando…'); salvar(e.target.value); }}></textarea></div></section>`;
}

// ------------------------------------------------------------------ app
function App() {
  const [sessao, setSessao] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [recuperar, setRecuperar] = useState(false);
  const [projetos, setProjetos] = useState(null);
  const [busca, setBusca] = useState('');
  const rota = useRota();

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((ev, s) => { if (ev === 'PASSWORD_RECOVERY') setRecuperar(true); setSessao(s); });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!sessao) { setPerfil(null); setProjetos(null); return; }
    q(sb.from('perfis').select('*').eq('id', sessao.user.id).maybeSingle()).then((pf) => setPerfil(pf || { ativo: false, email: sessao.user.email })).catch(erro);
  }, [sessao?.user?.id]);
  const carregarLista = () => q(sb.from('ref_projetos').select(SELECT_LISTA).order('atualizado_em', { ascending: false })).then(setProjetos).catch(erro);
  useEffect(() => { if (perfil?.ativo) carregarLista(); }, [perfil?.ativo]);

  if (sessao === undefined) return html`<div class="boot">Carregando…</div>`;
  if (recuperar) return html`<${NovaSenha} onFim=${() => setRecuperar(false)} />`;
  if (!sessao) return html`<${Login} />`;
  if (!perfil) return html`<div class="boot">Carregando perfil…</div>`;
  if (!perfil.ativo) return html`<div class="login"><div class="panel login-box"><div class="brand big">REF <b>LAB</b></div>
    <p>Sua conta (${perfil.email}) ainda não foi liberada. Peça a um admin para ativar seu acesso no gestor de equipamentos.</p>
    <button class="btn" onClick=${() => sb.auth.signOut()}>Sair</button></div></div>`;

  return html`<${Topo} perfil=${perfil} busca=${busca} setBusca=${setBusca} />
    <main>${!projetos ? html`<div class="wrap vazio-pg">Carregando projetos…</div>`
      : rota[0] === 'p' && rota[1] ? html`<${Projeto} key=${rota[1]} id=${rota[1]} aba=${rota[2]} projetos=${projetos} recarregarLista=${carregarLista} />`
      : html`<${Biblioteca} busca=${busca} projetos=${projetos} recarregar=${carregarLista} />`}</main>`;
}

render(html`<${App} />`, document.getElementById('app'));
