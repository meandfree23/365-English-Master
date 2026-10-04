#!/usr/bin/env node
// Pattern 365 데이터 검증기
// 사용법: node tools/validate-pattern.js [data/pattern/sprint1.js ...]
// 인자를 생략하면 data/pattern/ 안의 모든 파일을 검사합니다.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LENS_ORDER_FIXED = { 0: '뼈대', 3: '뉘앙스', 4: '롤플레이' };
const ET_FIXED = { 0: 'Skeleton', 1: 'Zoom Out', 2: 'Full Shot', 4: 'Real Talk' };
// 원본 영상 예문은 그대로 옮기지 않는다 (방법론만 차용)
const FORBIDDEN = [
  'gift for my son',
  'department store',
  "i'm at home alone right now",
  "i'm in a bad mood"
];

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(path.join(ROOT, 'data/pattern'))
      .filter(f => f.endsWith('.js'))
      .sort()
      .map(f => path.join('data/pattern', f));

global.window = {};
const errors = [];
const warns = [];
const err = (day, msg) => errors.push(`Day ${day}: ${msg}`);
const warn = (day, msg) => warns.push(`Day ${day}: ${msg}`);
const base = s => s.trim().replace(/[.?!]+$/, '');

for (const f of files) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  try {
    require(abs);
  } catch (e) {
    errors.push(`${f}: 파일 로드 실패 — ${e.message}`);
  }
}

const data = window.patternData || {};
const days = Object.keys(data).map(Number).sort((a, b) => a - b);
const seen = new Map();

for (const d of days) {
  const x = data[d];
  for (const k of ['v', 'vT', 'vD', 'governing', 'core']) {
    if (typeof x[k] !== 'string' || !x[k].trim()) err(d, `필드 누락: ${k}`);
  }
  if (x.governing && !x.governing.startsWith(`Day ${d}: [`)) err(d, 'governing은 "Day N: [core] ..." 형식이어야 함');
  if (!x.pair || !x.pair.x || !x.pair.note) err(d, 'pair {x, note} 누락');
  if (!x.pron || !x.pron.link || !x.pron.kr || !x.pron.tip) err(d, 'pron {link, kr, tip} 누락');
  if (!Array.isArray(x.my3) || x.my3.length !== 3) err(d, 'my3는 프롬프트 3개 배열이어야 함');

  const ss = x.sentences || [];
  if (ss.length !== 5) { err(d, `문장 수 ${ss.length} (5개 필요)`); continue; }

  ss.forEach((s, i) => {
    for (const k of ['txt', 't', 'n', 's', 'g', 'eT', 'eD', 'lens']) {
      if (typeof s[k] !== 'string' || !s[k].trim()) err(d, `S${i + 1} 필드 누락: ${k}`);
    }
    if (!['M', 'F'].includes(s.g)) err(d, `S${i + 1} g는 M/F`);
    if (LENS_ORDER_FIXED[i] && s.lens !== LENS_ORDER_FIXED[i]) err(d, `S${i + 1} lens는 "${LENS_ORDER_FIXED[i]}"`);
    if ((i === 1 || i === 2) && !/^\+ /.test(s.lens || '')) err(d, `S${i + 1} lens는 "+ 렌즈명" 형식`);
    if (ET_FIXED[i] && s.eT !== ET_FIXED[i]) err(d, `S${i + 1} eT는 "${ET_FIXED[i]}"`);
    if (/["“”]/.test(s.txt || '')) warn(d, `S${i + 1} 영어 문장에 큰따옴표 사용`);
    if (/^[AB]:/.test(s.txt || '')) err(d, `S${i + 1} txt에 화자 표기(A:/B:) 금지 — q 필드를 사용`);

    const key = (s.txt || '').trim().toLowerCase();
    if (seen.has(key)) err(d, `중복 문장 "${s.txt}" (Day ${seen.get(key)}와 겹침)`);
    else seen.set(key, d);

    const low = key;
    FORBIDDEN.forEach(p => { if (low.includes(p)) err(d, `원본 영상 예문 사용 금지: "${p}"`); });
  });

  // 줌아웃 사다리: S1 ⊂ S2 ⊂ S3, add는 꼬리 청크
  for (const i of [1, 2]) {
    const prev = base(ss[i - 1].txt || '');
    const cur = base(ss[i].txt || '');
    const add = (ss[i].add || '').trim();
    if (!add) { err(d, `S${i + 1} add(덧붙인 청크) 누락`); continue; }
    if (!cur.startsWith(prev)) err(d, `S${i + 1}은 S${i}로 시작해야 함 (줌아웃 사다리)\n      S${i}: ${ss[i - 1].txt}\n      S${i + 1}: ${ss[i].txt}`);
    if (!cur.endsWith(add)) err(d, `S${i + 1} add "${add}"는 문장 끝 청크여야 함`);
  }
  if (!ss[4].q || !ss[4].qt) err(d, 'S5 롤플레이에 q/qt(상대의 질문) 누락');
  for (let i = 1; i < 5; i++) {
    if (ss[i].g === ss[i - 1].g) warn(d, `S${i} → S${i + 1} 목소리 성별이 연속`);
  }
}

console.log(`검사한 파일: ${files.length}개 · Day ${days.length}개 · 문장 ${seen.size}개`);
if (warns.length) {
  console.log(`\n⚠️  경고 ${warns.length}건`);
  warns.forEach(w => console.log('  - ' + w));
}
if (errors.length) {
  console.log(`\n❌ 오류 ${errors.length}건`);
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\n✅ 모든 검사를 통과했습니다.');
