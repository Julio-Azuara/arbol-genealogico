/* Árbol genealógico · Familia Azuara · Hernández de la Cajiga
 *
 * Lee la familia desde el JSON (body[data-datos]) al cargar la página,
 * así que cualquier corrección al JSON aparece sin tocar este archivo.
 *
 * Fotos (solo en la versión con fotos): guarda la imagen en la carpeta
 * fotos/ con el id de la persona, por ejemplo fotos/julio-cesar-izquierdo-azuara.jpg.
 * Abre la página con ?editar al final de la dirección para ver el id de cada persona.
 */
(() => {
  'use strict';

  const body = document.body;
  const FOTOS = body.dataset.modo === 'fotos';
  const DATA_URL = body.dataset.datos || '../datos/familia.json';
  const CARPETA_FOTOS = body.dataset.fotos || 'fotos/';
  const EDITAR = new URLSearchParams(location.search).has('editar');
  const RAMA_A = 'Azuara';
  const RAMA_H = 'Hernández de la Cajiga';

  const T = FOTOS
    ? { W: 244, H: 64, gap: 8, sangria: 22, col: 96, sib: 16, entreArboles: 90, foto: 23 }
    : { W: 218, H: 48, gap: 6, sangria: 18, col: 84, sib: 10, entreArboles: 70, foto: 0 };
  const GRUPO_H = 46;
  const GRUPO_W = 200;

  /* ───────── utilidades ───────── */
  const $ = (sel, el = document) => el.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const normal = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const PARTICULAS = new Set(['de', 'la', 'las', 'del', 'los', 'y']);
  function partirNombre(completo) {
    const w = completo.trim().split(/\s+/);
    if (w.length === 1) return { pila: w[0], apellidos: '' };
    let i = w.length, grupos = 0;
    while (i > 1 && grupos < 2) {
      i--;
      while (i > 1 && PARTICULAS.has(w[i - 1].toLowerCase())) i--;
      grupos++;
    }
    return { pila: w.slice(0, i).join(' '), apellidos: w.slice(i).join(' ') };
  }
  const iniciales = nombre => {
    const { pila, apellidos } = partirNombre(nombre);
    const a = apellidos.split(' ').find(x => !PARTICULAS.has(x.toLowerCase()));
    return (pila[0] + (a ? a[0] : (pila.split(' ')[1] || '')[0] || '')).toUpperCase();
  };
  const claseRama = r => (r === RAMA_H ? 'hernandez' : r === RAMA_A ? 'azuara' : 'azuara');
  const nombreCorto = nombre => partirNombre(nombre).pila;
  const almacen = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  };
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esCelular = () => innerWidth <= 820;

  /* ───────── datos ───────── */
  let D;
  const P = new Map();
  const U = new Map();
  const unionesDe = new Map();
  const fotos = new Map();

  function prepararDatos(json) {
    D = json;
    for (const p of D.personas) P.set(p.id, p);
    for (const u of D.uniones) {
      U.set(u.id, u);
      for (const id of u.pareja) {
        if (!unionesDe.has(id)) unionesDe.set(id, []);
        unionesDe.get(id).push(u);
      }
    }
    // Uniones con hijos primero, para que las ramas importantes queden arriba.
    for (const lista of unionesDe.values()) lista.sort((a, b) => (b.hijos.length > 0) - (a.hijos.length > 0));
  }

  const tienePadres = id => !!(P.get(id) && P.get(id).union_padres && U.has(P.get(id).union_padres));
  const ramaDe = id => {
    const r = P.get(id) && P.get(id).rama;
    return r === RAMA_H ? RAMA_H : RAMA_A;
  };
  function padresDe(id) {
    const p = P.get(id);
    if (!p || !p.union_padres || !U.has(p.union_padres)) return [];
    return U.get(p.union_padres).pareja.filter(x => P.has(x));
  }
  function hermanosDe(id) {
    const p = P.get(id);
    if (!p || !p.union_padres || !U.has(p.union_padres)) return [];
    return U.get(p.union_padres).hijos.filter(x => x !== id && P.has(x));
  }
  const parejasDe = id => (unionesDe.get(id) || []).map(u => u.pareja.find(x => x !== id)).filter(x => x && P.has(x));
  const hijosDe = id => [...new Set((unionesDe.get(id) || []).flatMap(u => u.hijos))].filter(x => P.has(x));

  function linaje(id) {
    const s = new Set([id]);
    const subir = x => padresDe(x).forEach(p => { if (!s.has(p)) { s.add(p); subir(p); } });
    const bajar = x => hijosDe(x).forEach(c => { if (!s.has(c)) { s.add(c); bajar(c); } });
    subir(id); bajar(id);
    parejasDe(id).forEach(x => s.add(x));
    return s;
  }

  function generaciones() {
    const memo = new Map();
    const g = id => {
      if (memo.has(id)) return memo.get(id);
      memo.set(id, 1);
      const ps = padresDe(id);
      const v = ps.length ? 1 + Math.max(...ps.map(g)) : 1;
      memo.set(id, v);
      return v;
    };
    let max = 1;
    for (const id of P.keys()) max = Math.max(max, g(id));
    return max;
  }

  /* ───────── bosque: personas de sangre con sus parejas, hijos colgando de cada unión ───────── */
  let raices = [];
  const nodoDe = new Map();
  let seccionesInfo = [];

  function construirBosque() {
    const colocados = new Set();
    const unionesHechas = new Set();
    const nodos = new Set();

    function unidad(id, prof, padre) {
      colocados.add(id);
      const n = { tipo: 'unidad', key: 'p:' + id, id, prof, padre, uniones: [] };
      nodoDe.set(id, n);
      for (const u of unionesDe.get(id) || []) {
        const pareja = u.pareja.find(x => x !== id && P.has(x)) || null;
        const e = { uid: u.id, pareja, hijos: [], fantasma: false, cerrado: false, nodo: n };
        if (unionesHechas.has(u.id)) {
          e.fantasma = u.hijos.length > 0;
        } else {
          unionesHechas.add(u.id);
          for (const c of u.hijos) if (P.has(c) && !colocados.has(c)) e.hijos.push(unidad(c, prof + 1, e));
        }
        n.uniones.push(e);
      }
      nodos.add(n);
      return n;
    }
    function grupo(u) {
      unionesHechas.add(u.id);
      const n = { tipo: 'grupo', key: 'g:' + u.id, uid: u.id, prof: 0, padre: null, uniones: [] };
      const e = { uid: u.id, pareja: null, hijos: [], fantasma: false, cerrado: false, nodo: n };
      n.uniones.push(e);
      for (const c of u.hijos) if (P.has(c) && !colocados.has(c)) e.hijos.push(unidad(c, 1, e));
      const primero = u.hijos.find(x => P.has(x));
      n.etiqueta = primero ? 'Familia ' + partirNombre(P.get(primero).nombre).apellidos : 'Familia';
      n.rama = primero ? ramaDe(primero) : RAMA_A;
      return n;
    }

    // Tamaño de la descendencia de cada unión, para empezar por las familias grandes.
    const memo = new Map();
    const descend = uid => {
      if (memo.has(uid)) return memo.get(uid);
      memo.set(uid, 0);
      const s = new Set();
      const ir = id => { if (s.has(id)) return; s.add(id); for (const u of unionesDe.get(id) || []) u.hijos.forEach(ir); };
      U.get(uid).hijos.forEach(ir);
      memo.set(uid, s.size);
      return s.size;
    };
    const candidatas = D.uniones
      .filter(u => u.pareja.length === 0 ? u.hijos.length : u.pareja.every(x => !tienePadres(x)))
      .sort((a, b) => descend(b.id) - descend(a.id));

    raices = [];
    for (const u of candidatas) {
      if (u.pareja.length === 0) { raices.push(grupo(u)); continue; }
      if (unionesHechas.has(u.id)) continue;
      // Empieza por quien tenga más uniones para no partir a la familia.
      const quien = [...u.pareja].filter(x => P.has(x)).sort((a, b) => (unionesDe.get(b) || []).length - (unionesDe.get(a) || []).length)[0];
      if (!quien || colocados.has(quien)) continue;
      const r = unidad(quien, 0, null);
      r.rama = ramaDe(quien);
      raices.push(r);
    }
    // Lo que haya quedado suelto.
    const enAlgunLado = new Set(colocados);
    for (const u of D.uniones) if (unionesHechas.has(u.id)) u.pareja.forEach(x => enAlgunLado.add(x));
    for (const p of D.personas) {
      if (enAlgunLado.has(p.id)) continue;
      const r = unidad(p.id, 0, null);
      r.rama = ramaDe(p.id);
      raices.push(r);
      for (const u of unionesDe.get(p.id) || []) u.pareja.forEach(x => enAlgunLado.add(x));
      colocados.forEach(x => enAlgunLado.add(x));
    }
    for (const r of raices) if (!r.rama) r.rama = RAMA_A;
  }

  /* ───────── acomodo (de izquierda a derecha: cada columna es una generación) ───────── */
  const tarjetasDe = n => (n.tipo === 'grupo' ? 0 : 1 + n.uniones.filter(e => e.pareja).length);
  const altoBloque = n => (n.tipo === 'grupo' ? GRUPO_H : tarjetasDe(n) * T.H + (tarjetasDe(n) - 1) * T.gap);
  const anchoBloque = n => (n.tipo === 'grupo' ? GRUPO_W : T.W);
  const hijosVisibles = n => n.uniones.flatMap(e => (e.cerrado ? [] : e.hijos));

  function medir(n) {
    const bh = altoBloque(n);
    const hs = hijosVisibles(n);
    hs.forEach(medir);
    let cursor = 0;
    for (const c of hs) { c._rel = cursor; cursor += c._H + T.sib; }
    const tramo = hs.length ? cursor - T.sib : 0;
    let arriba = 0, desplazar = 0;
    if (hs.length) {
      const centro = c => c._rel + c._arriba + T.H / 2;
      arriba = (centro(hs[0]) + centro(hs[hs.length - 1])) / 2 - bh / 2;
      if (arriba < 0) { desplazar = -arriba; arriba = 0; }
    }
    hs.forEach(c => { c._rel += desplazar; });
    n._arriba = arriba;
    n._H = Math.max(arriba + bh, tramo + desplazar);
  }
  function colocar(n, x, y0) {
    n.x = x;
    n.y = y0 + n._arriba;
    const xh = x + anchoBloque(n) + T.col;
    hijosVisibles(n).forEach(c => colocar(c, xh, y0 + c._rel));
  }
  const profundidad = n => 1 + Math.max(0, ...hijosVisibles(n).map(profundidad));

  let limites = { x0: 0, y0: 0, x1: 1, y1: 1 };
  function acomodar() {
    const secciones = [
      { rama: RAMA_A, clase: 'azuara', raices: raices.filter(r => r.rama !== RAMA_H) },
      { rama: RAMA_H, clase: 'hernandez', raices: raices.filter(r => r.rama === RAMA_H) },
    ];
    let x0 = 0;
    seccionesInfo = [];
    for (const s of secciones) {
      let y = 0, ancho = 0;
      for (const r of s.raices) {
        medir(r);
        const dx = r.tipo === 'grupo' ? 0 : 0;
        colocar(r, x0 + dx, y);
        y += r._H + T.entreArboles;
        ancho = Math.max(ancho, profundidad(r) * (T.W + T.col));
      }
      const personas = D.personas.filter(p => (s.rama === RAMA_H ? p.rama === RAMA_H : p.rama !== RAMA_H)).length;
      seccionesInfo.push({ ...s, x: x0, y: -150, ancho, alto: y, personas });
      x0 += ancho + 260;
    }
  }

  /* Recolecta lo que se dibuja. */
  function recolectar() {
    const tarjetas = [], nudos = [], enlaces = [], lazos = [], grupos = [];
    const visitar = n => {
      if (n.tipo === 'grupo') {
        grupos.push({ key: n.key, x: n.x, y: n.y, n });
      } else {
        tarjetas.push({ key: 'p:' + n.id, id: n.id, x: n.x, y: n.y, w: T.W, sangre: true, n, prof: n.prof });
      }
      let fila = 0;
      for (const e of n.uniones) {
        let ky;
        let kx;
        if (n.tipo === 'grupo') {
          kx = n.x + GRUPO_W; ky = n.y + GRUPO_H / 2;
        } else if (e.pareja) {
          fila++;
          const py = n.y + fila * (T.H + T.gap);
          tarjetas.push({ key: 'q:' + n.id + ':' + e.uid, id: e.pareja, x: n.x + T.sangria, y: py, w: T.W - T.sangria, sangre: false, n, prof: n.prof });
          lazos.push({ key: 'z:' + n.id + ':' + e.uid, x: n.x + 9, y1: n.y + T.H, y2: py + T.H / 2, x2: n.x + T.sangria, a: n.id, b: e.pareja });
          kx = n.x + T.W; ky = py + T.H / 2;
        } else {
          kx = n.x + T.W; ky = n.y + T.H / 2;
        }
        e._kx = kx; e._ky = ky;
        const total = e.hijos.length;
        if (total || e.fantasma) nudos.push({ key: 'k:' + n.key + ':' + e.uid, x: kx, y: ky, e, total });
        if (!e.cerrado) {
          for (const c of e.hijos) {
            enlaces.push({
              key: 'l:' + e.uid + ':' + c.id, x1: kx, y1: ky, x2: c.x, y2: c.y + T.H / 2,
              hijo: c.id, padres: U.get(e.uid) ? U.get(e.uid).pareja : [], prof: c.prof, e,
            });
            visitar(c);
          }
        }
      }
    };
    raices.forEach(visitar);

    // Personas que aparecen más de una vez (por ejemplo, matrimonios entre ramas): hilo dorado.
    const porId = new Map();
    for (const t of tarjetas) { if (!porId.has(t.id)) porId.set(t.id, []); porId.get(t.id).push(t); }
    const puentes = [];
    for (const [id, ts] of porId) {
      if (ts.length < 2) continue;
      const base = ts.find(t => t.sangre) || ts[0];
      for (const t of ts) {
        if (t === base) continue;
        puentes.push({ key: 'b:' + t.key, id, a: base, b: t, principal: D.raices_union && D.raices_union.includes(id) });
      }
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of tarjetas.concat(grupos)) {
      x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y);
      x1 = Math.max(x1, t.x + (t.w || GRUPO_W)); y1 = Math.max(y1, t.y + T.H);
    }
    limites = { x0, y0: Math.min(y0, -170), x1, y1 };
    return { tarjetas, nudos, enlaces, lazos, grupos, puentes, porId };
  }

  /* ───────── dibujo ───────── */
  let svg, mundo, capas, zoom, transformacion = d3.zoomIdentity, actual = null, primeraVez = true;
  let seleccion = null;
  let tarjetaPrincipal = new Map();

  const curva = (x1, y1, x2, y2) => {
    const m = x1 + (x2 - x1) * 0.55;
    return `M${x1},${y1} C${m},${y1} ${x1 + (x2 - x1) * 0.45},${y2} ${x2},${y2}`;
  };
  const curvaPuente = (a, b) => {
    const ax = a.x + a.w / 2, ay = a.y + T.H / 2, bx = b.x + b.w / 2, by = b.y + T.H / 2;
    const dx = bx - ax, dy = by - ay;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(420, d * 0.28);
    const cx = (ax + bx) / 2 - (dy / d) * k, cy = (ay + by) / 2 + (dx / d) * k * 0.4 - k * 0.6;
    return `M${ax},${ay} Q${cx},${cy} ${bx},${by}`;
  };

  function montarSvg(contenedor) {
    svg = d3.select(contenedor).append('svg').attr('id', 'lienzo').attr('role', 'img').attr('aria-label', 'Árbol genealógico');
    const defs = svg.append('defs');
    if (FOTOS) {
      defs.append('clipPath').attr('id', 'recorte-foto').append('circle').attr('cx', 12 + T.foto).attr('cy', T.H / 2).attr('r', T.foto);
      defs.append('clipPath').attr('id', 'recorte-foto-p').append('circle').attr('cx', 10 + T.foto - 3).attr('cy', T.H / 2).attr('r', T.foto - 3);
    }
    mundo = svg.append('g').attr('class', 'mundo');
    capas = {
      cabeceras: mundo.append('g'),
      puentes: mundo.append('g'),
      enlaces: mundo.append('g'),
      lazos: mundo.append('g'),
      grupos: mundo.append('g'),
      tarjetas: mundo.append('g'),
      nudos: mundo.append('g'),
    };
    zoom = d3.zoom()
      .scaleExtent([0.05, 2.4])
      .on('zoom', ev => {
        transformacion = ev.transform;
        mundo.attr('transform', ev.transform);
        svg.classed('lejos', ev.transform.k < 0.38);
        dibujarMinimapa();
      });
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', ev => { if (ev.target === svg.node()) cerrarFicha(); });
  }

  function cabeceras() {
    const sel = capas.cabeceras.selectAll('g.cabecera-rama').data(seccionesInfo, d => d.rama);
    const en = sel.enter().append('g').attr('class', d => 'cabecera-rama ' + d.clase);
    en.append('line').attr('class', 'regla');
    en.append('text').attr('class', 'titulo');
    en.append('text').attr('class', 'sub');
    const todo = en.merge(sel).attr('transform', d => `translate(${d.x},${d.y})`);
    todo.select('.regla').attr('x1', 0).attr('x2', 56).attr('y1', 0).attr('y2', 0);
    todo.select('.titulo').attr('y', 64).html(d => d.rama === RAMA_A
      ? 'Rama <tspan class="cursiva">Azuara</tspan>'
      : 'Rama <tspan class="cursiva">Hernández de la Cajiga</tspan>');
    todo.select('.sub').attr('y', 98).text(d => `${d.personas} personas`);
  }

  function dibujar(opciones = {}) {
    acomodar();
    const datos = recolectar();
    actual = datos;
    tarjetaPrincipal = new Map();
    for (const t of datos.tarjetas) if (t.sangre || !tarjetaPrincipal.has(t.id)) tarjetaPrincipal.set(t.id, t);
    cabeceras();

    const inicial = primeraVez && !reducirMovimiento && !opciones.sinAnimar;
    const dur = reducirMovimiento ? 0 : 650;
    const tr = d3.transition().duration(dur).ease(d3.easeCubicInOut);
    const retardo = d => (inicial ? 500 + d.prof * 260 + Math.min(240, ((d.y != null ? d.y : d.y2) - limites.y0) * 0.02) : 0);
    const origen = opciones.origen; // nudo desde el que salen (o al que regresan) los hijos

    /* enlaces */
    const en = capas.enlaces.selectAll('path.enlace').data(datos.enlaces, d => d.key);
    en.exit().transition(tr).attr('d', d => {
      const o = origen || { x: d.x1, y: d.y1 };
      return curva(o.x, o.y, o.x, o.y);
    }).style('opacity', 0).remove();
    const enE = en.enter().append('path').attr('class', 'enlace');
    if (inicial) {
      enE.attr('d', d => curva(d.x1, d.y1, d.x2, d.y2))
        .each(function () { const L = this.getTotalLength(); this.style.strokeDasharray = L; this.style.strokeDashoffset = L; })
        .transition().delay(d => retardo(d) - 160).duration(700).ease(d3.easeCubicOut)
        .style('stroke-dashoffset', 0)
        .on('end', function () { this.style.strokeDasharray = null; this.style.strokeDashoffset = null; });
    } else {
      enE.attr('d', d => { const o = origen || { x: d.x1, y: d.y1 }; return curva(o.x, o.y, o.x, o.y); })
        .transition(tr).attr('d', d => curva(d.x1, d.y1, d.x2, d.y2));
    }
    en.transition(tr).attr('d', d => curva(d.x1, d.y1, d.x2, d.y2));

    /* lazos de pareja */
    const lz = capas.lazos.selectAll('path.lazo').data(datos.lazos, d => d.key);
    lz.exit().transition(tr).style('opacity', 0).remove();
    const camLazo = d => `M${d.x},${d.y1} V${d.y2 - 6} Q${d.x},${d.y2} ${d.x + 6},${d.y2} H${d.x2}`;
    lz.enter().append('path').attr('class', 'lazo').attr('d', camLazo).style('opacity', 0)
      .transition().delay(d => (inicial ? 600 : 0)).duration(dur).style('opacity', null);
    lz.transition(tr).attr('d', camLazo);

    /* grupos (hermanos sin padres registrados) */
    const gr = capas.grupos.selectAll('g.grupo').data(datos.grupos, d => d.key);
    gr.exit().remove();
    const grE = gr.enter().append('g').attr('class', 'grupo').attr('transform', d => `translate(${d.x},${d.y})`).style('opacity', 0);
    grE.append('rect').attr('class', 'fondo').attr('width', GRUPO_W).attr('height', GRUPO_H).attr('rx', GRUPO_H / 2);
    grE.append('text').attr('x', 18).attr('y', 20).text(d => d.n.etiqueta);
    grE.append('text').attr('class', 'nota').attr('x', 18).attr('y', 35).text('padres sin registrar');
    grE.transition().delay(inicial ? 400 : 0).duration(dur).style('opacity', 1);
    gr.transition(tr).attr('transform', d => `translate(${d.x},${d.y})`);

    /* tarjetas */
    const ta = capas.tarjetas.selectAll('g.tarjeta').data(datos.tarjetas, d => d.key);
    ta.exit().transition(tr)
      .attr('transform', d => { const o = origen || d; return `translate(${o.x - 20},${o.y - T.H / 2}) scale(.6)`; })
      .style('opacity', 0).remove();
    const taE = ta.enter().append('g')
      .attr('class', d => `tarjeta ${d.sangre ? '' : 'pareja'} ${claseRama(P.get(d.id).rama)}`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => P.get(d.id).nombre);
    construirTarjeta(taE);
    if (inicial) {
      taE.attr('transform', d => `translate(${d.x - 18},${d.y})`).style('opacity', 0)
        .transition().delay(d => retardo(d)).duration(700).ease(d3.easeCubicOut)
        .attr('transform', d => `translate(${d.x},${d.y})`).style('opacity', null);
    } else {
      taE.attr('transform', d => { const o = origen || d; return `translate(${o.x - 20},${o.y - T.H / 2}) scale(.6)`; })
        .style('opacity', 0)
        .transition(tr).attr('transform', d => `translate(${d.x},${d.y})`).style('opacity', null);
    }
    ta.transition(tr).attr('transform', d => `translate(${d.x},${d.y})`);
    taE.on('click', (ev, d) => { ev.stopPropagation(); elegir(d.id, { volar: false, tarjeta: d }); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elegir(d.id, { volar: true }); } })
      .on('mouseenter', (ev, d) => { if (!esCelular()) resaltar(d.id); })
      .on('mouseleave', () => { if (!esCelular()) resaltar(seleccion); });

    /* nudos (para plegar o desplegar descendencia) */
    const nu = capas.nudos.selectAll('g.nudo').data(datos.nudos, d => d.key);
    nu.exit().transition(tr).style('opacity', 0).remove();
    const nuE = nu.enter().append('g').attr('class', 'nudo').attr('transform', d => `translate(${d.x},${d.y})`).style('opacity', 0);
    nuE.append('circle').attr('class', 'hit').attr('r', 16);
    nuE.append('circle').attr('class', 'base').attr('r', 9);
    nuE.append('text');
    nuE.append('title');
    nuE.transition().delay(d => (inicial ? 700 + d.e.nodo.prof * 260 : 0)).duration(dur).style('opacity', 1);
    nuE.on('click', (ev, d) => { ev.stopPropagation(); tocarNudo(d); });
    const nuT = nuE.merge(nu);
    nuT.classed('cerrado', d => d.e.cerrado).classed('fantasma', d => d.e.fantasma && !d.total);
    nuT.select('text').text(d => (d.e.fantasma && !d.total ? '↗' : d.e.cerrado ? d.total : '−'));
    nuT.select('title').text(d => {
      if (d.e.fantasma && !d.total) return 'Sus hijos aparecen junto a ' + P.get(otroProgenitor(d.e)).nombre;
      return d.e.cerrado ? `Mostrar ${d.total} ${d.total === 1 ? 'hijo' : 'hijos'}` : 'Ocultar descendencia';
    });
    nu.transition(tr).attr('transform', d => `translate(${d.x},${d.y})`).style('opacity', 1);

    /* hilos dorados */
    const pu = capas.puentes.selectAll('path.puente').data(datos.puentes, d => d.key);
    pu.exit().remove();
    const puE = pu.enter().append('path').attr('class', d => 'puente' + (d.principal ? ' principal' : '')).style('opacity', 0);
    puE.append('title').text(d => P.get(d.id).nombre + ' aparece también en otra parte del árbol');
    puE.attr('d', d => curvaPuente(d.a, d.b))
      .transition().delay(inicial ? 2600 : 0).duration(1200).style('opacity', null);
    pu.transition(tr).attr('d', d => curvaPuente(d.a, d.b));

    if (inicial) setTimeout(ajustarTextos, 50); else ajustarTextos();
    primeraVez = false;
    resaltar(seleccion);
    marcarElegida();
    dibujarMinimapa();
  }

  function construirTarjeta(sel) {
    sel.append('rect').attr('class', 'pulso').attr('width', d => d.w).attr('height', T.H).attr('rx', 14);
    sel.append('rect').attr('class', 'fondo').attr('width', d => d.w).attr('height', T.H).attr('rx', 12);
    sel.filter(d => d.sangre).append('rect').attr('class', 'riel').attr('x', 0).attr('y', 14).attr('width', 3).attr('height', T.H - 28).attr('rx', 1.5);
    let xTexto = 16;
    if (FOTOS) {
      sel.each(function (d) {
        const g = d3.select(this);
        const r = d.sangre ? T.foto : T.foto - 3;
        const cx = d.sangre ? 12 + T.foto : 10 + T.foto - 3;
        g.append('circle').attr('class', 'foto-hueco').attr('cx', cx).attr('cy', T.H / 2).attr('r', r);
        g.append('text').attr('class', 'iniciales').attr('x', cx).attr('y', T.H / 2 + 1).text(iniciales(P.get(d.id).nombre));
        const src = fotos.get(d.id);
        if (src) {
          g.append('image').attr('href', src).attr('x', cx - r).attr('y', T.H / 2 - r).attr('width', r * 2).attr('height', r * 2)
            .attr('preserveAspectRatio', 'xMidYMid slice').attr('clip-path', `url(#${d.sangre ? 'recorte-foto' : 'recorte-foto-p'})`);
          g.append('circle').attr('class', 'foto-aro').attr('cx', cx).attr('cy', T.H / 2).attr('r', r);
        }
      });
      xTexto = 12 + T.foto * 2 + 12;
    }
    sel.each(function (d) {
      const g = d3.select(this);
      const { pila, apellidos } = partirNombre(P.get(d.id).nombre);
      const x = d.sangre ? xTexto : (FOTOS ? xTexto - 6 : 14);
      if (apellidos) {
        g.append('text').attr('class', 'nombre').attr('x', x).attr('y', T.H / 2 - 2).text(pila);
        g.append('text').attr('class', 'apellidos').attr('x', x).attr('y', T.H / 2 + 14).text(apellidos);
      } else {
        g.append('text').attr('class', 'nombre').attr('x', x).attr('y', T.H / 2 + 5).text(pila);
      }
      g.select('.nombre').attr('data-max', d.w - x - 14);
      g.select('.apellidos').attr('data-max', d.w - x - 14);
    });
  }

  function ajustarTextos() {
    capas.tarjetas.selectAll('text.nombre, text.apellidos').each(function () {
      const max = +this.getAttribute('data-max');
      if (!max || this.hasAttribute('textLength')) return;
      let largo = 0;
      try { largo = this.getComputedTextLength(); } catch (e) { return; }
      if (largo > max) {
        this.setAttribute('textLength', max);
        this.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
    });
  }

  function otroProgenitor(e) {
    const u = U.get(e.uid);
    const yo = e.nodo.id;
    return (u.pareja.find(x => x !== yo) || yo);
  }

  function tocarNudo(d) {
    const e = d.e;
    if (e.fantasma && !d.total) {
      // Los hijos de esta pareja ya están dibujados junto al otro progenitor.
      const u = U.get(e.uid);
      const destino = u.hijos.find(x => tarjetaPrincipal.has(x));
      if (destino) { volarA(destino); avisar('Sus hijos están aquí, en la otra rama'); }
      return;
    }
    e.cerrado = !e.cerrado;
    dibujar({ origen: { x: e._kx, y: e._ky } });
  }

  /* ───────── resaltado y selección ───────── */
  function resaltar(id) {
    if (!actual) return;
    if (!id) {
      svg.classed('enfoque', false);
      capas.tarjetas.selectAll('g.tarjeta').classed('linaje', false);
      return;
    }
    const s = linaje(id);
    svg.classed('enfoque', true);
    capas.tarjetas.selectAll('g.tarjeta').classed('linaje', d => s.has(d.id));
    capas.enlaces.selectAll('path.enlace').classed('linaje', d => s.has(d.hijo) && d.padres.some(p => s.has(p)));
    capas.lazos.selectAll('path.lazo').classed('linaje', d => s.has(d.a) && s.has(d.b));
    capas.puentes.selectAll('path.puente').classed('linaje', d => s.has(d.id));
    capas.nudos.selectAll('g.nudo').classed('linaje', d => U.get(d.e.uid).pareja.some(p => s.has(p)) && (d.e.nodo.id ? s.has(d.e.nodo.id) : true));
  }
  function marcarElegida() {
    capas.tarjetas.selectAll('g.tarjeta').classed('elegida', d => d.id === seleccion);
  }

  function asegurarVisible(id) {
    // Abre las ramas plegadas que esconden a esta persona.
    let n = nodoDe.get(id);
    let cambio = false;
    while (n && n.padre) {
      if (n.padre.cerrado) { n.padre.cerrado = false; cambio = true; }
      n = n.padre.nodo;
    }
    if (!tarjetaPrincipal.has(id)) {
      // Puede ser pareja de alguien plegado.
      for (const t of [nodoDe.get(parejasDe(id)[0])]) if (t) { let m = t; while (m && m.padre) { if (m.padre.cerrado) { m.padre.cerrado = false; cambio = true; } m = m.padre.nodo; } }
    }
    if (cambio) dibujar({ sinAnimar: true });
  }

  function elegir(id, { volar = true } = {}) {
    if (!P.has(id)) return;
    seleccion = id;
    asegurarVisible(id);
    marcarElegida();
    resaltar(id);
    abrirFicha(id);
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* nada */ }
    if (volar || esCelular()) volarA(id);
  }

  function volarA(id, k) {
    const t = tarjetaPrincipal.get(id);
    if (!t) return;
    const w = innerWidth, hgt = innerHeight;
    const fichaAbierta = body.classList.contains('ficha-abierta');
    const libreW = !esCelular() && fichaAbierta ? w - 410 : w;
    const libreH = esCelular() && fichaAbierta ? hgt * 0.28 + 60 : hgt;
    const escala = k || Math.max(Math.min(transformacion.k, 1.6), esCelular() ? 0.85 : 0.95);
    const cx = t.x + t.w / 2, cy = t.y + T.H / 2;
    const destino = d3.zoomIdentity.translate(libreW / 2 - cx * escala, (esCelular() && fichaAbierta ? libreH / 2 + 20 : hgt / 2 + 20) - cy * escala).scale(escala);
    svg.transition().duration(reducirMovimiento ? 0 : 1100).ease(d3.easeCubicInOut).call(zoom.transform, destino)
      .on('end', () => pulsar(id));
  }
  function pulsar(id) {
    const g = capas.tarjetas.selectAll('g.tarjeta').filter(d => d === tarjetaPrincipal.get(id));
    g.classed('pulsando', false);
    void (g.node() && g.node().getBBox());
    g.classed('pulsando', true);
    setTimeout(() => g.classed('pulsando', false), 3400);
  }

  function encuadrar(x0, y0, x1, y1, dur = 900, margen = 60) {
    const w = innerWidth, hgt = innerHeight;
    const arribaUI = esCelular() ? 120 : 80;
    const k = Math.min((w - margen * 2) / (x1 - x0), (hgt - arribaUI - margen * 2) / (y1 - y0), 1.4);
    const t = d3.zoomIdentity.translate(w / 2 - ((x0 + x1) / 2) * k, arribaUI / 2 + hgt / 2 - ((y0 + y1) / 2) * k).scale(k);
    svg.transition().duration(reducirMovimiento ? 0 : dur).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }
  const encuadrarTodo = dur => encuadrar(limites.x0, limites.y0, limites.x1, limites.y1, dur);
  // Vista de bienvenida: las dos ramas a lo ancho, desde arriba.
  function vistaInicial(dur) {
    const w = innerWidth;
    const ancho = limites.x1 - limites.x0;
    const k = Math.min(1, Math.max(0.22, (w - 80) / ancho));
    const t = d3.zoomIdentity.translate((w - ancho * k) / 2 - limites.x0 * k, (esCelular() ? 130 : 110) - limites.y0 * k).scale(k);
    svg.transition().duration(reducirMovimiento ? 0 : dur).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }
  function irARama(rama) {
    const s = seccionesInfo.find(x => x.rama === rama);
    if (!s) return;
    const w = innerWidth;
    const k = esCelular() ? 0.55 : 0.75;
    const t = d3.zoomIdentity.translate(Math.min(60, w * 0.06) - s.x * k, (esCelular() ? 150 : 120) - s.y * k).scale(k);
    svg.transition().duration(1200).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }

  /* ───────── ficha ───────── */
  let ficha;
  function montarFicha() {
    ficha = h('aside', { class: 'ficha', 'aria-hidden': 'true', 'aria-label': 'Ficha de la persona' },
      h('div', { class: 'agarre' }),
      h('button', { class: 'cerrar', 'aria-label': 'Cerrar', onclick: cerrarFicha, html: '<svg viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12"/></svg>' }),
      h('div', { class: 'contenido' }));
    document.body.append(ficha);
    // Deslizar hacia abajo para cerrar en celular.
    let y0 = null;
    ficha.addEventListener('touchstart', ev => { if ($('.contenido', ficha).scrollTop <= 0) y0 = ev.touches[0].clientY; }, { passive: true });
    ficha.addEventListener('touchmove', ev => {
      if (y0 == null) return;
      const dy = ev.touches[0].clientY - y0;
      if (dy > 0) ficha.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    ficha.addEventListener('touchend', ev => {
      if (y0 == null) return;
      const dy = ev.changedTouches[0].clientY - y0;
      ficha.style.transform = '';
      y0 = null;
      if (dy > 90) cerrarFicha();
    });
  }

  function chip(id) {
    const p = P.get(id);
    const av = h('span', { class: 'av ' + (p.rama === RAMA_H ? 'hernandez' : p.rama === RAMA_A || p.rama !== RAMA_H ? 'azuara' : 'otra') });
    if (FOTOS && fotos.get(id)) av.append(h('img', { src: fotos.get(id), alt: '' }));
    else av.textContent = iniciales(p.nombre);
    return h('button', { class: 'chip', onclick: () => elegir(id, { volar: true }) }, av, p.nombre);
  }
  const seccion = (titulo, ids, vacio) => [
    h('h3', {}, titulo),
    ids.length ? h('div', { class: 'chips' }, ids.map(chip)) : h('p', { class: 'nada' }, vacio),
  ];

  function resumen(id) {
    const padres = padresDe(id).map(x => nombreCorto(P.get(x).nombre));
    const parejas = parejasDe(id).map(x => nombreCorto(P.get(x).nombre));
    const n = hijosDe(id).length;
    const frases = [];
    frases.push(padres.length ? `Sus padres son ${unir(padres)}.` : 'Sus padres no están registrados.');
    if (parejas.length) frases.push(`Formó familia con ${unir(parejas)}.`);
    if (n) frases.push(`Tiene ${n} ${n === 1 ? 'hijo registrado' : 'hijos registrados'}.`);
    return frases.join(' ');
  }
  const unir = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);

  function porConfirmar(id) {
    const p = P.get(id);
    const us = [p.union_padres, ...(unionesDe.get(id) || []).map(u => u.id)].filter(Boolean).map(x => U.get(x)).filter(Boolean);
    return us.some(u => u.supuesto) || (p.variantes && p.variantes.length > 0);
  }

  function abrirFicha(id) {
    const p = P.get(id);
    const rama = p.rama === RAMA_H ? 'hernandez' : 'azuara';
    const { pila, apellidos } = partirNombre(p.nombre);
    const c = $('.contenido', ficha);
    c.innerHTML = '';
    c.scrollTop = 0;
    if (FOTOS) {
      const ret = h('div', { class: 'retrato ' + rama });
      if (fotos.get(id)) ret.append(h('img', { src: fotos.get(id), alt: 'Foto de ' + p.nombre }));
      else ret.append(h('div', { class: 'hueco', title: 'Espacio para foto' }, h('span', {}, iniciales(p.nombre))));
      c.append(ret);
    } else {
      c.append(h('div', { class: 'monograma ' + rama, 'aria-hidden': 'true' }, iniciales(p.nombre)));
    }
    const colorRama = p.rama === RAMA_H ? 'var(--hernandez)' : 'var(--azuara)';
    c.append(h('div', { class: 'etiqueta' }, h('i', { style: 'background:' + colorRama }),
      p.rama === RAMA_H ? 'Rama Hernández de la Cajiga' : p.rama === RAMA_A ? 'Rama Azuara' : 'Une las dos ramas'));
    c.append(h('h2', {}, pila, apellidos ? h('span', { class: 'ap' }, apellidos) : null));
    c.append(h('p', { class: 'resumen' }, resumen(id)));
    const bloque = h('div', {},
      seccion('Padres', padresDe(id), 'Sin registrar'),
      seccion(parejasDe(id).length > 1 ? 'Parejas' : 'Pareja', parejasDe(id), 'Sin registrar'),
      seccion('Hijos', hijosDe(id), 'Sin hijos registrados'),
      hermanosDe(id).length ? seccion('Hermanos', hermanosDe(id), '') : null);
    c.append(bloque);
    if (porConfirmar(id)) {
      c.append(h('div', { class: 'confirmar' }, 'Algunos lazos de esta persona están por confirmar. Si sabes el dato correcto, avísale a Julio.'));
    }
    if (EDITAR) {
      const ed = h('div', { class: 'editor' },
        h('div', {}, 'Id: ', h('code', {}, id)),
        FOTOS ? h('div', {}, 'Foto: guarda la imagen como ', h('code', {}, CARPETA_FOTOS + id + '.jpg')) : null,
        p.variantes && p.variantes.length ? h('div', {}, 'También aparece como: ' + p.variantes.join(', ')) : null,
        p.notas && p.notas.length ? h('ul', {}, p.notas.map(n => h('li', {}, n))) : null,
        p.fuentes && p.fuentes.length ? h('div', {}, 'Fuente: ' + p.fuentes.join(', ')) : null);
      c.append(ed);
    }
    c.append(h('div', { class: 'acciones' },
      h('button', { class: 'boton fuerte', onclick: () => volarA(id) }, 'Ver en el árbol'),
      h('button', { class: 'boton', onclick: () => copiarEnlace(id) }, 'Copiar enlace')));
    ficha.classList.add('abierta');
    ficha.setAttribute('aria-hidden', 'false');
    body.classList.add('ficha-abierta');
  }
  function cerrarFicha() {
    if (!ficha) return;
    ficha.classList.remove('abierta');
    ficha.setAttribute('aria-hidden', 'true');
    body.classList.remove('ficha-abierta');
    seleccion = null;
    resaltar(null);
    marcarElegida();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nada */ }
  }
  function copiarEnlace(id) {
    const url = location.href.split('#')[0] + '#' + id;
    const ok = () => avisar('Enlace copiado');
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => avisar(url));
    else avisar(url);
  }

  let avisoT;
  function avisar(texto, ms = 2600) {
    const a = $('.aviso');
    a.textContent = texto;
    a.classList.add('visible');
    clearTimeout(avisoT);
    avisoT = setTimeout(() => a.classList.remove('visible'), ms);
  }

  /* ───────── buscador ───────── */
  function montarBarra() {
    const lupa = '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5" stroke-linecap="round"/></svg>';
    const barra = h('header', { class: 'barra' },
      h('a', { class: 'marca', href: '#', onclick: ev => { ev.preventDefault(); cerrarFicha(); vistaInicial(1200); } },
        h('span', { class: 'sello', 'aria-hidden': 'true' }, 'A·H'),
        h('span', { class: 'texto', html: 'Familia Azuara <em>· Hernández de la Cajiga</em>' })),
      h('div', { class: 'buscador', role: 'search' },
        h('span', { html: lupa }),
        h('input', { type: 'search', placeholder: 'Buscar a alguien de la familia', 'aria-label': 'Buscar persona', autocomplete: 'off', spellcheck: 'false' }),
        h('kbd', {}, '/'),
        h('ul', { class: 'resultados', role: 'listbox' })),
      h('nav', { class: 'ramas', 'aria-label': 'Ramas' },
        h('button', { onclick: () => irARama(RAMA_A) }, h('i', { style: 'background:var(--azuara)' }), 'Azuara'),
        h('button', { onclick: () => irARama(RAMA_H) }, h('i', { style: 'background:var(--hernandez)' }), h('span', { class: 'largo' }, 'Hernández de la Cajiga'), h('span', { class: 'corto' }, 'Hernández'))));
    document.body.append(barra);
    const iconos = {
      mas: '<svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg>',
      menos: '<svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg>',
      todo: '<svg viewBox="0 0 16 16"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>',
    };
    const leyenda = h('div', { class: 'leyenda' },
      h('div', { html: '<svg viewBox="0 0 28 10"><path d="M1 5h26" stroke="var(--linea)" stroke-width="1.6" fill="none"/></svg>' }, 'madre o padre e hijos'),
      h('div', { html: '<svg viewBox="0 0 28 10"><path d="M1 5h26" stroke="var(--linea)" stroke-width="1.4" stroke-dasharray="2 4" fill="none" stroke-linecap="round"/></svg>' }, 'pareja'),
      h('div', { html: '<svg viewBox="0 0 28 10"><path d="M1 5h26" stroke="var(--oro)" stroke-width="2" stroke-dasharray="1 6" fill="none" stroke-linecap="round"/></svg>' }, 'la misma persona en otra rama'));
    const controles = h('div', { class: 'controles' }, leyenda,
      h('div', { class: 'zoom' },
        h('button', { 'aria-label': 'Acercar', html: iconos.mas, onclick: () => svg.transition().duration(400).call(zoom.scaleBy, 1.4) }),
        h('button', { 'aria-label': 'Alejar', html: iconos.menos, onclick: () => svg.transition().duration(400).call(zoom.scaleBy, 1 / 1.4) }),
        h('button', { 'aria-label': 'Ver todo el árbol', html: iconos.todo, onclick: () => encuadrarTodo(1000) })));
    document.body.append(controles, h('canvas', { class: 'minimapa', 'aria-hidden': 'true' }), h('div', { class: 'aviso', role: 'status' }));

    const input = $('.buscador input');
    const lista = $('.resultados');
    const indice = D.personas.map(p => ({ id: p.id, n: normal(p.nombre), nombre: p.nombre }));
    let activos = [], pos = 0;
    const pintar = () => {
      lista.innerHTML = '';
      const q = normal(input.value.trim());
      if (!q) { lista.classList.remove('abierto'); return; }
      const palabras = q.split(/\s+/);
      activos = indice
        .filter(x => palabras.every(w => x.n.includes(w)))
        .sort((a, b) => (a.n.startsWith(palabras[0]) ? 0 : 1) - (b.n.startsWith(palabras[0]) ? 0 : 1) || a.n.localeCompare(b.n))
        .slice(0, 9);
      pos = 0;
      if (!activos.length) lista.append(h('li', { class: 'vacio' }, 'Nadie con ese nombre todavía'));
      activos.forEach((x, i) => {
        const p = P.get(x.id);
        const padres = padresDe(x.id).map(y => nombreCorto(P.get(y).nombre));
        const desc = padres.length ? `padres: ${padres.join(' y ')}` : (parejasDe(x.id).length ? 'pareja de ' + parejasDe(x.id).map(y => nombreCorto(P.get(y).nombre)).join(' y ') : '');
        lista.append(h('li', {
          role: 'option', 'aria-selected': String(i === pos),
          onmousedown: ev => { ev.preventDefault(); ir(x.id); },
        },
        h('span', { class: 'punto', style: 'background:' + (p.rama === RAMA_H ? 'var(--hernandez)' : 'var(--azuara)') }),
        h('div', {}, h('div', { class: 'n', html: marcar(x.nombre, palabras) }), desc ? h('div', { class: 'd' }, desc) : null)));
      });
      lista.classList.add('abierto');
    };
    const marcar = (nombre, palabras) => {
      const n = normal(nombre);
      const marcas = new Array(nombre.length).fill(false);
      for (const w of palabras) { const i = n.indexOf(w); if (i >= 0) for (let k = i; k < i + w.length; k++) marcas[k] = true; }
      let out = '', abierto = false;
      [...nombre].forEach((ch, i) => {
        if (marcas[i] && !abierto) { out += '<mark>'; abierto = true; }
        if (!marcas[i] && abierto) { out += '</mark>'; abierto = false; }
        out += ch.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
      });
      return out + (abierto ? '</mark>' : '');
    };
    const ir = id => { input.value = ''; pintar(); input.blur(); elegir(id, { volar: true }); };
    input.addEventListener('input', pintar);
    input.addEventListener('focus', pintar);
    input.addEventListener('blur', () => setTimeout(() => lista.classList.remove('abierto'), 120));
    input.addEventListener('keydown', ev => {
      const items = [...lista.querySelectorAll('li[role=option]')];
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!items.length) return;
        pos = (pos + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.setAttribute('aria-selected', String(i === pos)));
        items[pos].scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter' && activos[pos]) {
        ir(activos[pos].id);
      } else if (ev.key === 'Escape') {
        input.value = ''; pintar(); input.blur();
      }
    });
    document.addEventListener('keydown', ev => {
      if (ev.key === '/' && document.activeElement !== input) { ev.preventDefault(); input.focus(); }
      if (ev.key === 'Escape' && document.activeElement !== input) cerrarFicha();
    });
  }

  /* ───────── minimapa ───────── */
  let mini, miniCtx;
  function dibujarMinimapa() {
    if (!actual) return;
    if (!mini) {
      mini = $('.minimapa');
      if (!mini) return;
      miniCtx = mini.getContext('2d');
      const mover = ev => {
        const r = mini.getBoundingClientRect();
        const { k, ox, oy } = mini._escala;
        const x = (ev.clientX - r.left - ox) / k, y = (ev.clientY - r.top - oy) / k;
        const t = transformacion;
        svg.call(zoom.translateTo, x, y);
        void t;
      };
      let arrastrando = false;
      mini.addEventListener('pointerdown', ev => { arrastrando = true; mini.setPointerCapture(ev.pointerId); mover(ev); });
      mini.addEventListener('pointermove', ev => { if (arrastrando) mover(ev); });
      mini.addEventListener('pointerup', () => { arrastrando = false; });
    }
    if (getComputedStyle(mini).display === 'none') return;
    const dpr = devicePixelRatio || 1;
    const W = mini.clientWidth, H = mini.clientHeight;
    if (mini.width !== W * dpr) { mini.width = W * dpr; mini.height = H * dpr; }
    const ctx = miniCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pad = 10;
    const bw = limites.x1 - limites.x0, bh = limites.y1 - limites.y0;
    const k = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    const ox = pad + (W - pad * 2 - bw * k) / 2 - limites.x0 * k;
    const oy = pad + (H - pad * 2 - bh * k) / 2 - limites.y0 * k;
    mini._escala = { k, ox, oy };
    const css = getComputedStyle(document.documentElement);
    const cA = css.getPropertyValue('--azuara').trim(), cH = css.getPropertyValue('--hernandez').trim(), cL = css.getPropertyValue('--linea').trim(), cT = css.getPropertyValue('--tinta').trim();
    for (const t of actual.tarjetas) {
      ctx.fillStyle = t.sangre ? (P.get(t.id).rama === RAMA_H ? cH : cA) : cL;
      ctx.globalAlpha = seleccion && t.id === seleccion ? 1 : 0.75;
      ctx.fillRect(ox + t.x * k, oy + t.y * k, Math.max(1.5, t.w * k), Math.max(1, T.H * k));
    }
    ctx.globalAlpha = 1;
    const tr = transformacion;
    const vx = (-tr.x / tr.k), vy = (-tr.y / tr.k), vw = innerWidth / tr.k, vh = innerHeight / tr.k;
    ctx.strokeStyle = cT;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox + vx * k, oy + vy * k, vw * k, vh * k);
  }

  /* ───────── portada ───────── */
  function portada(onEntrar) {
    const gens = generaciones();
    const total = D.personas.length;
    const una = D.raices_union && D.raices_union.length === 2
      ? `Las dos ramas se encuentran en <b>${nombreCorto(P.get(D.raices_union[0]).nombre)}</b> y <b>${nombreCorto(P.get(D.raices_union[1]).nombre)}</b>.`
      : '';
    const flecha = '<svg viewBox="0 0 18 18"><path d="M3 9h12M10 4l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const el = h('section', { class: 'portada', 'aria-label': 'Bienvenida' },
      h('div', { html: '<svg class="ilustracion" viewBox="0 0 600 700" preserveAspectRatio="xMidYMax meet" aria-hidden="true"></svg>' }),
      h('div', { class: 'texto' },
        h('p', { class: 'kicker' }, 'Árbol genealógico'),
        h('h1', { html: '<span class="l"><span>Familia</span></span><span class="l"><span><em>Azuara</em> &amp;</span></span><span class="l"><span class="h">Hernández de la Cajiga</span></span>' }),
        h('p', { class: 'lead', html: `<b>${total}</b> personas, <b>${gens}</b> generaciones y dos ramas que crecieron por separado. ${una}` }),
        h('button', { class: 'boton fuerte', html: 'Recorrer el árbol ' + flecha })));
    document.body.append(el);
    const ilu = el.querySelector('svg.ilustracion');
    if (esCelular()) ilu.parentElement.style.height = '100%';
    ilu.parentElement.style.height = '100%';
    crecerArbolito(d3.select(ilu));
    const salir = () => {
      el.classList.add('fuera');
      almacen.set('portada-vista', '1');
      setTimeout(() => el.remove(), 1000);
      onEntrar();
    };
    el.querySelector('button').addEventListener('click', salir);
    el.querySelector('button').focus({ preventScroll: true });
  }

  // Arbolito dibujado a mano alzada, con las dos ramas en sus colores.
  function crecerArbolito(s) {
    let semilla = 7;
    const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
    const ramas = [];
    const hojas = [];
    const crecer = (x, y, ang, largo, grosor, nivel, color) => {
      const x2 = x + Math.cos(ang) * largo, y2 = y + Math.sin(ang) * largo;
      const curvo = (azar() - 0.5) * largo * 0.35;
      const cx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * curvo, cy = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * curvo;
      ramas.push({ d: `M${x},${y} Q${cx},${cy} ${x2},${y2}`, grosor, nivel, color });
      if (nivel >= 6 || largo < 14) { hojas.push({ x: x2, y: y2, nivel, color }); return; }
      const hijos = nivel < 2 ? 2 : (azar() < 0.3 ? 3 : 2);
      for (let i = 0; i < hijos; i++) {
        const abre = (i - (hijos - 1) / 2) * (0.5 + azar() * 0.25);
        crecer(x2, y2, ang + abre + (azar() - 0.5) * 0.2, largo * (0.7 + azar() * 0.12), grosor * 0.68, nivel + 1, nivel === 0 ? (i === 0 ? 'a' : 'h') : color);
      }
    };
    crecer(300, 690, -Math.PI / 2, 150, 15, 0, 't');
    const g = s.append('g');
    const col = c => (c === 'a' ? 'var(--azuara)' : c === 'h' ? 'var(--hernandez)' : 'var(--tinta)');
    g.selectAll('path').data(ramas).enter().append('path')
      .attr('class', 'rama-arbol').attr('d', d => d.d)
      .attr('stroke-width', d => Math.max(1, d.grosor))
      .style('stroke', d => (d.nivel < 1 ? 'var(--tinta)' : col(d.color)))
      .style('opacity', d => 0.95 - d.nivel * 0.06)
      .each(function () { const L = this.getTotalLength(); this.style.strokeDasharray = L; this.style.strokeDashoffset = L; })
      .transition().delay(d => 200 + d.nivel * 260 + azar() * 120).duration(d => 500 + 120 * (6 - d.nivel)).ease(d3.easeCubicOut)
      .style('stroke-dashoffset', 0);
    g.selectAll('circle').data(hojas).enter().append('circle')
      .attr('class', 'hoja').attr('cx', d => d.x).attr('cy', d => d.y).attr('r', () => 3 + azar() * 5)
      .style('fill', d => col(d.color)).style('opacity', () => 0.35 + azar() * 0.5)
      .each(function (d, i) { const el = this; setTimeout(() => el.classList.add('ya'), 1900 + i * 14 + azar() * 300); });
  }

  /* ───────── fotos ───────── */
  async function cargarFotos() {
    if (!FOTOS) return;
    // Opcional: fotos/fotos.json con { "id-de-la-persona": "archivo.jpg" } para nombres distintos.
    try {
      const r = await fetch(CARPETA_FOTOS + 'fotos.json', { cache: 'no-cache' });
      if (r.ok) {
        const m = await r.json();
        for (const [id, archivo] of Object.entries(m)) if (P.has(id) && archivo) fotos.set(id, CARPETA_FOTOS + archivo);
      }
    } catch (e) { /* sin lista de fotos */ }
    // Busca fotos/<id>.jpg para quien no esté en la lista.
    const pendientes = D.personas.filter(p => !fotos.has(p.id));
    await Promise.all(pendientes.map(p => new Promise(res => {
      const img = new Image();
      const src = CARPETA_FOTOS + p.id + '.jpg';
      img.onload = () => { fotos.set(p.id, src); res(); };
      img.onerror = () => res();
      img.src = src;
    })));
  }

  /* ───────── arranque ───────── */
  async function iniciar() {
    const cargando = h('div', { class: 'cargando' }, 'Reuniendo a la familia…');
    document.body.append(h('div', { class: 'grano', 'aria-hidden': 'true' }), cargando);
    let json;
    try {
      const r = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      json = await r.json();
    } catch (e) {
      cargando.innerHTML = '';
      cargando.append(h('div', { class: 'error' },
        h('p', {}, 'No se pudo leer la información de la familia.'),
        h('p', {}, location.protocol === 'file:'
          ? 'Esta página necesita abrirse desde un servidor (no con doble clic). Desde la carpeta del proyecto ejecuta: python3 -m http.server y abre http://localhost:8000/'
          : 'Detalle: ' + e.message)));
      return;
    }
    prepararDatos(json);
    construirBosque();
    await Promise.all([cargarFotos(), document.fonts ? document.fonts.ready : null]);
    cargando.remove();

    montarSvg(document.getElementById('app'));
    montarBarra();
    montarFicha();
    acomodar();
    recolectar();
    vistaInicial(0);

    const destinoHash = decodeURIComponent(location.hash.slice(1));
    const arrancar = () => {
      dibujar();
      if (P.has(destinoHash)) {
        setTimeout(() => elegir(destinoHash, { volar: true }), reducirMovimiento ? 0 : 900);
      } else {
        setTimeout(() => {
          const r = D.raices_union && D.raices_union[0];
          if (r && tarjetaPrincipal.has(r)) volarA(r, esCelular() ? 0.7 : 0.85);
          avisar(esCelular() ? 'Arrastra para moverte, pellizca para acercar y toca a alguien para ver su familia' : 'Arrastra para moverte, usa la rueda para acercar y haz clic en alguien para ver su familia', 5200);
        }, reducirMovimiento ? 0 : 3400);
      }
    };
    if (P.has(destinoHash) || almacen.get('portada-vista')) arrancar();
    else portada(arrancar);

    addEventListener('resize', () => dibujarMinimapa());
    addEventListener('hashchange', () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (P.has(id) && id !== seleccion) elegir(id, { volar: true });
    });
  }

  iniciar();
})();
