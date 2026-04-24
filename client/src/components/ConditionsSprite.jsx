import { useEffect, useRef } from 'react';
import { scoreColor } from '../utils.js';

const W = 320, H = 100, WL = 64; // viewBox dims, waterline y

// Wave math
function wy(x, amp, freq, ph) {
  return WL + amp * Math.sin(x * freq + ph) + amp * 0.38 * Math.sin(x * freq * 2.2 + ph * 0.8);
}
function wPath(amp, freq, ph, closed, w = W) {
  let d = `M 0 ${WL}`;
  for (let x = 0; x <= w; x += 3) d += ` L ${x} ${wy(x, amp, freq, ph).toFixed(2)}`;
  return closed ? d + ` L ${w} ${H} L 0 ${H} Z` : d;
}

// SVG element helper (works in DOM, not JSX)
function E(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function scoreToParams(score) {
  if (score >= 8) return { amp: 1.5, freq: 0.042, spd: 0.007, pose: 'glass' };
  if (score >= 6) return { amp: 3.5, freq: 0.052, spd: 0.013, pose: 'ripple' };
  if (score >= 4) return { amp: 8,   freq: 0.068, spd: 0.022, pose: 'chop' };
  if (score >= 2) return { amp: 14,  freq: 0.082, spd: 0.033, pose: 'rough' };
  return              { amp: 18,  freq: 0.095, spd: 0.045, pose: 'nogo' };
}

function isNightNow() {
  const hour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
  return hour >= 20 || hour < 6;
}

function skyFromData(windSpeedKt, skyCover) {
  if (isNightNow()) return 'night';
  if (skyCover == null) return windSpeedKt > 14 ? 'rain' : 'clear';
  if (skyCover <= 15) return 'sunny';
  if (skyCover <= 35) return 'partly';
  if (skyCover <= 70) return windSpeedKt > 12 ? 'rain' : 'overcast';
  return windSpeedKt > 10 ? 'rain' : 'overcast';
}

// Build wireframe paddler into a <g> element
const FC = '#c8dff0', TC = '#e2eef7', PC = '#d0e8f8';

function poly(pts, stroke, sw = 2) {
  return E('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
}
function ln(x1, y1, x2, y2, stroke, sw = 1.4) {
  return E('line', { x1, y1, x2, y2, stroke, 'stroke-width': sw, 'stroke-linecap': 'round' });
}

function buildPaddler(g, pose, color) {
  // Board
  g.appendChild(E('path', { d: 'M -20 0 C -20 -3,-10 -4.5,0 -4 C 10 -4.5,22 -3,22 0 C 22 3,10 4.5,0 4 C -10 4.5,-20 3,-20 0 Z', fill: '#b8d4e8', opacity: '0.9' }));
  g.appendChild(E('path', { d: 'M -13 -1 C -4 -2.5,8 -2.5,18 -1', fill: 'none', stroke: '#7aafcf', 'stroke-width': '0.8', opacity: '0.5', 'stroke-linecap': 'round' }));

  const blade = d => { const el = E('path', { d, fill: color, opacity: '0.82' }); return el; };
  const shaft = (x1,y1,x2,y2) => ln(x1,y1,x2,y2, PC, 1.4);
  const grip  = (x1,y1,x2,y2) => ln(x1,y1,x2,y2, PC, 2.0);

  if (pose === 'glass') {
    g.appendChild(poly([[-3,-3],[-4,-1],[-4,0]], FC));
    g.appendChild(poly([[3,-3],[4,-1],[4,0]], FC));
    g.appendChild(ln(0,-4, 0,-14, TC, 2.5));
    g.appendChild(E('circle', { cx:0, cy:-17.5, r:3, fill:TC }));
    g.appendChild(poly([[-1,-13],[-7,-11],[-9,-8]], TC));
    g.appendChild(poly([[1,-12],[6,-10],[9,-7]], TC));
    g.appendChild(shaft(7,-17, 12,4));
    g.appendChild(grip(4,-19, 10,-16));
    g.appendChild(blade('M 11 3 C 9 6,9 11,12 13 C 15 11,16 6,11 3 Z'));

  } else if (pose === 'ripple') {
    g.appendChild(poly([[-3,-3.5],[-5,-1.5],[-5,0]], FC));
    g.appendChild(poly([[3,-3.5],[5,-1.5],[5,0]], FC));
    g.appendChild(ln(0,-4, -1,-13, TC, 2.5));
    g.appendChild(E('circle', { cx:-1, cy:-16.5, r:3, fill:TC }));
    g.appendChild(poly([[0,-12],[6,-17],[10,-15]], TC));
    g.appendChild(poly([[-1,-11],[4,-8],[9,-4]], TC));
    g.appendChild(shaft(10,-17, 13,2));
    g.appendChild(grip(7,-19, 13,-16));
    g.appendChild(blade('M 12 1 C 10 4,10 9,13 11 C 16 9,17 4,12 1 Z'));

  } else if (pose === 'chop') {
    g.appendChild(poly([[-4,-4],[-7,-1],[-6,0]], FC));
    g.appendChild(poly([[4,-4],[7,-1],[6,0]], FC));
    g.appendChild(ln(0,-5, -2,-13, TC, 2.5));
    g.appendChild(E('circle', { cx:-2, cy:-16.5, r:3, fill:TC }));
    g.appendChild(poly([[-1,-12],[5,-16],[10,-13]], TC));
    g.appendChild(poly([[-1,-10],[4,-6],[9,-3]], TC));
    g.appendChild(shaft(10,-15, 12,2));
    g.appendChild(grip(7,-17, 13,-14));
    g.appendChild(blade('M 11 1 C 9 4,9 9,12 11 C 15 9,16 4,11 1 Z'));
    g.appendChild(E('path', { d:'M 9 8 Q 7 5,8 3', fill:'none', stroke:'#fff', 'stroke-width':'0.7', opacity:'0.25', 'stroke-linecap':'round' }));

  } else if (pose === 'rough') {
    g.appendChild(poly([[-5,-3],[-9,-1],[-8,0]], FC));
    g.appendChild(poly([[5,-3],[9,-1],[8,0]], FC));
    g.appendChild(ln(0,-4, -3,-11, TC, 2.5));
    g.appendChild(E('circle', { cx:-4, cy:-14, r:3, fill:TC }));
    g.appendChild(poly([[-2,-10],[-9,-9],[-12,-6]], TC));
    g.appendChild(poly([[-1,-9],[5,-7],[9,-5]], TC));
    g.appendChild(ln(-10,-8, 10,0, PC, 1.4));
    g.appendChild(grip(7,-5, 13,-3));
    g.appendChild(blade('M 10 -1 C 8 2,9 6,11 7 C 14 6,15 2,10 -1 Z'));

  } else { // nogo
    g.appendChild(E('path', { d:'M -16 2 C -16 -1,-8 -3,0 -2.5 C 8 -3,16 -1,16 2 C 16 4,8 5.5,0 5 C -8 5.5,-16 4,-16 2 Z', fill:'#b8d4e8', opacity:'0.6', transform:'rotate(-25,0,0)' }));
    g.appendChild(E('circle', { cx:4, cy:-15, r:3, fill:TC }));
    g.appendChild(ln(2,-4, 5,-12, TC, 2.5));
    g.appendChild(poly([[3,-11],[-4,-16],[-7,-13]], TC));
    g.appendChild(poly([[4,-11],[11,-15],[13,-12]], TC));
    g.appendChild(poly([[-1,-4],[-6,1],[-4,2]], FC));
    g.appendChild(poly([[3,-4],[8,0],[6,1]], FC));
    g.appendChild(ln(-5,-11, -14,-4, PC, 1.3));
    g.appendChild(blade('M -14 -3 C -16 -1,-17 3,-14 4 C -11 3,-11 -1,-14 -3 Z'));
  }
}

export default function ConditionsSprite({ score, windSpeedKt = 0, skyCover = null }) {
  const svgRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.innerHTML = '';

    const color = scoreColor(score ?? 0);
    const { amp, freq, spd, pose } = scoreToParams(score ?? 0);
    const sky = skyFromData(windSpeedKt, skyCover);

    // Sky gradient bg
    const defs = E('defs', {});
    const skyGrad = E('linearGradient', { id: 'cs-sky', x1:'0', y1:'0', x2:'0', y2:'1' });
    const skyColors = score >= 6 ? ['#1050a0','#1a6080'] : score >= 3 ? ['#121e30','#1a2840'] : ['#080c18','#0f1420'];
    skyGrad.appendChild(Object.assign(E('stop', { offset:'0%' }), { }));
    skyGrad.setAttribute('id', 'cs-sky');
    [['0%', skyColors[0]], ['100%', skyColors[1]]].forEach(([o, c]) => {
      const s = E('stop', { offset: o }); s.setAttribute('stop-color', c); skyGrad.appendChild(s);
    });
    const seaGrad = E('linearGradient', { id: 'cs-sea', x1:'0', y1:'0', x2:'0', y2:'1' });
    const seaColors = score >= 6 ? ['#0d8870','#095548'] : score >= 3 ? ['#1a3858','#0e2438'] : ['#580a14','#3a0810'];
    [['0%', seaColors[0]], ['100%', seaColors[1]]].forEach(([o, c]) => {
      const s = E('stop', { offset: o }); s.setAttribute('stop-color', c); seaGrad.appendChild(s);
    });
    defs.appendChild(skyGrad); defs.appendChild(seaGrad);
    svg.appendChild(defs);

    svg.appendChild(E('rect', { x:0, y:0, width:W, height:H, fill:'url(#cs-sky)' }));

    // Sun / Moon
    let sunEl = null;
    if (sky === 'night') {
      // crescent moon
      const mg = E('g', { transform:'translate(292,18)' });
      mg.appendChild(E('circle', { cx:0, cy:0, r:9, fill:'#c8d8f0', opacity:'0.9' }));
      mg.appendChild(E('circle', { cx:5, cy:-3, r:7, fill: skyColors[1] }));
      svg.appendChild(mg);
    } else if (sky === 'sunny' || sky === 'partly') {
      const sg = E('g', { transform:'translate(292,18)' });
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, r1 = sky==='sunny'?10:8, r2 = sky==='sunny'?14:11;
        sg.appendChild(E('line', { x1:Math.cos(a)*r1, y1:Math.sin(a)*r1, x2:Math.cos(a)*r2, y2:Math.sin(a)*r2, stroke:'#ffd040', 'stroke-width': sky==='sunny'?'2':'1.5', 'stroke-linecap':'round', opacity: sky==='sunny'?'0.9':'0.65' }));
      }
      sg.appendChild(E('circle', { cx:0, cy:0, r: sky==='sunny'?8:6, fill:'#ffd040', opacity: sky==='sunny'?'1':'0.8' }));
      svg.appendChild(sg);
      sunEl = sg;
    }

    // Clouds
    function mkCloud(cx, cy, sc) {
      const cc = score < 3 ? '#1e2530' : '#2a3a4f';
      [[0,0,sc],[sc*.7,-sc*.3,sc*.72],[-sc*.65,-sc*.2,sc*.55],[sc*.1,sc*.2,sc*.85]].forEach(([dx,dy,r]) => {
        const el = E('circle', { cx:cx+dx, cy:cy+dy, r, fill:cc, opacity:'0.65' });
        svg.appendChild(el);
      });
    }
    if (sky === 'partly') mkCloud(240, 20, 11);
    if (sky === 'overcast') { mkCloud(50, 18, 14); mkCloud(180, 13, 12); mkCloud(270, 20, 9); }
    if (sky === 'rain')     { mkCloud(30, 16, 16); mkCloud(155, 11, 15); mkCloud(270, 17, 11); }

    // Lightning
    let boltEl = null;
    if (sky === 'rain' && windSpeedKt > 16) {
      boltEl = E('path', { d:'M 180 10 L 174 20 L 178 20 L 172 32 L 184 18 L 180 18 Z', fill:'#ffe040', opacity:'0.9' });
      svg.appendChild(boltEl);
    }

    // Sea bg
    svg.appendChild(E('rect', { x:0, y:WL, width:W, height:H-WL, fill:'url(#cs-sea)' }));

    // Fish (calm only)
    if (score >= 7) {
      [[80,82],[140,86],[200,80]].forEach(([fx,fy]) => {
        const fg = E('g', { transform:`translate(${fx},${fy})`, opacity:'0.25' });
        fg.appendChild(E('ellipse', { cx:0, cy:0, rx:7, ry:2.5, fill:'#60c8b8' }));
        fg.appendChild(E('path', { d:'M -7 0 L -11 -2.5 L -11 2.5 Z', fill:'#60c8b8' }));
        fg.appendChild(E('circle', { cx:4, cy:-0.8, r:0.9, fill:'#060d1f' }));
        svg.appendChild(fg);
      });
    }

    // Rain drops
    const rainDrops = [];
    const rainCount = sky === 'rain' ? 18 : 0;
    for (let i = 0; i < rainCount; i++) {
      const d = E('line', { stroke:'#88b8d8', 'stroke-width':'0.8', 'stroke-linecap':'round', opacity:'0.4' });
      svg.appendChild(d);
      rainDrops.push({ el:d, x:Math.random()*W, y:Math.random()*H, spd:3+Math.random()*2 });
    }

    // Wave layers
    const wFill = E('path', { fill: color + '20' });
    const wLine = E('path', { fill:'none', stroke: color + 'aa', 'stroke-width':'1.5' });
    svg.appendChild(wFill);
    svg.appendChild(wLine);

    // Figure
    const figG = E('g', {});
    buildPaddler(figG, pose, color);
    svg.appendChild(figG);

    // Store animation state
    stateRef.current = { amp, freq, spd, color, phase: Math.random()*Math.PI*2, sunRot:0, wFill, wLine, figG, sunEl, boltEl, rainDrops };

    let raf;
    function tick() {
      const s = stateRef.current;
      if (!s) return;
      s.phase += s.spd;
      s.sunRot += 0.25;

      s.wFill.setAttribute('d', wPath(s.amp, s.freq, s.phase, true));
      s.wLine.setAttribute('d', wPath(s.amp, s.freq, s.phase, false));

      const fx = 130, fy = wy(fx, s.amp, s.freq, s.phase);
      const slope = (wy(fx+2, s.amp, s.freq, s.phase) - fy) / 2;
      const tilt = Math.atan(slope) * (180/Math.PI) * 0.45;
      s.figG.setAttribute('transform', `translate(${fx},${fy.toFixed(2)}) rotate(${tilt.toFixed(2)})`);

      if (s.sunEl) {
        const tp = (s.sunEl.getAttribute('transform')||'').replace(/\s*rotate\([^)]+\)/,'');
        s.sunEl.setAttribute('transform', `${tp} rotate(${s.sunRot.toFixed(1)})`);
      }
      if (s.boltEl) s.boltEl.setAttribute('opacity', Math.random() > 0.93 ? '1' : '0.65');

      s.rainDrops.forEach(d => {
        d.y += d.spd; d.x -= 0.5;
        if (d.y > H) { d.y = -10; d.x = Math.random()*W; }
        d.el.setAttribute('x1', d.x); d.el.setAttribute('y1', d.y);
        d.el.setAttribute('x2', d.x+2); d.el.setAttribute('y2', d.y+9);
      });

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); stateRef.current = null; };
  }, [score, windSpeedKt, skyCover]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
