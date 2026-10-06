// Media review pass: approved exercise images + video links, Service Worker precache, credits.
// Verifies the reviewed mapping exactly (no extra substitutions) and that no data/storage logic changed.
const REPO = require('path').resolve(__dirname, '..');
const fs = require('fs'), path = require('path');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const h = H(REPO);
const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const PHOTOS = path.join(REPO, 'assets', 'exercises', 'photos');

// ---------- 1) Approved images ----------
const IMAGES = {
  'Pull-up': 'pull-up-hd.jpg', 'Lat Pulldown presa larga': 'lat-pulldown-wide-hd.jpg', 'DB Overhead Press': 'dumbbell-overhead-press-hd.jpg',
  'Face Pull': 'face-pull.jpg', 'Hip Thrust': 'hip-thrust.jpg', 'Reverse Lunge': 'reverse-lunge.jpg', 'Step-Up': 'step-up.jpg',
  'Triceps Cable Pushdown': 'triceps-cable-pushdown.jpg', 'Ab Wheel': 'ab-wheel.jpg', 'Mountain Climbers': 'mountain-climbers.jpg',
  'Power Clean': 'power-clean.jpg', 'Squat Jump': 'squat-jump.jpg', 'Scapular Pull-up': 'scapular-pull-up.jpg', 'Assisted Pull-up': 'assisted-pull-up.jpg'
};
const jpegSize = buf => { // width/height from the JPEG SOF marker (no dependencies)
  for (let i = 2; i < buf.length - 9;) { if (buf[i] !== 0xFF) { i++; continue; } const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xC3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + buf.readUInt16BE(i + 2); } return null; };
T('14 approved images', Object.keys(IMAGES).length === 14);
Object.keys(IMAGES).forEach(name => {
  const f = IMAGES[name], p = path.join(PHOTOS, f), exists = fs.existsSync(p);
  const size = exists ? jpegSize(fs.readFileSync(p)) : null;
  T(`${name}: ${f} exists, real JPEG, >= 800 px wide`, exists && fs.readFileSync(p).slice(0, 2).toString('hex') === 'ffd8' && size && size[0] >= 800, J(size));
  T(`${name}: mapped to ${f}`, h.run(`exerciseAsset(${J(name)})`) === f && h.run(`localThumbnail(${J(name)})`) === 'assets/exercises/photos/' + f);
  T(`${name}: ${f} precached by the Service Worker`, sw.includes(`"./assets/exercises/photos/${f}",`));
});
T('each new image used by exactly one exercise mapping', Object.values(IMAGES).every(f => (html.match(new RegExp('"' + f.replace(/\./g, '\\.') + '"', 'g')) || []).length === 1));
// Kept as reviewed: no female photo replaced by free-exercise-db, shared photo kept for neutral/reverse, rejected image not applied.
T('Lat Pulldown neutral/reverse keeps the existing photo', h.run('exerciseAsset("Lat Pulldown neutral/reverse")') === 'lat-pulldown.jpg');
T('Strict Pull-up keeps its placeholder (image rejected)', h.run('localThumbnail("Strict Pull-up")') === 'assets/exercises/upper-generic.svg');
T('Needs-Review / kept photos unchanged', J(['Chest Supported Row', 'Bayesian Cable Curl', 'Machine Hip Thrust', 'KAS Glute Bridge', 'Vacuum addominale', 'Frog Stand', 'L-Sit', 'Hip Abduction'].map(n => h.run(`exerciseAsset(${J(n)})`))) === J(['chest-supported-row.jpg', 'bayesian-cable-curl.jpg', 'machine-hip-thrust.jpg', 'kas-glute-bridge.jpg', 'vacuum-addominale.jpg', 'frog-stand.jpg', 'l-sit.jpg', 'hip-abduction.jpg']));
T('No-good-asset exercises keep placeholders', ['Wall Handstand Toe Taps', 'Handstand Toe Taps', 'Frog Stand Weight Shift', 'L-Sit on Parallettes', 'Cossack Squat', 'Ski Erg'].every(n => /\.svg$/.test(h.run(`localThumbnail(${J(n)})`))));

// ---------- 2) Service Worker ----------
T('SW cache version is fede-tracker-v63', /const CACHE = "fede-tracker-v63";/.test(sw));
T('every precached file exists', (sw.match(/"\.\/[^"]+"/g) || []).every(f => fs.existsSync(path.join(REPO, f.slice(3, -1)))));

// ---------- 3) Approved videos ----------
const YT = id => 'https://www.youtube.com/watch?v=' + id;
const VIDEOS = {
  'Pull-up': YT('TMnxKjdYcME'), 'Strict Pull-up': YT('HRV5YKKaeVw'), 'Lat Pulldown presa larga': YT('83Y3CFcgnkQ'),
  'Lat Pulldown neutral/reverse': 'https://www.tiktok.com/@intrnalfit/video/7228733916398554411',
  'Chest Supported Row': YT('0-DXJiceG-0'), 'Dumbbell Lateral Raise': YT('Y29xKcze8Ik'), 'Face Pull': YT('eTCBSFlCJ_s'),
  'Bayesian Cable Curl': YT('S6HnE1fDlaI'), 'Barbell / DB RDL': YT('KN5vN3JskqI'), 'Seated Leg Curl': YT('_2Kd0d-JEUM'),
  'Bulgarian Split Squat': YT('uKvbvGEBhRg'), 'Hip Abduction Seated': YT('5O_Y9l__iao'), 'Hip Abduction': YT('5O_Y9l__iao'),
  'DB Overhead Press': YT('guW_ENwLOMI'), 'Machine Dip': YT('Zg0tT27iYuY'), 'Cable Lateral Raise': YT('nMCQuV6HE3A'),
  'Overhead Triceps Extension': YT('AUsSlsBu5eg'), 'Hanging Knee Raise': YT('0BmrlKCfTPU'), 'CORE · Hanging Knee Raise': YT('0BmrlKCfTPU'),
  'Dead Bug': YT('bxn9FBrt4-A'), 'CORE · Dead Bug': YT('bxn9FBrt4-A'), 'Cable Crunch': YT('kc0PRn372lo'), 'CORE · Cable Crunch': YT('kc0PRn372lo'),
  'Vacuum addominale': YT('N9msEniBkbU'), 'Leg Extension': YT('MXvSzXEBOTI'), 'Cable Kickback': YT('bVrmtCI00Ys'),
  'Back Extension Glute Bias': YT('GFqfIInCuUQ'), 'Glute Bridge': YT('OUgsJ8-Vi0E'), 'Glute Bridge monopodalico': YT('nat5dN0Kuao'),
  'KAS Glute Bridge': YT('gM8N2SQ4Hfk'), 'Stacco Sumo con Manubrio': YT('I-5x_YvwPY4'), 'Banded Clamshell': YT('PU-B5F2rYqI'),
  'Hip Thrust': YT('YXVzbJQ3W-A'), 'Reverse Lunge': YT('Q2k3kYbtOcI'), 'Step-Up': YT('Zp7RG4jFScw'), 'Single Arm Row': YT('nYFjVJqMmM8'),
  'Single Arm Lat Pulldown': YT('Vu3OrBHrMNk'), 'Incline Side Raise': YT('gBhoCzxyACs'), 'Cable Rear Delt Pullapart': YT('ywMSCem375A'),
  'Rope Biceps Curl': YT('PslvRTdHJHY'), 'Triceps Cable Pushdown': YT('nMqQNGo4Jtg'), 'Ab Wheel': YT('NbudTqiwguk'), 'Ski Erg': YT('B0lIgT5PHc8'),
  'Mountain Climbers': YT('sB0DQ-aElF8'), 'Side Plank Crunch': YT('QnRL9ftOByI'), '45° Glute-Ham Raise': YT('OMb1VFQK9Tk'),
  'Power Clean': YT('YG8M_-11C2A'), 'Hang Power Clean': YT('efHjodEVf9w'), 'Squat Jump': YT('tZSYZdtbONc'), 'Depth Drop + Broad Jump': YT('T8ytijj6WZ0'),
  'Vertical Jump Assisted': YT('jO7VfNaJW64'), 'Single-Leg Plate Hop to Skater Jump': YT('UUtTxzwUw3g'), 'Cossack Squat': YT('d4IPCXI8GQc'),
  'Assisted Pistol Squat': YT('6pUx2ktKCMQ'), 'Pin Squat': YT('NO9mkilY26g'), 'Frog Stand': YT('fAg1ZlngaMo'), 'Frog Stand Toe Lift': YT('9UsVixEDBSU'),
  'L-Sit': YT('H_iZG5-L_KI'), 'L-Sit on Parallettes': YT('H_iZG5-L_KI'), 'Tuck L-Sit': YT('K-c1xXiUWJE'), 'Single-Leg L-Sit': YT('49pZak4cQ_0'),
  'Tuck Support': YT('VJy6E4DPu8Q'), 'Hollow Body Hold': YT('MY6_stJuy7M'), 'Single-Leg Lift': YT('IcTApCXeUxA'), 'Hamstring Stretch Compression': YT('OkvvlAxtQX4'),
  'Negative Pull-up': YT('bn76WhQQMlI'), 'Chest-to-Bar Pull-up': YT('LKLV8-P-WrM'), 'Scapular Pull-up': YT('1I9JZz8iNFA'), 'Assisted Pull-up': YT('4yE-XGDWJPg'),
  'Active Hang': YT('WUY-S2jaghc'), 'Wall Walk': YT('47rNQtnuQMg'), 'Chest-to-Wall Handstand': YT('fj6lKSg5bSM'), 'Wall Handstand Weight Shift': YT('fdqa_UWyCGg'),
  'Wrist Prep': YT('q2R16anKOnA'), 'Wrist Extension Prep': YT('yKvvmWuunM8'), 'Shoulder Flexion Drill': YT('QiyEbAgq0Dk'), 'Pancake Stretch': YT('CHRUb43S6RM')
};
const KEPT = { // existing links intentionally left as they were
  'Machine Hip Thrust': 'https://www.tiktok.com/@mireiafiguerass/video/7486569223574015254',
  'B-Stance RDL': 'https://www.tiktok.com/@mireiafiguerass/video/7371150082604928288',
  'Single Leg Leg Press': 'https://www.tiktok.com/@mireiafiguerass/video/7456509650435984672',
  'Hip Thrust monopodalico manubrio': 'https://www.tiktok.com/@mireiafiguerass/video/7469496044137483542'
};
const vid = JSON.parse(h.run('JSON.stringify(VID)'));
T('77 approved video mappings', Object.keys(VIDEOS).length === 77);
const wrong = Object.keys(VIDEOS).filter(n => !vid[n] || vid[n].u !== VIDEOS[n]);
T('every approved video URL is mapped to its exercise', wrong.length === 0, wrong.join());
T('kept links unchanged', Object.keys(KEPT).every(n => vid[n] && vid[n].u === KEPT[n]));
T('VID contains exactly the approved + kept entries (no extra substitutions)', J(Object.keys(vid).sort()) === J(Object.keys(VIDEOS).concat(Object.keys(KEPT)).sort()), Object.keys(vid).filter(n => !(n in VIDEOS) && !(n in KEPT)).join());
T('every video entry has a label and an https URL', Object.values(vid).every(v => /^https:\/\/www\.(youtube|tiktok)\.com\//.test(v.u) && typeof v.t === 'string' && v.t.length > 3));
T('no Google Images wrapper / tracking URL', !Object.values(vid).some(v => /google\.|imgres|[?&](si|pp|feature)=/.test(v.u)));
T('No-good-asset exercises still have no video', ['Wall Handstand Toe Taps', 'Handstand Toe Taps', 'Frog Stand Weight Shift', 'Clamshell con manubrio', 'Nuoto'].every(n => !vid[n]));

// ---------- 4) Removed mismatched links ----------
T('Military Press link removed', !('Military Press' in vid) && !html.includes('video/7458364008479870241'));
T('Reverse Pec Deck link removed', !('Reverse Pec Deck (delt post.)' in vid) && !html.includes('video/7607890640684240131'));
T('old mismatched compilation links no longer mapped', !Object.values(vid).some(v => /7588246792437763350|7364476509039512864|7462816269805309217|7511415895068019990|instagram\.com/.test(v.u)));

// ---------- 5) UI uses the mapping ----------
{ h.run('profile=getProfile();cur=new Date("2026-01-20T12:00:00");key="k";data=norm({day:"Giorno 1"});exCtx=null;exIdx=0;lastExLoading=false;lastEx=null;exerciseTab="video";');
  const ex = h.run('exerciseHTML()');
  T('Pull-up screen: poster uses the new photo and links the approved video', ex.includes('src="assets/exercises/photos/pull-up-hd.jpg"') && ex.includes('href="' + VIDEOS['Pull-up'] + '"'));
  const thumb = h.run('videoEmbedHTML("Face Pull","x")');
  T('library thumbnail for Face Pull: new photo + real-video badge', /has-real-video/.test(thumb) && thumb.includes('photos/face-pull.jpg'));
  h.run('globalThis.__opened=[];window.open=function(u){__opened.push(u);};globalThis.__a={dataset:{exVideo:"Strict Pull-up"},closest:function(){return null;}};document.querySelectorAll=function(s){return s==="[data-ex-video]"?[__a]:[];};bind();__a.onclick({preventDefault(){},stopPropagation(){}});');
  T('FRAME VIDEO opens the approved Strict Pull-up video', h.run('JSON.stringify(__opened)') === J([VIDEOS['Strict Pull-up']])); }

// ---------- 6) Photo credits (CC BY 2.0) ----------
{ const prof = h.run('profileHTML()');
  T('Profile has a Photo credits section', /Crediti foto \/ Photo credits/.test(prof));
  T('CC BY 2.0 credit for each of the 3 PTPioneer photos (title, author, licence, source, ptpioneer.com)', JSON.parse(h.run('JSON.stringify(PHOTO_CREDITS)')).length === 3 &&
    ['Girl doing pull up top position', 'Girl doing lat pulldown exercise', 'Girl doing dumbbell shoulder press 02'].every(t => prof.includes(t)) &&
    (prof.match(/creativecommons\.org\/licenses\/by\/2\.0\//g) || []).length === 3 && (prof.match(/www\.ptpioneer\.com/g) || []).length >= 3 && /commons\.wikimedia\.org\/wiki\/File:/.test(prof));
  T('credits list matches the bundled files', J(JSON.parse(h.run('JSON.stringify(PHOTO_CREDITS.map(c=>c.file).concat(PUBLIC_DOMAIN_PHOTOS))')).sort()) === J(Object.values(IMAGES).sort()));
  T('credits are not shown on exercise screens', !/ptpioneer|creativecommons/.test(h.run('exerciseHTML()'))); }

// ---------- 7) Media never touches data ----------
T('rendering media screens writes nothing to storage', Object.keys(h.store).length === 0);

console.log(fail === 0 ? '\nALL MEDIA CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
