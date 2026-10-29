// Planta do set vista de cima: montador simples em SVG (coordenadas em centímetros)
import { html, useState, useEffect, useRef, toast } from './core.js';

export const novoItemId = () => Math.random().toString(36).slice(2, 10);

// cores literais (não variáveis CSS) para o PNG exportado sair igual à tela
const C = { cam: '#6aa4ff', luz: '#f2c46a', grip: '#9ba1b0', talent: '#b591ff', audio: '#4cc38a', fundo: '#101217', linha: '#1d2029', corpo: '#1b1e26', texto: '#ecedf2', muted: '#9ba1b0', faint: '#6b7182' };
const SHAPES = {
  cam: { grupo: 'Câmeras', nome: 'Câmera', cor: C.cam },
  light: { grupo: 'Luzes', nome: 'Luz aberta', cor: C.luz },
  soft: { grupo: 'Luzes', nome: 'Softbox', cor: C.luz },
  tube: { grupo: 'Luzes', nome: 'Tubo LED', cor: C.luz },
  flag: { grupo: 'Grip', nome: 'Floppy/flag', cor: C.grip },
  stand: { grupo: 'Grip', nome: 'C-stand', cor: C.grip },
  person: { grupo: 'Pessoas', nome: 'Talent', cor: C.talent },
  crew: { grupo: 'Pessoas', nome: 'Equipe', cor: C.muted },
  mic: { grupo: 'Áudio', nome: 'Microfone', cor: C.audio },
  monitor: { grupo: 'Cenário', nome: 'Monitor / TP', cor: C.grip },
  table: { grupo: 'Cenário', nome: 'Mesa', cor: C.grip },
  chair: { grupo: 'Cenário', nome: 'Cadeira', cor: C.grip },
  wall: { grupo: 'Cenário', nome: 'Parede/fundo', cor: C.grip },
};
const LUZES = ['light', 'soft', 'tube'];
const dentroSemRotacao = (t) => t === 'table' || t === 'wall';

function glyph(t, ativo, it) {
  const c = SHAPES[t].cor, s = ativo ? C.texto : c;
  switch (t) {
    case 'cam': return html`<path d="M0 -26 L-22 -70 L22 -70 Z" fill=${c} opacity=".12" /><rect x="-11" y="-8" width="22" height="18" rx="3" fill=${C.corpo} stroke=${s} stroke-width="2" /><rect x="-6" y="-16" width="12" height="9" rx="1.5" fill=${c} />`;
    case 'light': return html`<path d="M0 -10 L-30 -90 L30 -90 Z" fill=${c} opacity=".13" /><circle r="10" fill=${C.corpo} stroke=${s} stroke-width="2" /><path d="M-6 -9 h12" stroke=${c} stroke-width="3" />`;
    case 'soft': return html`<path d="M-20 -6 L-48 -100 L48 -100 L20 -6 Z" fill=${c} opacity=".11" /><rect x="-22" y="-8" width="44" height="12" rx="2" fill=${C.corpo} stroke=${s} stroke-width="2" /><rect x="-20" y="-8" width="40" height="4" fill=${c} />`;
    case 'tube': return html`<rect x="-30" y="-3" width="60" height="6" rx="3" fill=${c} stroke=${ativo ? s : 'none'} />`;
    case 'flag': return html`<rect x="-26" y="-3" width="52" height="6" fill="#0c0d11" stroke=${s} stroke-width="2" />`;
    case 'stand': return html`<path d="M0 0 L-12 10 M0 0 L12 10 M0 0 L0 -13" stroke=${s} stroke-width="2.5" fill="none" /><circle r="3" fill=${c} />`;
    case 'person': return html`<ellipse rx="16" ry="11" fill=${C.corpo} stroke=${s} stroke-width="2" /><circle cy="-2" r="7" fill=${c} /><path d="M0 -12 l-4 -6 h8 z" fill=${c} />`;
    case 'crew': return html`<ellipse rx="13" ry="9" fill=${C.corpo} stroke=${s} stroke-width="1.5" stroke-dasharray="3 2" /><circle cy="-1" r="5" fill=${c} />`;
    case 'mic': return html`<rect x="-4" y="-9" width="8" height="14" rx="4" fill=${c} stroke=${ativo ? s : 'none'} />`;
    case 'monitor': return html`<rect x="-16" y="-4" width="32" height="8" rx="1.5" fill=${C.corpo} stroke=${s} stroke-width="2" /><path d="M-12 -4 h24" stroke=${C.cam} stroke-width="2" />`;
    case 'table': return html`<circle r=${it?.w ? it.w / 2 : 60} fill=${C.corpo} stroke=${s} stroke-width="2" />`;
    case 'chair': return html`<rect x="-11" y="-9" width="22" height="20" rx="4" fill=${C.corpo} stroke=${s} stroke-width="1.5" /><rect x="-11" y="7" width="22" height="5" rx="2" fill=${c} />`;
    case 'wall': return html`<rect x=${-(it?.w || 200) / 2} y="-8" width=${it?.w || 200} height="16" fill="#2a2f3b" stroke=${ativo ? C.texto : '#3a4050'} stroke-width="1.5" />`;
  }
}

export function Planta({ planta, specs, onChange, foco, setFoco, estado }) {
  const W = planta.largura_cm, H = planta.profundidade_cm;
  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(null); // {id, x, y} enquanto arrasta
  const svg = useRef();
  const itens = planta.itens.map((i) => (drag?.id === i.id ? { ...i, x: drag.x, y: drag.y } : i));
  const atual = itens.find((i) => i.id === sel);
  const mudar = (fn) => onChange((pl) => ({ ...pl, itens: fn(pl.itens) }));
  const mudarItem = (id, p) => mudar((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));

  // card de spec em foco → seleciona o item ligado
  useEffect(() => { if (foco) { const it = planta.itens.find((i) => i.spec === foco); if (it) setSel(it.id); } }, [foco]);
  useEffect(() => {
    const f = (e) => {
      if (!sel || e.target.closest?.('input, textarea, select') || document.querySelector('.modal-bg, .lb')) return;
      const it = planta.itens.find((i) => i.id === sel); if (!it) return;
      if (e.key === 'q' || e.key === 'Q') girar(-15);
      else if (e.key === 'e' || e.key === 'E') girar(15);
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); excluir(); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault(); const d = e.shiftKey ? 25 : 5;
        mudarItem(sel, { x: it.x + (e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0), y: it.y + (e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0) });
      }
    };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  });

  const pt = (e) => { const p = svg.current.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.current.getScreenCTM().inverse()); };
  const iniciar = (e, it) => {
    e.stopPropagation(); setSel(it.id); if (it.spec) setFoco(it.spec);
    const p0 = pt(e), ox = it.x, oy = it.y; let ult = { x: ox, y: oy };
    const mover = (ev) => { const p = pt(ev); ult = { x: Math.round(Math.max(0, Math.min(W, ox + p.x - p0.x)) / 5) * 5, y: Math.round(Math.max(0, Math.min(H, oy + p.y - p0.y)) / 5) * 5 }; setDrag({ id: it.id, ...ult }); };
    const soltar = () => { removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); setDrag(null); if (ult.x !== ox || ult.y !== oy) mudarItem(it.id, ult); };
    addEventListener('pointermove', mover); addEventListener('pointerup', soltar);
  };
  const girar = (d) => atual && mudarItem(atual.id, { r: ((atual.r + d + 540) % 360) - 180 });
  const excluir = () => { if (!atual) return; mudar((l) => l.filter((i) => i.id !== atual.id)); setSel(null); };
  const duplicar = () => { if (!atual) return; const id = novoItemId(); mudar((l) => [...l, { ...atual, id, x: Math.min(W, atual.x + 30), y: Math.min(H, atual.y + 30), spec: undefined }]); setSel(id); };
  const adicionar = (t) => {
    const n = planta.itens.filter((i) => i.t === t).length + 1;
    const label = t === 'cam' ? `Cam ${n}` : LUZES.includes(t) ? `Luz ${planta.itens.filter((i) => LUZES.includes(i.t)).length + 1}` : `${SHAPES[t].nome} ${n}`;
    const id = novoItemId();
    mudar((l) => [...l, { id, t, x: Math.round(W / 2), y: Math.round(H / 2), r: 0, label, ...(t === 'wall' ? { w: 200 } : t === 'table' ? { w: 120 } : {}) }]);
    setSel(id);
  };
  const exportar = async () => {
    try {
      const clone = svg.current.cloneNode(true);
      clone.querySelectorAll('.ring').forEach((n) => n.remove());
      clone.setAttribute('width', W * 2); clone.setAttribute('height', H * 2);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a'); a.download = 'planta-do-set.png'; a.href = c.toDataURL('image/png'); a.click();
    } catch (e) { toast('Não foi possível exportar a imagem.', 'erro'); }
  };
  const tamanho = (k) => (e) => { const v = Math.round(parseFloat(String(e.target.value).replace(',', '.')) * 100); if (v >= 200 && v <= 5000) onChange((pl) => ({ ...pl, [k]: v })); };

  const linhas = [];
  for (let x = 0; x <= W; x += 50) linhas.push(html`<line x1=${x} y1="0" x2=${x} y2=${H} stroke=${C.linha} stroke-width=${x % 100 ? 0.6 : 1} />`);
  for (let y = 0; y <= H; y += 50) linhas.push(html`<line x1="0" y1=${y} x2=${W} y2=${y} stroke=${C.linha} stroke-width=${y % 100 ? 0.6 : 1} />`);
  const ordem = [...itens].sort((a, b) => (dentroSemRotacao(b.t) ? 1 : 0) - (dentroSemRotacao(a.t) ? 1 : 0));
  const grupos = {}; Object.entries(SHAPES).forEach(([k, v]) => (grupos[v.grupo] ||= []).push([k, v]));
  const specDe = (it) => it?.spec && specs.find((s) => s.codigo === it.spec && (it.t === 'cam' ? s.tipo === 'camera' : s.tipo === 'luz'));

  return html`<section class="panel planta"><header><h2>Planta do set</h2><span class="chip">vista de cima · ${(W / 100).toLocaleString('pt-BR')} × ${(H / 100).toLocaleString('pt-BR')} m</span><span class="muted sm estado">${estado}</span></header>
    <div class="dg">
      <div class="palette">${Object.entries(grupos).map(([g, arr]) => html`<span class="label">${g}</span>${arr.map(([k, v]) => html`<button onClick=${() => adicionar(k)} title=${'Adicionar ' + v.nome}>
        <svg width="22" height="22" viewBox="-36 -36 72 72"><g transform=${['cam', 'light', 'soft'].includes(k) ? 'translate(0 22) scale(.55)' : k === 'table' ? 'scale(.45)' : k === 'wall' ? 'scale(.3)' : 'scale(.8)'}>${glyph(k, false)}</g></svg>${v.nome}</button>`)}`)}</div>
      <div class="canvas-wrap">
        <div class="tools">
          <button class="btn sm" onClick=${() => girar(-15)} disabled=${!atual} title="Girar −15° (Q)">⟲ 15°</button><button class="btn sm" onClick=${() => girar(15)} disabled=${!atual} title="Girar +15° (E)">⟳ 15°</button>
          <button class="btn sm" onClick=${duplicar} disabled=${!atual}>Duplicar</button><button class="btn sm" onClick=${excluir} disabled=${!atual}>Excluir</button>
          <span class="sep"></span><button class="btn sm" onClick=${exportar}>Exportar PNG</button>
          <span class="hint">Arraste para mover · Q/E giram · setas ajustam</span></div>
        <svg class="stage" ref=${svg} viewBox=${`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" aria-label="Planta do set vista de cima" onPointerDown=${() => setSel(null)}>
          <rect width=${W} height=${H} fill=${C.fundo} />${linhas}
          <g font-family="IBM Plex Mono, monospace" font-size="9" fill=${C.faint}><line x1=${W - 110} y1=${H - 14} x2=${W - 10} y2=${H - 14} stroke=${C.faint} /><line x1=${W - 110} y1=${H - 18} x2=${W - 110} y2=${H - 10} stroke=${C.faint} /><line x1=${W - 10} y1=${H - 18} x2=${W - 10} y2=${H - 10} stroke=${C.faint} /><text x=${W - 60} y=${H - 20} text-anchor="middle">1 m</text></g>
          ${ordem.map((it) => {
            const on = it.id === sel, id = it.t === 'cam' || it.spec, dy = it.t === 'table' || it.t === 'wall' ? -6 : 14;
            return html`<g class="item" key=${it.id} transform=${`translate(${it.x} ${it.y}) rotate(${it.r})`} onPointerDown=${(e) => iniciar(e, it)}>
              ${on && !dentroSemRotacao(it.t) && html`<circle class="ring" r=${it.t === 'tube' ? 34 : 24} fill="none" stroke="#e7b553" stroke-dasharray="3 3" />`}
              ${glyph(it.t, on, it)}
              <g transform=${`rotate(${-it.r})`}>${id
                ? html`<rect x="-15" y=${dy} width="30" height="15" rx="3" fill=${it.t === 'cam' ? C.cam : it.t === 'flag' ? C.faint : '#e7b553'} /><text y=${dy + 11} text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="10" fill="#0c0d11">${it.label}</text>`
                : html`<text y=${dentroSemRotacao(it.t) ? 4 : 26} text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="10" fill=${on ? C.texto : C.muted}>${it.label}</text>`}</g></g>`;
          })}
        </svg>
        <div class="inspector">${atual ? html`
          <label class="field"><span class="label">Etiqueta</span><input id="pl-label" value=${atual.label} onInput=${(e) => mudarItem(atual.id, { label: e.target.value })} style="width:150px" /></label>
          <label class="field"><span class="label">Ângulo ${atual.r}°</span><input type="range" min="-180" max="180" step="5" value=${atual.r} onInput=${(e) => mudarItem(atual.id, { r: +e.target.value })} style="width:130px" /></label>
          ${(atual.t === 'wall' || atual.t === 'table') && html`<label class="field"><span class="label">${atual.t === 'wall' ? 'Largura' : 'Diâmetro'} (cm)</span><input type="number" min="20" max="2000" step="10" value=${atual.w} onInput=${(e) => +e.target.value >= 20 && mudarItem(atual.id, { w: +e.target.value })} style="width:90px" /></label>`}
          <div class="field"><span class="label">Posição</span><span class="mono">${(atual.x / 100).toFixed(2)} × ${(atual.y / 100).toFixed(2)} m</span></div>
          <div class="field grow"><span class="label">${atual.spec ? 'Ligado à spec' : 'Tipo'}</span><span class="muted">${specDe(atual) ? `${specDe(atual).codigo} · ${specDe(atual).nome}` : atual.spec ? `${atual.spec} (spec removida)` : SHAPES[atual.t].nome}</span></div>`
          : html`<span class="empty">Clique num item para editar etiqueta e ângulo. Câmeras e luzes criadas nas specs entram aqui ligadas ao card.</span>
            <label class="field room"><span class="label">Sala (m)</span><span class="room-in"><input aria-label="Largura da sala em metros" value=${(W / 100).toString().replace('.', ',')} onChange=${tamanho('largura_cm')} /> × <input aria-label="Profundidade da sala em metros" value=${(H / 100).toString().replace('.', ',')} onChange=${tamanho('profundidade_cm')} /></span></label>`}</div>
      </div></div></section>`;
}
