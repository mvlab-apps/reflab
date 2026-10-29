// Núcleo: cliente Supabase, utilitários, fotos e definições de campos
import { html, render, useState, useEffect, useMemo, useRef, useCallback } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
export { html, render, useState, useEffect, useMemo, useRef, useCallback };

const CFG = window.MVLAB_CONFIG || {};
export const GESTOR_URL = CFG.gestorUrl || '';
const URL_SB = (CFG.supabaseUrl || '').trim().replace(/\/(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '');
export const sb = window.supabase.createClient(URL_SB, (CFG.supabaseAnonKey || '').trim());
export const BUCKET = 'ref-midias';

// devolve data ou lança o erro do Supabase
export async function q(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------------ avisos
let toastEl;
export function toast(msg, tipo = '') {
  toastEl?.remove();
  toastEl = document.createElement('div');
  toastEl.className = 'toast ' + tipo;
  toastEl.textContent = msg;
  document.body.append(toastEl);
  const el = toastEl;
  setTimeout(() => el.remove(), tipo === 'erro' ? 5000 : 2400);
}
export function erro(e) {
  console.error(e);
  const m = e?.message || String(e);
  toast(/row-level security|permission/i.test(m) ? 'Sem permissão para isso. Fale com um admin.' : m, 'erro');
}
// roda uma ação mostrando erro; devolve true se deu certo
export async function acao(fn, ok) {
  try { await fn(); if (ok) toast(ok); return true; } catch (e) { erro(e); return false; }
}

// ------------------------------------------------------------------ roteamento por hash: #/ e #/p/<id>/<aba>
export function useRota() {
  const ler = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [r, set] = useState(ler());
  useEffect(() => { const f = () => set(ler()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
export const ir = (h) => { location.hash = h; };

export function useDebounce(fn, ms) {
  const t = useRef(); const f = useRef(fn); f.current = fn;
  useEffect(() => () => clearTimeout(t.current), []);
  return useCallback((...a) => { clearTimeout(t.current); t.current = setTimeout(() => f.current(...a), ms); }, [ms]);
}

export function Modal({ titulo, onFechar, children }) {
  useEffect(() => { const f = (e) => e.key === 'Escape' && onFechar(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);
  return html`<div class="modal-bg" onMouseDown=${(e) => e.target === e.currentTarget && onFechar()}>
    <div class="panel modal" role="dialog" aria-label=${titulo}>
      <header><h2>${titulo}</h2><button type="button" class="btn sm ghost" onClick=${onFechar} aria-label="Fechar">✕</button></header>
      <div class="body">${children}</div></div></div>`;
}

export const dataBR =(d) => d ? new Date(d + (d.length === 10 ? 'T12:00' : '')).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '';
export const hoje = () => new Date().toLocaleDateString('pt-BR');

// ------------------------------------------------------------------ fotos
const urlCache = new Map();
export async function urlsAssinadas(paths) {
  const agora = Date.now();
  const falta = [...new Set(paths.filter((p) => p && !(urlCache.get(p)?.ate > agora)))];
  if (falta.length) {
    const data = await q(sb.storage.from(BUCKET).createSignedUrls(falta, 3600));
    data.forEach((d) => d.signedUrl && urlCache.set(d.path, { url: d.signedUrl, ate: agora + 3500e3 }));
  }
  return Object.fromEntries(paths.filter(Boolean).map((p) => [p, urlCache.get(p)?.url]));
}
export function useUrls(paths) {
  const [m, set] = useState({});
  const chave = paths.join('|');
  useEffect(() => {
    let vivo = true;
    if (paths.length) urlsAssinadas(paths).then((r) => vivo && set(r)).catch(erro);
    return () => { vivo = false; };
  }, [chave]);
  return m;
}

async function redimensionar(file, max, qualidade) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`Não consegui abrir "${file.name}". Envie JPG, PNG ou WebP (HEIC só funciona no Safari).`); }
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', qualidade));
  return { blob, w, h };
}
// redimensiona no navegador (2560 px + miniatura 640 px), envia e registra
export async function enviarFoto(projetoId, tipo, file, meta) {
  const base = `${projetoId}/${tipo}/${crypto.randomUUID()}`;
  const full = await redimensionar(file, 2560, 0.86);
  const th = await redimensionar(file, 640, 0.8);
  await q(sb.storage.from(BUCKET).upload(base + '.jpg', full.blob, { contentType: 'image/jpeg' }));
  await q(sb.storage.from(BUCKET).upload(base + '_t.jpg', th.blob, { contentType: 'image/jpeg' }));
  return q(sb.from('ref_midias').insert({ projeto_id: projetoId, tipo, path: base + '.jpg', thumb_path: base + '_t.jpg', largura: full.w, altura: full.h, ...meta }).select().single());
}
export async function apagarFoto(m) {
  await q(sb.from('ref_midias').delete().eq('id', m.id));
  await sb.storage.from(BUCKET).remove([m.path, m.thumb_path].filter(Boolean));
}

// ------------------------------------------------------------------ campos de câmera e luz
// [chave, rótulo, sugestões]: as sugestões aparecem numa lista, mas qualquer valor é aceito
export const CAM_FIELDS = [
  ['corpo', 'Corpo', ['Sony FX3', 'Sony FX30', 'Sony FX6', 'Sony A7S III', 'Canon C70', 'Blackmagic Pocket 6K', 'Blackmagic Pyxis 6K']],
  ['lente', 'Lente', ['Sony 24-70 f/2.8 GM II', 'Sony 85mm f/1.8', 'Sony 50mm f/1.2 GM', 'Sigma 35mm f/1.4 DG DN', 'Sigma 18-35 f/1.8', 'Canon 70-200 f/2.8']],
  ['focal', 'Focal', ['16mm', '24mm', '35mm', '50mm', '85mm', '135mm']],
  ['iso', 'ISO', ['100', '200', '400', '640', '800', '1600', '3200', '12800']],
  ['iris', 'Íris', ['f/1.4', 'f/1.8', 'f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8']],
  ['shutter', 'Shutter', ['1/48', '1/50', '1/60', '1/100', '1/120', '180°', '172.8°']],
  ['nd', 'ND', ['—', 'ND 0.6', 'ND 1.2', 'ND 1.8', 'ND variável']],
  ['wb', 'White balance', ['3200K', '4300K', '5600K', '6500K']],
  ['tint', 'Tint', ['0', '+5 M', '+10 M', '−5 G', '−10 G']],
  ['fps', 'FPS', ['23.976', '24', '25', '29.97', '59.94', '119.88']],
  ['res', 'Resolução', ['4K UHD', '4K DCI', '6K', '1080p']],
  ['codec', 'Codec', ['XAVC S-I 4:2:2 10-bit', 'XAVC HS 4:2:2 10-bit', 'ProRes 422 HQ', 'BRAW 5:1']],
  ['perfil', 'Perfil', ['S-Log3', 'C-Log2', 'BMD Film Gen5', 'HLG', 'Rec.709']],
  ['lut', 'LUT monitor', ['s709', 'Nenhuma']],
  ['altura', 'Altura', ['1,10 m', '1,20 m', '1,25 m', '1,50 m']],
];
export const LIGHT_FIELDS = [
  ['modelo', 'Modelo', ['Aputure LS 300d II', 'Aputure LS 600d Pro', 'Aputure MC Pro', 'Amaran 200x S', 'Nanlite PavoTube 15C', 'Nanlite Forza 60', 'Floppy preto 4×4']],
  ['int', 'Intensidade', ['10%', '20%', '30%', '50%', '75%', '100%']],
  ['dist', 'Distância', ['0,5 m', '1,0 m', '1,5 m', '1,8 m', '2,0 m', '3,0 m']],
  ['altura', 'Altura', ['1,5 m', '1,8 m', '2,0 m', '2,2 m']],
  ['kelvin', 'Temperatura', ['2700K', '3200K', '4300K', '5600K', 'RGB']],
  ['cor', 'Cor', 'color'],
  ['gel', 'Gel / filtro', ['—', 'CTO 1/4', 'CTO 1/2', 'CTO full', 'CTB 1/4']],
  ['mod', 'Modificador', ['Light Dome II', 'Lantern 90', 'Softbox 90 cm', 'Fresnel', 'Direta', 'Subtrativo']],
  ['dif', 'Difusão', ['—', 'Grid 40°', 'Grid 30°', 'Honeycomb', 'Seda 1/2', 'Full grid cloth']],
  ['angulo', 'Ângulo', ['45° frontal', '90° lateral', 'Contra 135°', 'Rasante', 'Lado de sombra']],
];
export const KIND = {
  camera: { fields: CAM_FIELDS, cls: 'cam', titulo: 'Câmeras', novo: '+ Câmera', badge: (o) => `CAM ${o.codigo}`, skip: ['corpo', 'lente', 'focal'],
    sub: (c) => [c.corpo, c.lente && (c.lente + (c.focal ? ' @ ' + c.focal : ''))].filter(Boolean).join(' · ') },
  luz: { fields: LIGHT_FIELDS, cls: 'lt', titulo: 'Luzes', novo: '+ Luz', badge: (o) => o.codigo, skip: ['modelo', 'cor'], sub: (c) => c.modelo || '' },
};
export const FORMATOS = ['Podcast', 'Entrevista', 'Talking head', 'Palco / evento', 'Produto / tabletop', 'Publicidade', 'Videoclipe'];
export const CATEGORIAS_BTS = ['Montagem', 'Luz', 'Câmera', 'Áudio', 'Cenário', 'Desmontagem'];
