(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { tests: 0, primes: 0, composites: 0, lastTime: 0, dataset: [], datasetName: '', results: [] };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nowStamp = () => new Date().toLocaleTimeString('en-GB', {hour12:false});
  const log = (message, type='muted') => {
    const line = document.createElement('div'); line.className = `log-line ${type}`;
    const time = document.createElement('span'); time.textContent = nowStamp();
    const code = document.createElement('code'); code.textContent = message;
    line.append(time, code); $('traceLog').append(line); $('traceLog').scrollTop = $('traceLog').scrollHeight;
  };
  const setProgress = (pct, message) => { $('progressFill').style.width = `${pct}%`; $('progressPercent').textContent = `${pct}%`; $('progressMessage').textContent = message; };
  const setStep = (id, status) => {
    const el = $(id); el.classList.remove('active','done');
    el.querySelector('.step-check').textContent = status === 'done' ? '✓' : status === 'active' ? '◌' : '○';
    el.querySelector('.step-state').textContent = status.toUpperCase();
    if (status === 'done') el.classList.add('done'); if (status === 'active') el.classList.add('active');
  };
  const resetTrace = () => {
    ['stepValidate','stepDecompose','stepBases','stepModular','stepWitness','stepComplete'].forEach(id => setStep(id,'waiting'));
    setProgress(0,'Preparing computation trace…'); $('traceState').textContent='RUNNING';
  };
  const finishTrace = () => { $('traceState').textContent='COMPLETE'; };
  const updateMetrics = () => { $('metricTests').textContent=state.tests; $('metricPrimes').textContent=state.primes; $('metricComposites').textContent=state.composites; $('metricTime').textContent=state.lastTime ? state.lastTime.toFixed(3) : '—'; };
  const validInteger = value => /^[-+]?\d+$/.test(value.trim());
  const modPow = (base, exponent, modulus) => {
    let result = 1n; base %= modulus;
    while (exponent > 0n) { if (exponent & 1n) result = result * base % modulus; exponent >>= 1n; if (exponent) base = base * base % modulus; }
    return result;
  };
  const randomBigIntBelow = max => {
    if (max <= 1n) return 0n;
    const bits = max.toString(2).length; let out;
    do {
      let binary = '';
      while (binary.length < bits) binary += Math.floor(Math.random()*0x100000000).toString(2).padStart(32,'0');
      out = BigInt('0b'+binary.slice(0,bits));
    } while (out >= max);
    return out;
  };
  const randomBase = n => 2n + randomBigIntBelow(n - 3n);
  const deterministicBases = [2n,3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n,41n,43n,47n,53n,59n,61n,67n,71n,73n,79n,83n,89n,97n];
  // The test returns composite immediately when a Miller–Rabin witness is found.
  function millerRabin(n, k, mode, progressCb) {
    if (n < 2n) return {prime:false, reason:'Numbers below 2 are not prime.', witness:null, roundsRun:0, d:null, s:0, bases:[]};
    const small = [2n,3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n];
    if (small.includes(n)) return {prime:true, reason:'Matched a small known prime.', witness:null, roundsRun:0, d:null, s:0, bases:[]};
    for (const p of small) if (n % p === 0n) return {prime:false, reason:`Divisible by small prime ${p}.`, witness:{base:null, factor:p.toString()}, roundsRun:0, d:null, s:0, bases:[]};
    if (n % 2n === 0n) return {prime:false, reason:'Even integer greater than 2.', witness:{base:null,factor:'2'}, roundsRun:0,d:null,s:0,bases:[]};
    let d = n - 1n, s = 0; while ((d & 1n) === 0n) { d >>= 1n; s++; }
    const bases = []; let roundsRun = 0;
    for (let i=0; i<k; i++) {
      let a;
      if (mode === 'deterministic') a = deterministicBases[i % deterministicBases.length] % (n - 3n) + 2n;
      else a = randomBase(n);
      bases.push(a.toString()); roundsRun++;
      const x0 = modPow(a,d,n);
      if (progressCb) progressCb({i, k, a, d, s, x0, stage:'power'});
      if (x0 === 1n || x0 === n-1n) continue;
      let x = x0, passed = false;
      for (let r=1; r<s; r++) {
        x = x*x % n;
        if (progressCb) progressCb({i,k,a,d,s,x,stage:'square',r});
        if (x === n-1n) { passed = true; break; }
        if (x === 1n) break;
      }
      if (!passed) return {prime:false, reason:`Base ${a} is a Miller–Rabin witness: this round proves n is composite.`, witness:{base:a.toString(), value:x0.toString(), factor:null}, roundsRun, d:d.toString(), s, bases};
    }
    return {prime:true, reason:'Passed all selected Miller–Rabin rounds.', witness:null, roundsRun, d:d.toString(), s, bases};
  }
  const confidenceFor = (k, result) => result.prime ? (1 - Math.pow(4,-k))*100 : 100;
  const formatError = k => {
    const e = Math.pow(4,-k);
    if (e === 0) return '≤ 0 (below floating-point display range)';
    if (e >= .001) return `≤ ${e.toPrecision(4)}`;
    return `≤ ${e.toExponential(3)}`;
  };
  async function runSingle(raw, rounds, mode, isBatch=false) {
    if (!validInteger(raw)) throw new Error('Enter a whole integer using digits only (an optional + or - sign is allowed).');
    const n = BigInt(raw.trim());
    resetTrace();
    const btn = $('analyzeBtn'); if (!isBatch) { btn.disabled=true; btn.querySelector('span').textContent='Computing…'; }
    const start = performance.now();
    try {
      setStep('stepValidate','active'); log(`Input received: ${raw.trim()}`); await sleep(130);
      setStep('stepValidate','done'); setProgress(12,'Input parsed exactly as BigInt.');
      setStep('stepDecompose','active'); log('Parsed integer without floating-point conversion.');
      if (n >= 5n && (n & 1n) === 1n) { let d=n-1n,s=0; while((d&1n)===0n){d>>=1n;s++;} log(`Decomposition: n − 1 = 2^${s} × ${d}.`,'good'); }
      else log('Checking small-number and divisibility edge cases.','warn');
      await sleep(130); setStep('stepDecompose','done'); setProgress(28,'Prepared n − 1 decomposition.');
      setStep('stepBases','active'); log(`Preparing up to ${rounds} round(s) using ${mode==='random'?'random':'fixed demonstration'} bases.`);
      await sleep(100); setStep('stepBases','done'); setStep('stepModular','active'); setProgress(42,'Running modular exponentiation and repeated squaring…');
      let lastLoggedRound=-1;
      const result = millerRabin(n,rounds,mode,ev=>{
        if (ev.i !== lastLoggedRound) { lastLoggedRound=ev.i; log(`Round ${ev.i+1}/${rounds}: base a = ${ev.a}; computing a^d mod n.`); }
        if (ev.stage==='power') log(`a^d mod n = ${ev.x0}.`, 'muted');
        else log(`Repeated square r=${ev.r}: x = ${ev.x}.`, 'muted');
      });
      await sleep(100); setStep('stepModular','done'); setStep('stepWitness','active'); setProgress(80,'Checking round outcomes and witnesses…');
      if (result.prime) log(`All executed rounds passed. ${result.roundsRun} round(s) checked.`, 'good');
      else log(result.reason, 'bad');
      await sleep(100); setStep('stepWitness','done'); setStep('stepComplete','active');
      const elapsed=performance.now()-start; result.elapsed=elapsed; result.n=raw.trim(); result.k=rounds; result.mode=mode; result.confidence=confidenceFor(rounds,result); result.error=formatError(rounds);
      if (!isBatch) renderResult(result);
      await sleep(100); setStep('stepComplete','done'); setProgress(100,'Analysis report generated.'); finishTrace();
      log(`Finished in ${elapsed.toFixed(3)} ms.`, 'good');
      if (!isBatch) { state.tests++; if(result.prime) state.primes++; else state.composites++; state.lastTime=elapsed; updateMetrics(); }
      return result;
    } finally {
      if (!isBatch) { btn.disabled=false; btn.querySelector('span').textContent='Run primality test'; }
    }
  }
  function renderResult(r) {
    $('resultEmpty').classList.add('hidden'); $('resultContent').classList.remove('hidden');
    $('reportId').textContent='PG—'+Math.floor(1000+Math.random()*9000);
    $('resultSymbol').textContent=r.prime?'✓':'×'; $('resultSymbol').classList.toggle('composite',!r.prime);
    $('resultLabel').textContent=r.prime?'PROBABLE PRIME':'COMPOSITE'; $('resultLabel').classList.toggle('composite',!r.prime);
    $('resultTitle').textContent=r.prime?'Number is probably prime':'Number is composite';
    $('resultSubtitle').textContent=r.reason;
    $('resultNumber').textContent=r.n; $('resultTime').textContent=`${r.elapsed.toFixed(3)} ms`; $('resultRounds').textContent=`${r.roundsRun}/${r.k}`;
    $('resultConfidence').textContent=`${r.confidence.toFixed(r.prime?4:2)}%`; $('errorBound').textContent=`≤ 4⁻${r.k}`; $('errorDecimal').textContent=r.prime?r.error:'≤ 0 (composite detected)';
    $('boundFill').style.width=`${Math.min(100,r.confidence)}%`;
    $('witnessTag').textContent=r.witness?(r.witness.factor?'FACTOR FOUND':'WITNESS FOUND'):'NONE';
    $('witnessTag').classList.toggle('bad-tag',!!r.witness);
    $('witnessText').textContent=r.witness?(r.witness.factor?`Small-prime factor: ${r.witness.factor}. ${r.reason}`:`Witness base a = ${r.witness.base}; initial value aᵈ mod n = ${r.witness.value}. ${r.reason}`):`${r.reason} ${r.bases.length?`Bases tested: ${r.bases.join(', ')}.`:''}`;
  }
  $('analyzeBtn').addEventListener('click', async()=>{
    const rounds=Math.max(1,Math.min(50,parseInt($('roundsInput').value,10)||1)); $('roundsInput').value=rounds;
    try { await runSingle($('numberInput').value,rounds,$('modeSelect').value,false); }
    catch(e){ log(e.message,'bad'); $('traceState').textContent='INPUT ERROR'; setProgress(0,e.message); alert(e.message); }
  });
  document.querySelectorAll('.example-chip').forEach(btn=>btn.addEventListener('click',()=>{$('numberInput').value=btn.dataset.number;$('numberInput').focus();}));
  $('clearInput').addEventListener('click',()=>{$('numberInput').value='';$('numberInput').focus();});
  $('roundMinus').addEventListener('click',()=>{$('roundsInput').value=Math.max(1,(parseInt($('roundsInput').value,10)||1)-1);});
  $('roundPlus').addEventListener('click',()=>{$('roundsInput').value=Math.min(50,(parseInt($('roundsInput').value,10)||1)+1);});
  $('clearLog').addEventListener('click',()=>{$('traceLog').replaceChildren();log('Log cleared. Ready for the next run.');});

  function parseCSV(text) {
    const rows=[]; let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;}
    row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);return rows;
  }
  function parseDataset(content, filename) {
    const ext=filename.toLowerCase().split('.').pop(); let headers=[], records=[];
    if(ext==='json'){
      const data=JSON.parse(content); const arr=Array.isArray(data)?data:(Array.isArray(data.data)?data.data:null);
      if(!arr) throw new Error('JSON must contain an array of numbers or an array of objects (or a data array).');
      if(arr.length&&typeof arr[0]==='object'&&arr[0]!==null){headers=Object.keys(arr[0]);records=arr.map(o=>headers.map(h=>String(o[h]??'')));}
      else {headers=['number'];records=arr.map(v=>[String(v)]);}
    } else {
      const rows=parseCSV(content); if(!rows.length) throw new Error('The selected file appears to be empty.');
      const likelyHeader=rows[0].some(v=>/[a-zA-Z_]/.test(v));
      if(likelyHeader){headers=rows[0];records=rows.slice(1);}else{headers=['number'];records=rows.map(r=>[r[0]||'']);}
    }
    if(!headers.length) headers=['number'];
    state.dataset=records.map(row=>Object.fromEntries(headers.map((h,i)=>[h,String(row[i]??'').trim()])));
    state.datasetName=filename;
    const sel=$('columnSelect');sel.replaceChildren();
    headers.forEach((h,i)=>{const op=document.createElement('option');op.value=h;op.textContent=h;sel.append(op);});
    const preferred=headers.find(h=>/^(number|n|value|integer|prime_candidate|candidate|num)$/i.test(h.trim()))||headers.find(h=>/number|integer|candidate|prime|value|^n$/i.test(h))||headers[0];
    sel.value=preferred;sel.disabled=false;$('runDataset').disabled=false;
    $('datasetNotice').classList.remove('error');$('datasetNotice').textContent=`Loaded ${records.length} data row(s) from ${filename}. Select the column containing integer candidates.`;
    $('datasetNotice').classList.add('loaded');
    $('datasetSummary').classList.add('hidden');$('datasetTableWrap').classList.add('hidden');state.results=[];
  }
  async function loadFile(file) {
    if(!file)return;
    if(file.size>5*1024*1024){$('datasetNotice').textContent='File is larger than 5 MB. Please upload a smaller dataset.';$('datasetNotice').classList.add('error');return;}
    try{parseDataset(await file.text(),file.name);}
    catch(e){$('datasetNotice').textContent=`Could not read dataset: ${e.message}`;$('datasetNotice').classList.add('error');}
  }
  $('datasetFile').addEventListener('change',e=>loadFile(e.target.files[0]));
  const drop=$('dropZone');
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');loadFile(e.dataTransfer.files[0]);});
  $('downloadSample').addEventListener('click',()=>{
    const content='number,label\n2,small prime\n3,small prime\n4,even composite\n17,prime\n21,composite\n97,prime\n561,Carmichael composite\n1000000007,large probable prime\n170141183460469231731687303715884105727,large Mersenne candidate\n9999999967,large candidate\n';
    downloadFile(content,'sample_numbers.csv','text/csv');
  });
  $('runDataset').addEventListener('click',async()=>{
    const col=$('columnSelect').value;let rows=state.dataset;
    const limit=$('batchLimit').value;if(limit!=='all')rows=rows.slice(0,Number(limit));
    if(!rows.length){$('datasetNotice').textContent='No data rows to process.';return;}
    const btn=$('runDataset');btn.disabled=true;btn.textContent='Processing…';state.results=[];
    let primes=0,composites=0,skipped=0;const tbody=$('datasetTableBody');tbody.replaceChildren();
    $('datasetSummary').classList.remove('hidden');$('datasetTableWrap').classList.remove('hidden');
    $('dsProcessed').textContent='0';$('dsPrimes').textContent='0';$('dsComposites').textContent='0';$('dsSkipped').textContent='0';
    log(`Batch started: ${rows.length} row(s) from ${state.datasetName}.`,'good');
    const rounds=Math.max(1,Math.min(50,parseInt($('roundsInput').value,10)||1));
    for(let i=0;i<rows.length;i++){
      const value=String(rows[i][col]??'').trim();let r;
      try{
        if(!validInteger(value))throw new Error('Invalid integer');
        // Dataset rows use the same Miller–Rabin implementation; no fake results.
        const start=performance.now();const n=BigInt(value);const rawResult=millerRabin(n,rounds,$('modeSelect').value);
        r={...rawResult,n:value,k:rounds,elapsed:performance.now()-start,confidence:confidenceFor(rounds,rawResult),error:formatError(rounds)};
        if(r.prime)primes++;else composites++;
      }catch(e){r={n:value,prime:null,reason:e.message,roundsRun:0,k:rounds,elapsed:0};skipped++;}
      state.results.push(r);
      const tr=document.createElement('tr');
      const vals=[String(i+1),value,r.prime===null?'INVALID':r.prime?'PROBABLE PRIME':'COMPOSITE',`${r.roundsRun}/${rounds}`,r.elapsed.toFixed(3)+' ms',r.reason||''];
      vals.forEach((v,j)=>{const td=document.createElement('td');if(j===2){const badge=document.createElement('span');badge.className='table-result '+(r.prime===null?'invalid':r.prime?'':'comp');badge.textContent=v;td.append(badge);}else td.textContent=v;tr.append(td);});
      tbody.append(tr);
      $('dsProcessed').textContent=i+1;$('dsPrimes').textContent=primes;$('dsComposites').textContent=composites;$('dsSkipped').textContent=skipped;
      $('progressFill').style.width=`${Math.round((i+1)/rows.length*100)}%`;$('progressPercent').textContent=`${Math.round((i+1)/rows.length*100)}%`;$('progressMessage').textContent=`Dataset progress: ${i+1} of ${rows.length} row(s) processed`;$('traceState').textContent='BATCH RUN';
      if(i%4===0) await sleep(0);
    }
    log(`Batch complete: ${primes} probable prime(s), ${composites} composite(s), ${skipped} skipped.`,'good');
    $('traceState').textContent='BATCH COMPLETE';btn.disabled=false;btn.innerHTML='Analyze dataset <span>↗</span>';
    $('exportResults').disabled=false;
    updateMetrics();state.tests+=state.results.length;state.primes+=primes;state.composites+=composites;updateMetrics();
  });
  $('exportResults').addEventListener('click',()=>{
    const escape=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const rows=[['number','result','rounds_run','rounds_requested','runtime_ms','witness','detail']];
    state.results.forEach(r=>rows.push([r.n,r.prime===null?'INVALID':r.prime?'PROBABLE PRIME':'COMPOSITE',r.roundsRun,r.k,r.elapsed?.toFixed(3)??'',r.witness?.base??r.witness?.factor??'',r.reason??'']));
    downloadFile(rows.map(row=>row.map(escape).join(',')).join('\n'),'primeguard_results.csv','text/csv');
  });
  function downloadFile(content,name,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);}
  updateMetrics();
})();