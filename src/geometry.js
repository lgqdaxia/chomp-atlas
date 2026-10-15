/**
 * Exact geometry for downsets in N³. A box [a,b,c] means
 * [0,a) × [0,b) × [0,c); null is an unbounded axis. A cut [x,y,z]
 * deletes its coordinatewise upper orthant. Rendering uses a finite window
 * only; none of the mathematical operations use that display window.
 */

const PERMUTATIONS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2],
  [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

function point3(value, name = '坐标') {
  if (!Array.isArray(value) || value.length !== 3 ||
      value.some(n => !Number.isSafeInteger(n) || n < 0)) {
    throw new TypeError(`${name}必须是三个非负安全整数；ω 不是可选坐标。`);
  }
  return [...value];
}

function lessEqual(a, b) {
  return a.every((n, i) => n <= b[i]);
}

function compareTriples(a, b) {
  for (let i = 0; i < 3; i++) {
    const x = a[i] === null ? Infinity : a[i];
    const y = b[i] === null ? Infinity : b[i];
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function box3(value) {
  if (!Array.isArray(value) || value.length !== 3 ||
      value.some(n => n !== null && (!Number.isSafeInteger(n) || n < 0))) {
    throw new TypeError('盒子必须有三个非负整数长度，以 null 表示无限。');
  }
  return [...value];
}

function normalizedBoxes(boxes) {
  if (!Array.isArray(boxes)) throw new TypeError('盒子并必须是数组。');
  const sorted = boxes.map(box3).filter(b => !b.includes(0)).sort(compareTriples);
  return sorted.filter((box, index) => !sorted.some((other, otherIndex) => {
    if (index === otherIndex) return false;
    const contained = box.every((size, axis) => other[axis] === null ||
      (size !== null && size <= other[axis]));
    return contained && (compareTriples(box, other) !== 0 || otherIndex < index);
  }));
}

function inBoxes(point, boxes) {
  return boxes.some(box => box.every((length, i) => length === null || point[i] < length));
}

/** The unique minimal antichain of orthant origins; inputs are never mutated. */
export function simplifyCuts(cuts = []) {
  if (!Array.isArray(cuts)) throw new TypeError('删除点必须是数组。');
  const sorted = cuts.map(c => point3(c, '删除点')).sort(compareTriples);
  return sorted.filter((cut, index) => !sorted.some((other, otherIndex) =>
    otherIndex !== index && lessEqual(other, cut) &&
    (compareTriples(cut, other) !== 0 || otherIndex < index)));
}

/** Canonical cuts up to all six coordinate permutations, using numeric order. */
export function canonicalize(cuts = []) {
  const antichain = simplifyCuts(cuts);
  const choices = PERMUTATIONS.map(perm =>
    simplifyCuts(antichain.map(point => perm.map(axis => point[axis]))));
  choices.sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const comparison = compareTriples(a[i], b[i]);
      if (comparison) return comparison;
    }
    return a.length - b.length;
  });
  return choices[0];
}

export function canonicalKey(cuts = []) {
  return JSON.stringify(canonicalize(cuts));
}

/** Presence in the supplied box union minus cuts; absent boxes means N³. */
export function isPresent(point, { boxes, cuts = [] } = {}) {
  const p = point3(point);
  const domain = boxes === undefined ? [[null, null, null]] : normalizedBoxes(boxes);
  const antichain = simplifyCuts(cuts);
  return inBoxes(p, domain) && !antichain.some(cut => lessEqual(cut, p));
}

function requireSafeBite(point, present) {
  const p = point3(point, '落子');
  if (p.every(n => n === 0)) throw new RangeError('原点是毒块，不能作为安全落子。');
  if (!present(p)) throw new RangeError('该点已经删除或不属于当前棋形。');
  return p;
}

/** Add one legal safe bite to a finite history on the full N³ board. */
export function biteCuts(cuts, point) {
  const antichain = simplifyCuts(cuts);
  const p = requireSafeBite(point, candidate =>
    !antichain.some(cut => lessEqual(cut, candidate)));
  return simplifyCuts([...antichain, p]);
}

/**
 * Exact boundary-grid construction. Membership is constant on every cell
 * between consecutive cut coordinates, including the unbounded last cell.
 * A present cell's upper corner defines a box contained in the downset.
 */
export function boxesFromCuts(cuts = []) {
  const antichain = simplifyCuts(cuts);
  const axes = [0, 1, 2].map(axis =>
    [...new Set([0, ...antichain.map(c => c[axis])])].sort((a, b) => a - b));
  const result = [];
  const present = lower => !antichain.some(cut => lessEqual(cut, lower));
  for (let i = 0; i < axes[0].length; i++) {
    for (let j = 0; j < axes[1].length; j++) {
      for (let k = 0; k < axes[2].length; k++) {
        const indices = [i, j, k];
        const lower = indices.map((index, axis) => axes[axis][index]);
        if (!present(lower)) continue;
        // A nonmaximal cell has a present immediate successor along some
        // axis. Keeping only maximal cells avoids a quadratic cleanup of
        // every cell in a long bite history, without changing the downset.
        const hasPresentSuccessor = indices.some((index, axis) => {
          if (index + 1 >= axes[axis].length) return false;
          const neighbor = [...lower];
          neighbor[axis] = axes[axis][index + 1];
          return present(neighbor);
        });
        if (!hasPresentSuccessor) result.push(indices.map((index, axis) => axes[axis][index + 1] ?? null));
      }
    }
  }
  return normalizedBoxes(result);
}

/** Compare on every boundary-grid cell, including every infinite tail. */
export function equivalentBoxes(a, b) {
  const left = normalizedBoxes(a);
  const right = normalizedBoxes(b);
  const axes = [0, 1, 2].map(axis => [...new Set([
    0, ...left.map(box => box[axis]), ...right.map(box => box[axis]),
  ].filter(n => n !== null))].sort((x, y) => x - y));
  for (const x of axes[0]) for (const y of axes[1]) for (const z of axes[2]) {
    const p = [x, y, z];
    if (inBoxes(p, left) !== inBoxes(p, right)) return false;
  }
  return true;
}

function subtractOrthant(boxes, point) {
  const pieces = [];
  for (const box of boxes) {
    for (let axis = 0; axis < 3; axis++) {
      if (point[axis] === 0) continue;
      const piece = [...box];
      piece[axis] = box[axis] === null ? point[axis] : Math.min(box[axis], point[axis]);
      pieces.push(piece);
    }
  }
  return normalizedBoxes(pieces);
}

export function applyBite(boxes, point) {
  const domain = normalizedBoxes(boxes);
  const p = requireSafeBite(point, candidate => inBoxes(candidate, domain));
  return subtractOrthant(domain, p);
}

/** perm[i] is the old axis used for the new axis i. */
export function permuteBoxes(boxes, perm) {
  if (!Array.isArray(perm) || perm.length !== 3 ||
      [...perm].sort().join(',') !== '0,1,2') {
    throw new TypeError('坐标置换必须恰好包含 0、1、2。');
  }
  return normalizedBoxes(normalizedBoxes(boxes).map(box => perm.map(axis => box[axis])));
}

let mountSequence = 0;
const SVG_NS = 'http://www.w3.org/2000/svg';
const SCOPE_CSS = `
.ca-shape{position:relative;isolation:isolate;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;min-width:0;color:#1d343d;background:transparent;border:0;border-radius:0;overflow:hidden;font-family:inherit}
.ca-shape *{box-sizing:border-box}.ca-shape-head{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.ca-shape-title{font-size:14px;font-weight:650}.ca-shape-hint{font-size:11px}
.ca-shape-stage{display:block;flex:1 1 0;width:100%;height:100%;min-height:0;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}.ca-shape-stage:active{cursor:grabbing}.ca-shape-stage:focus-visible{outline:2px solid #286b61;outline-offset:-4px}
.ca-shape-foot{display:none}.ca-shape-caption{flex:none;margin:0;padding:0 12px 8px;font-size:11px;line-height:1.5;color:#6f817c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ca-shape-stage text{font-family:inherit;pointer-events:none}.ca-shape-stage polygon{stroke-linejoin:round}
`;

/**
 * Mount an explanatory SVG with exact logical geometry and a display window.
 * update() merges options; pass previewPoint:null to clear a preview.
 * No global DOM access occurs until this function is called.
 */
export function mountShape(container, initialOptions = {}) {
  if (!container?.ownerDocument || typeof container.appendChild !== 'function') {
    throw new TypeError('mountShape 需要浏览器中的容器元素。');
  }
  const doc = container.ownerDocument;
  if (!doc.querySelector('style[data-chomp-geometry]')) {
    const style = doc.createElement('style');
    style.dataset.chompGeometry = 'true';
    style.textContent = SCOPE_CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }
  const id = `ca-geom-${++mountSequence}`;
  let options = { extent: 5, previewPoint: null, label: '棋形', ...initialOptions };
  let yaw = Math.PI / 4;
  let pitch = 0.54;
  let destroyed = false;
  let drag = null;
  let logicalBoxes = [];

  const wrapper = doc.createElement('section');
  wrapper.className = 'ca-shape';
  const head = doc.createElement('div');
  head.className = 'ca-shape-head';
  const title = doc.createElement('span');
  title.className = 'ca-shape-title';
  const hint = doc.createElement('span');
  hint.className = 'ca-shape-hint';
  hint.textContent = '拖动旋转 · 双击复位';
  head.append(title, hint);
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ca-shape-stage');
  svg.setAttribute('role', 'img');
  svg.setAttribute('tabindex', '0');
  const foot = doc.createElement('div');
  foot.className = 'ca-shape-foot';
  const legend = doc.createElement('div');
  legend.className = 'ca-shape-legend';
  for (const [color, label] of [['#6d9b8d', '保留块'], ['#b95a48', '毒块原点'], ['#bb593b', '预览删除']]) {
    const key = doc.createElement('span');
    key.className = 'ca-shape-key';
    const dot = doc.createElement('i');
    dot.className = 'ca-shape-dot';
    dot.style.background = color;
    key.append(dot, doc.createTextNode(label));
    legend.appendChild(key);
  }
  const windowNote = doc.createElement('span');
  foot.append(legend, windowNote);
  const caption = doc.createElement('p');
  caption.className = 'ca-shape-caption';
  caption.textContent = '示意窗口 · ω 表示无限延伸 · 显示范围不参与 P/N 判定';
  wrapper.append(head, svg, foot, caption);
  container.appendChild(wrapper);

  function element(tag, attrs = {}, text) {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function draw() {
    if (destroyed) return;
    const cuts = simplifyCuts(options.cuts || []);
    logicalBoxes = options.boxes === undefined ? boxesFromCuts(cuts) : normalizedBoxes(options.boxes);
    if (options.boxes !== undefined) for (const cut of cuts) logicalBoxes = subtractOrthant(logicalBoxes, cut);
    const extent = Number.isSafeInteger(options.extent) ? Math.max(2, Math.min(12, options.extent)) : 5;
    const preview = options.previewPoint == null ? null : point3(options.previewPoint, '预览点');
    const previewLegal = preview && !preview.every(n => n === 0) && inBoxes(preview, logicalBoxes);
    const removed = p => !!previewLegal && lessEqual(preview, p);
    const insideWindow = p => p.every(n => n >= 0 && n < extent);
    const occupied = p => insideWindow(p) && inBoxes(p, logicalBoxes);
    const visible = p => occupied(p) && !removed(p);
    const cells = [];
    for (let x = 0; x < extent; x++) for (let y = 0; y < extent; y++) for (let z = 0; z < extent; z++) {
      const p = [x, y, z];
      if (occupied(p)) cells.push({ p, ghost: removed(p), poison: p.every(n => n === 0) });
    }
    const bounds = wrapper.getBoundingClientRect();
    const width = Math.max(240, bounds.width || container.clientWidth || 480);
    const stageHeight = svg.getBoundingClientRect().height;
    const height = Math.max(120, stageHeight || (bounds.height > 0 ? bounds.height - 25 : 280));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', `${options.label || '棋形'}，可拖动旋转。只显示前 ${extent} 层。`);
    title.textContent = options.label || '棋形';
    windowNote.textContent = `显示坐标 0–${extent - 1}`;
    svg.replaceChildren();
    const defs = element('defs');
    const marker = element('marker', { id: `${id}-arrow`, viewBox: '0 0 10 10', refX: 8, refY: 5,
      markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
    marker.appendChild(element('path', { d: 'M 1 1 L 9 5 L 1 9', fill: 'none', stroke: '#286b61', 'stroke-width': 1.5 }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    const co = Math.cos(yaw), si = Math.sin(yaw);
    const raw = p => [p[0] * co - p[1] * si, (p[0] * si + p[1] * co) * pitch - p[2] * 0.95];
    const limits = [0, 1, 2].map(axis => {
      const finite = logicalBoxes.map(box => box[axis] === null ? extent : Math.min(extent, box[axis]));
      return Math.max(1, ...finite);
    });
    const corners = [];
    for (const x of [0, limits[0] + 1.3]) for (const y of [0, limits[1] + 1.3]) for (const z of [0, limits[2] + 0.6]) corners.push(raw([x, y, z]));
    const minX = Math.min(...corners.map(p => p[0])), maxX = Math.max(...corners.map(p => p[0]));
    const minY = Math.min(...corners.map(p => p[1])), maxY = Math.max(...corners.map(p => p[1]));
    const scale = Math.min((width - 84) / Math.max(1, maxX - minX), (height - 42) / Math.max(1, maxY - minY), 43);
    const offsetX = width / 2 - (minX + maxX) * scale / 2;
    const offsetY = height / 2 - (minY + maxY) * scale / 2 + 3;
    const project = p => { const q = raw(p); return [offsetX + q[0] * scale, offsetY + q[1] * scale]; };
    const pointsAttr = vertices => vertices.map(v => project(v).map(n => n.toFixed(2)).join(',')).join(' ');
    const line = (a, b, attrs = {}) => {
      const p = project(a), q = project(b);
      return element('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], ...attrs });
    };
    // A quiet floor grid makes the exact integer coordinates legible.
    const floor = element('g', { stroke: '#d4dcd3', 'stroke-width': 0.7, opacity: 0.64 });
    for (let n = 0; n <= Math.max(limits[0], limits[1]); n++) {
      if (n <= limits[0]) floor.appendChild(line([n, 0, 0], [n, limits[1], 0]));
      if (n <= limits[1]) floor.appendChild(line([0, n, 0], [limits[0], n, 0]));
    }
    svg.appendChild(floor);
    // The screen basis vectors are (co,-si,0) and
    // (pitch*si,pitch*co,-.95). Their cross product points toward the
    // viewer: (.95*si,.95*co,pitch). Draw low camera-depth voxels first
    // and expose faces whose outward normals point toward that viewer.
    const xSide = si >= 0 ? 1 : 0;
    const ySide = co >= 0 ? 1 : 0;
    const depth = p => (p[0] * si + p[1] * co) * 0.95 + p[2] * pitch;
    cells.sort((a, b) => depth(a.p) - depth(b.p));
    const blockGroup = element('g', { 'stroke-width': 0.72 });
    for (const cell of cells) {
      const [x, y, z] = cell.p;
      const palette = cell.poison ? ['#b95a48', '#984b3d', '#d48b73'] :
        cell.ghost ? ['#bb593b', '#9d4b33', '#d38e74'] : ['#6d9b8d', '#518377', '#a1bfb0'];
      const opacity = cell.ghost ? 0.32 : 1;
      const exposed = neighbor => cell.ghost ?
        !occupied(neighbor) || !removed(neighbor) : !visible(neighbor);
      const faces = [
        { neighbor: [x + (xSide ? 1 : -1), y, z], color: palette[0], vertices: [[x+xSide,y,z],[x+xSide,y+1,z],[x+xSide,y+1,z+1],[x+xSide,y,z+1]] },
        { neighbor: [x, y + (ySide ? 1 : -1), z], color: palette[1], vertices: [[x,y+ySide,z],[x+1,y+ySide,z],[x+1,y+ySide,z+1],[x,y+ySide,z+1]] },
        { neighbor: [x,y,z+1], color: palette[2], vertices: [[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]] },
      ];
      for (const face of faces) if (exposed(face.neighbor)) {
        const polygon = element('polygon', { points: pointsAttr(face.vertices), fill: face.color,
          stroke: cell.ghost ? '#bf816b' : '#f7f6f1', opacity });
        polygon.appendChild(element('title', {}, `(${x}, ${y}, ${z})${cell.poison ? ' · 毒块' : cell.ghost ? ' · 预览删除' : ''}`));
        blockGroup.appendChild(polygon);
      }
    }
    svg.appendChild(blockGroup);
    // Infinite directions are derived from exact boxes, never from the window.
    const axesGroup = element('g');
    for (let axis = 0; axis < 3; axis++) {
      const unbounded = logicalBoxes.some(box => box[axis] === null);
      const end = [0, 0, 0]; end[axis] = limits[axis] + 1.0;
      const start = [0, 0, 0]; start[axis] = unbounded ? Math.max(0, limits[axis] - 0.35) : 0;
      axesGroup.appendChild(line(start, end, { stroke: '#7e918a', 'stroke-width': unbounded ? 1.5 : 0.8,
        'stroke-dasharray': unbounded ? '3 3' : 'none', 'marker-end': `url(#${id}-arrow)` }));
      const p = project(end);
      axesGroup.appendChild(element('text', { x: p[0] + 6, y: p[1] + (axis === 2 ? -5 : 4),
        fill: '#526b63', 'font-size': 11, 'font-weight': 600 }, `${'xyz'[axis]}${unbounded ? ' · ω' : ''}`));
    }
    const origin = project([0, 0, 0]);
    axesGroup.appendChild(element('circle', { cx: origin[0], cy: origin[1], r: 2.4, fill: '#bb593b', stroke: '#f7f6f1', 'stroke-width': 1 }));
    axesGroup.appendChild(element('text', { x: origin[0] - 8, y: origin[1] + 16, fill: '#9c553f', 'font-size': 11 }, 'o'));
    svg.appendChild(axesGroup);
    if (previewLegal && insideWindow(preview)) {
      const at = project(preview.map(n => n + 0.5));
      svg.appendChild(element('circle', { cx: at[0], cy: at[1], r: 5,
        fill: '#f7f6f1', stroke: '#bb593b', 'stroke-width': 1.5 }));
      svg.appendChild(element('circle', { cx: at[0], cy: at[1], r: 1.8, fill: '#bb593b' }));
    }
    if (preview) {
      caption.textContent = previewLegal ? `预览落子 (${preview.join(', ')})：${insideWindow(preview) ? '半透明部分将被删除。' : '该点在当前显示窗口之外。'}几何显示范围不改变无限棋形。` :
        `(${preview.join(', ')}) 不是当前棋形的安全落子。原点为毒块，ω 不是可选坐标。`;
    } else {
      caption.textContent = `示意窗口 0–${extent - 1} · ω 表示无限延伸 · 显示范围不参与 P/N 判定`;
    }
    caption.title = caption.textContent;
  }

  function pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, yaw, pitch, id: event.pointerId };
    svg.setPointerCapture?.(event.pointerId);
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    yaw = drag.yaw + (event.clientX - drag.x) * 0.009;
    pitch = Math.max(0.22, Math.min(0.88, drag.pitch + (event.clientY - drag.y) * 0.003));
    draw();
  }
  function pointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    drag = null;
  }
  function resetView() { yaw = Math.PI / 4; pitch = 0.54; draw(); }
  function keyDown(event) {
    if (event.key === 'ArrowLeft') yaw -= 0.15;
    else if (event.key === 'ArrowRight') yaw += 0.15;
    else if (event.key === 'ArrowUp') pitch = Math.min(0.88, pitch + 0.05);
    else if (event.key === 'ArrowDown') pitch = Math.max(0.22, pitch - 0.05);
    else if (event.key === 'Home') { resetView(); event.preventDefault(); return; }
    else return;
    event.preventDefault(); draw();
  }
  svg.addEventListener('pointerdown', pointerDown);
  svg.addEventListener('pointermove', pointerMove);
  svg.addEventListener('pointerup', pointerUp);
  svg.addEventListener('pointercancel', pointerUp);
  svg.addEventListener('dblclick', resetView);
  svg.addEventListener('keydown', keyDown);
  const ResizeObserverClass = doc.defaultView?.ResizeObserver;
  const observer = ResizeObserverClass ? new ResizeObserverClass(draw) : null;
  observer?.observe(wrapper);
  draw();
  return {
    update(nextOptions = {}) {
      if (destroyed) return;
      options = { ...options, ...nextOptions };
      draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      svg.removeEventListener('pointerdown', pointerDown);
      svg.removeEventListener('pointermove', pointerMove);
      svg.removeEventListener('pointerup', pointerUp);
      svg.removeEventListener('pointercancel', pointerUp);
      svg.removeEventListener('dblclick', resetView);
      svg.removeEventListener('keydown', keyDown);
      wrapper.remove();
    },
  };
}
