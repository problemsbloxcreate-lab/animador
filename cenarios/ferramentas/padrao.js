const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const dir = path.resolve(process.argv[2]); const j = JSON.parse(fs.readFileSync(dir + '/cenario.json'));
  const html = `<html><body style="margin:0"><canvas id="c" width="1920" height="1080"></canvas><script>
  const j=${JSON.stringify(j)}; const fil=f=>f?\`brightness(\${f.luz/100}) contrast(\${f.con/100}) saturate(\${f.sat/100}) hue-rotate(\${f.mat}deg)\`:'none';
  (async()=>{const cv=document.getElementById('c'),g=cv.getContext('2d'); const t=document.createElement('canvas');t.width=1920;t.height=1080;const x=t.getContext('2d');
  for(const c of j.camadas){ if(c.oculta) continue; const im=new Image(); im.src=c.arq; await im.decode();
    x.save(); x.filter=fil(c.fx); x.translate(c.cx,c.cy); x.rotate((c.r||0)*Math.PI/180); if(c.flip) x.scale(-1,1); x.drawImage(im,-c.w*c.s/2,-c.h*c.s/2,c.w*c.s,c.h*c.s); x.restore(); }
  g.filter=fil(j.cena); g.drawImage(t,0,0); document.title='ok';})();</script></body></html>`;
  fs.writeFileSync(dir + '/_p.html', html);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + dir + '/_p.html'); await p.waitForFunction(() => document.title === 'ok', null, { timeout: 30000 });
  await p.screenshot({ path: process.argv[3] }); await b.close(); fs.unlinkSync(dir + '/_p.html');
})();
