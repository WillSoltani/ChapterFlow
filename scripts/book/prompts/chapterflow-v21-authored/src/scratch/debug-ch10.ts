import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runShipGate } from '../critics/finalGate.js';

const chapter = JSON.parse(readFileSync(resolve('state/chapters/competing-against-luck-ch10.v21-native.chapter.json'), 'utf8'));
const report = runShipGate(chapter);
for (const f of [...report.majors, ...report.minors]) {
  console.log('[' + f.severity + '] [' + f.catalogId + '] ' + f.unit + ': ' + f.message.slice(0,250));
}
