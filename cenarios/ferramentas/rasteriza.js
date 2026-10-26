const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const dir = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]); fs.mkdirSync(out, { recursive: true });
  const j = JSON.parse(fs.readFileSync(dir + '/base.json'));
  const b = await chromium.launch(); const p = await b.newPage();
  for (const c of j.camadas.filter(c => c.tipo === 'svg')) {
    await p.setViewportSize({ width: c.w, height: c.h });
    fs.writeFileSync(dir + '/x.html', `<html><body style="margin:0;background:transparent"><img src="${c.arq}" style="display:block;width:${c.w}px;height:${c.h}px"></body></html>`);
    await p.goto('file://' + dir + '/x.html'); await p.waitForTimeout(150);
    await p.screenshot({ path: out + '/' + c.id + '.png', omitBackground: true });
  }
  await b.close();
})();
