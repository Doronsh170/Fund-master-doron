#!/usr/bin/env python3
"""On-demand MAYA performance refresh. Fails closed on unknown schemas or stale data."""
import argparse, datetime as dt, json, pathlib, re, sys, time
import requests

ROOT=pathlib.Path(__file__).resolve().parents[1]
PARTS=ROOT/"maya-performance"
PERIODS=("יום קודם","מתחילת החודש","מתחילת השנה","12 חודשים*")
def parse_part(path):
    raw=path.read_text(encoding="utf-8")
    match=re.search(r'const data=(\{.*?\});if\(typeof module',raw,re.S)
    if not match: raise ValueError(f"unrecognized part: {path}")
    return json.loads(match.group(1))
def get_json(url,session):
    for attempt in range(3):
        try:
            r=session.get(url,timeout=25,headers={"Accept":"application/json","Referer":"https://maya.tase.co.il/","User-Agent":"Mozilla/5.0 (compatible; FundUpdater/1.0)"})
            r.raise_for_status()
            return r.json()
        except (requests.RequestException,ValueError):
            if attempt==2: raise
            time.sleep(2**attempt)
def extract(payload):
    """Only known exact four-row shapes accepted; no calculations or inferences."""
    candidates=[payload]
    if isinstance(payload,dict):
        for key in ("data","result","fund","fundData","fundDetails"):
            if isinstance(payload.get(key),dict): candidates.append(payload[key])
    for node in candidates:
        if not isinstance(node,dict): continue
        rows=node.get("rows")
        asof=node.get("asOf")
        if isinstance(rows,list) and isinstance(asof,str) and len(rows)==4:
            if [r.get("period") for r in rows if isinstance(r,dict)]!=list(PERIODS): continue
            if all(isinstance(r.get("fund"),(int,float)) and not isinstance(r.get("fund"),bool) and -100<=r["fund"]<=10000 for r in rows):
                return {"rows":rows,"asOf":asof[:10],"name":node.get("name")}
    raise ValueError("API schema not recognized; refusing to publish unverified returns")
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--max-age",type=int,default=5)
    p.add_argument("--min-coverage",type=float,default=.90)
    args=p.parse_args()
    paths=sorted(PARTS.glob("part-*.js"))
    if len(paths)!=16: raise RuntimeError(f"Expected 16 parts, found {len(paths)}")
    old=[parse_part(path) for path in paths]
    all_records={k:v for part in old for k,v in part.items()}
    session=requests.Session()
    new={}
    failures=[]
    today=dt.datetime.now(dt.timezone.utc).date()
    for i,(number,rec) in enumerate(all_records.items(),1):
        url=rec.get("sourceApi")
        if not url or not url.startswith("https://maya.tase.co.il/api/v1/funds/"):
            failures.append((number,"missing source API"));new[number]=rec;continue
        try:
            payload=get_json(url,session)
            result=extract(payload)
            age=(today-dt.date.fromisoformat(result["asOf"])).days
            if not (0<=age<=args.max_age): raise ValueError(f"date age {age} days")
            if rec.get("name") and result.get("name"):
                # A number is authoritative; reject demonstrable name conflict.
                norm=lambda s: re.sub(r'[^\w]','',s.lower())
                if norm(rec["name"])!=norm(result["name"]): raise ValueError("name differs")
            new[number]={**rec,"rows":result["rows"],"asOf":result["asOf"],"status":"available","fetchedAt":dt.datetime.now(dt.timezone.utc).isoformat()}
        except Exception as exc:
            failures.append((number,str(exc)));new[number]=rec
        if i%200==0: print(f"Checked {i}/{len(all_records)}",flush=True)
    coverage=(len(all_records)-len(failures))/len(all_records)
    print(f"Successfully refreshed {len(all_records)-len(failures)}/{len(all_records)} ({coverage:.1%})")
    for item in failures[:30]: print("Not refreshed:",*item)
    if coverage<args.min_coverage: raise RuntimeError("Insufficient verified coverage: no files were changed")
    for path,original in zip(paths,old):
        chunk={k:new[k] for k in original}
        data=json.dumps(chunk,ensure_ascii=False,separators=(",",":"))
        path.write_text('(function(root){const data='+data+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else(root.FUND_PERFORMANCE_PARTS ||= []).push(data);})(typeof window==="undefined"?globalThis:window);',encoding="utf-8")
    report={"requestFailures":len(failures),"total":len(all_records),"generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"counts":{status:sum(r.get("status")==status for r in new.values()) for status in ("available","not-found","not-provided")}}
    pth=ROOT/"maya-performance-data.js"
    src=pth.read_text(encoding="utf-8")
    src,count=re.subn(r'const report=\{.*?\};const funds=',"const report="+json.dumps(report,ensure_ascii=False,separators=(",",":"))+";const funds=",src,count=1)
    if count!=1: raise RuntimeError("Report schema mismatch")
    pth.write_text(src,encoding="utf-8")
if __name__=="__main__": main()
