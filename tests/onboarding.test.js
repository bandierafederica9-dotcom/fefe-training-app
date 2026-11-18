// Onboarding: tutto a tocco tranne peso e altezza, e un profilo a metà non
// può dichiararsi completo. Solo dati sintetici.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

const PIENO = {
  name: 'Prova', goal: 'Forza', level: 'Intermedio', days: 4, duration: '45 minuti',
  location: 'Palestra', equipment: 'Manubri · Cavi', avoid: '', weight: '53', height: '150'
};

(async () => {
  const h = H(REPO);
  h.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});');

  // ---------- 1) La regola: un profilo a metà non è completo ----------
  T('un profilo pieno è completo', h.run('profileComplete(' + J(PIENO) + ')') === true);
  const required = JSON.parse(h.run('JSON.stringify(SETUP_REQUIRED)'));
  T('ogni campo obbligatorio, se manca, rende il profilo incompleto', required.every(k => {
    const p = Object.assign({}, PIENO); p[k] = (k === 'days' ? 0 : '');
    return h.run('profileComplete(' + J(p) + ')') === false;
  }), required.join(','));
  T('senza peso non è completo', h.run('profileComplete(' + J(Object.assign({}, PIENO, { weight: '' })) + ')') === false);
  T('senza altezza non è completo', h.run('profileComplete(' + J(Object.assign({}, PIENO, { height: '' })) + ')') === false);
  T('un peso a zero non conta come peso', h.run('profileComplete(' + J(Object.assign({}, PIENO, { weight: '0' })) + ')') === false);
  T('"da evitare" resta facoltativo', h.run('profileComplete(' + J(Object.assign({}, PIENO, { avoid: '' })) + ')') === true);
  T('il profilo vuoto di partenza non è completo', h.run('profileComplete(DEFAULT_PROFILE)') === false);

  // ---------- 2) Il bug segnalato: setupComplete regalato ----------
  // Il profilo reale era {name:"Fede", tutto il resto vuoto, setupComplete:true}.
  T('un profilo come quello trovato non può dirsi configurato',
    h.run('profileComplete({name:"Fede",goal:"",days:0,duration:"",level:"",location:"",equipment:"",avoid:"",setupComplete:true})') === false);
  T('setupFinish rifiuta di salvare un profilo incompleto', (() => {
    h.run('profile=getProfile();setupStart();setupDraft.goal="Forza";');
    const r = JSON.parse(h.run('JSON.stringify(setupFinish())'));
    return r.ok === false && h.run('profile.setupComplete') !== true;
  })());
  T('e non scrive niente mentre rifiuta', !h.store['fede:profile'] || !JSON.parse(h.store['fede:profile']).setupComplete);

  // ---------- 3) Si risponde toccando ----------
  const steps = JSON.parse(h.run('JSON.stringify(SETUP_STEPS)'));
  T('otto passi', steps.length === 8);
  T('solo l\'ultimo chiede di scrivere', steps.filter(s => s.measures).length === 1 && steps[steps.length - 1].measures === true);
  T('tutti gli altri offrono opzioni da toccare', steps.filter(s => !s.measures).every(s => Array.isArray(s.opts) && s.opts.length >= 3));
  T('attrezzatura e cosa evitare sono a scelta multipla',
    steps.find(s => s.k === 'equipment').multi === true && steps.find(s => s.k === 'avoid').multi === true);

  h.run('profile=getProfile();setupStart();setupStep=0;');
  const primo = h.run('setupHTML()');
  T('la prima domanda è l\'obiettivo', /Qual è il tuo obiettivo/.test(primo));
  T('le opzioni sono cinque pulsanti', (primo.match(/<button class="setup-opt/g) || []).length === 5);
  T('e ognuno è alto almeno 56px nel foglio di stile',
    /\.setup-opt\{[^}]*min-height:56px/.test(require('fs').readFileSync(REPO + '/assets/css/app.css', 'utf8')));
  T('non si prosegue senza rispondere', /data-setupnext="1" disabled/.test(primo));
  h.run('setupPick("goal","Forza",false);');
  T('scelta una risposta, si prosegue', !/data-setupnext="1" disabled/.test(h.run('setupHTML()')));
  T('e si può cambiare idea ritoccando', (() => {
    h.run('setupPick("goal","Forza",false);');
    return h.run('setupDraft.goal') === '';
  })());

  // scelta multipla
  h.run('setupDraft.goal="Forza";setupStep=5;setupPick("equipment","Manubri",true);setupPick("equipment","Cavi",true);');
  T('la scelta multipla accumula', h.run('setupDraft.equipment') === 'Manubri · Cavi');
  h.run('setupPick("equipment","Manubri",true);');
  T('e si toglie una voce per volta', h.run('setupDraft.equipment') === 'Cavi');

  // il passo facoltativo non blocca
  h.run('setupStep=6;');
  T('"da evitare" non blocca se non scegli niente', !/data-setupnext="1" disabled/.test(h.run('setupHTML()')));

  // ---------- 4) Le misure ----------
  h.run('setupStep=7;setupDraft.weight="";setupDraft.height="";');
  const mis = h.run('setupHTML()');
  T('le misure chiedono kg e cm, con le unità scritte', /su_weight/.test(mis) && /su_height/.test(mis) && />kg</.test(mis) && />cm</.test(mis));
  T('e dicono che sono gli unici numeri da scrivere', /unici due numeri da scrivere/.test(mis));
  T('senza misure non si chiude', /data-setupdone="1" disabled/.test(mis));
  h.run('setupDraft.weight="53";setupDraft.height="150";');
  T('con le misure si chiude', !/data-setupdone="1" disabled/.test(h.run('setupHTML()')));

  // ---------- 5) Il giro completo ----------
  {
    const hf = H(REPO);
    hf.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});profile=getProfile();setupStart();');
    hf.run('setupPick("goal","Forma a clessidra",false);setupPick("level","Intermedio",false);setupPick("days","4",false);');
    hf.run('setupPick("duration","45 minuti",false);setupPick("location","Palestra",false);setupPick("equipment","Manubri",true);');
    hf.run('setupDraft.weight="53";setupDraft.height="150";');
    const r = JSON.parse(hf.run('JSON.stringify(setupFinish())'));
    T('rispondendo a tutto il profilo si salva', r.ok === true, J(r));
    T('e solo allora risulta configurato', hf.run('profile.setupComplete') === true);
    T('i giorni diventano un numero, non un testo', hf.run('typeof profile.days') === 'number' && hf.run('profile.days') === 4);
    T('finisce davvero nello storage', (() => {
      hf.run('doSaveNow&&doSaveNow();');
      const p = JSON.parse(hf.store['fede:profile'] || '{}');
      return p.setupComplete === true && p.goal === 'Forma a clessidra' && p.weight === '53';
    })(), hf.store['fede:profile']);
    const hn = H(REPO);
    hn.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});profile=getProfile();setupStart();');
    hn.run('setupPick("goal","Forza",false);setupPick("level","Intermedio",false);setupPick("days","4",false);');
    hn.run('setupPick("duration","45 minuti",false);setupPick("location","Palestra",false);setupPick("equipment","Manubri",true);');
    hn.run('setupDraft.weight="53";setupDraft.height="150";setupFinish();');
    T('completare il profilo non tocca nessun giorno di allenamento',
      Object.keys(hn.store).filter(k => /^fede:\d{4}-/.test(k)).length === 0, Object.keys(hn.store).join(','));
    T('e scrive solo il profilo', Object.keys(hn.store).join(',') === 'fede:profile', Object.keys(hn.store).join(','));
  }

  // ---------- 6) L'invito compare solo se serve ----------
  {
    const hi = H(REPO);
    hi.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});profile=getProfile();');
    T('col profilo vuoto il Profilo invita a compilarlo', /data-setupopen="1"/.test(hi.run('profileHTML()')));
    hi.run('profile=Object.assign({},DEFAULT_PROFILE,' + J(PIENO) + ',{setupComplete:true});');
    T('col profilo pieno l\'invito sparisce', !/data-setupopen="1"/.test(hi.run('profileHTML()')));
  }

  // l'avviso segue il pulsante, non resta acceso a vuoto
  {
    const hh = H(REPO);
    hh.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});profile=getProfile();setupStart();setupStep=7;');
    T('senza misure l\'avviso si vede', !/id="su_hint"[^>]*display:none/.test(hh.run('setupHTML()')));
    hh.run('setupDraft.weight="53";setupDraft.height="150";');
    T('con le misure l\'avviso sparisce', /id="su_hint"[^>]*display:none/.test(hh.run('setupHTML()')));
  }

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
