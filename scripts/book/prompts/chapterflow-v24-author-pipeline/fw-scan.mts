import { readFileSync } from "fs";
import { createHash } from "crypto";
import { readdirSync } from "fs";
const man=JSON.parse(readFileSync("logs/v24-scene-origin-validation/evidence/baseline/first-write-manifest.json","utf8"));
const dir="logs/v24-scene-origin-validation/evidence/chapters";
const files=readdirSync(dir);
const MECH: [string,RegExp][] = [["comes_back",/\bcome?s? back\b/i],["quietly",/\bquietly\b/i],["check_in",/\bcheck-in\b/i],["answers_for",/\banswers? for\b/i],["just_in_time",/\bjust (in time|before)\b/i],["half_works",/\bhalf-works|The move worked\b/i],["ledger",/\bledger|one column\b/i]];
const totals=new Map(MECH.map(([k])=>[k,0])); const chWith=new Map(MECH.map(([k])=>[k,0]));
for (let n=1;n<=12;n++){
  const nn=String(n).padStart(2,"0");
  const want=man.hashes[`ch${nn}`];
  let found=null;
  for(const f of files.filter(f=>f.startsWith(`range-ch${nn}.`))){
    const d=JSON.parse(readFileSync(`${dir}/${f}`,"utf8"));
    if(createHash("sha256").update(JSON.stringify(d)).digest("hex").slice(0,12)===want){found=d;break;}
  }
  if(!found){console.log(`ch${nn}: first-write snapshot NOT FOUND`);continue;}
  const b=found.breakdown||{};
  const prose=[found.hook,found.counterintuition,b.fastRead,b.deepRead,b.fullRead,...(found.examples||[]).flatMap((e:any)=>[e.title,e.scenario,e.whatToDo,e.whyItMatters])].filter(Boolean).join("\n");
  for(const [k,r] of MECH){const c=(prose.match(new RegExp(r.source,"gi"))||[]).length; totals.set(k,totals.get(k)!+c); if(c>0)chWith.set(k,chWith.get(k)!+1);}
}
console.log("FIRST-WRITE phrase kit — total hits (chapters carrying):");
for(const [k] of MECH) console.log(` ${k}: ${totals.get(k)} (${chWith.get(k)} ch)`);
