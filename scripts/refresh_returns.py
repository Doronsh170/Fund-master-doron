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
def describe_shape(value,depth=0):
    if depth>=5: return type(value).__name__
    if isinstance(value,dict): return {k:describe_shape(v,depth+1) for k,v in list(value.items())[:35] if not any(t in k.lower() for t in ("token","secret","password","cookie"))}
    if isinstance(value,list): return {"length":len(value),"first":describe_shape(value[0],depth+1) if value else None}
    if isinstance(value,str): return {"type":"str","sample":value[:90]}
    return value
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--probe-only",action="store_true")
    p.add_argument("--max-age",type=int,default=5)
    p.add_argument("--min-coverage",type=float,default=.90)
    args=p.parse_args()
    paths=sorted(PARTS.glob("part-*.js"))
    if len(paths)!=16: raise RuntimeError(f"Expected 16 parts, found {len(paths)}")
    old=[parse_part(path) for path in paths]
    all_records={k:v for part in old for k,v in part.items()}
    session=requests.Session()
    # Probe one known fund before thousands of requests. Never publish on unknown schemas.
    sample=next((v for v in all_records.values() if v.get("status")=="available" and v.get("sourceApi")),None)
    if sample is None: raise RuntimeError("No fund with a valid source URL")
    sample_payload=get_json(sample["sourceApi"],session)
    if args.probe_only:
        diagnostic={"fund":sample["number"],"url":sample["sourceApi"],"response_shape":describe_shape(sample_payload)}
        (ROOT/"maya-api-diagnostic.json").write_text(json.dumps(diagnostic,ensure_ascii=False,indent=2),encoding="utf-8")
        print("One-fund MAYA response structure captured. No fund performance changed.",flush=True)
        return
    try:
        extract(sample_payload)
    except ValueError:
        diagnostic={"fund":sample["number"],"url":sample["sourceApi"],"response_shape":describe_shape(sample_payload)}
        print("MAYA_API_DIAGNOSTIC="+json.dumps(diagnostic,ensure_ascii=False),flush=True)
        raise RuntimeError("MAYA returned an unknown schema. Stopped after ONE request; no files changed.")
    new={}
    failures=[]
    today=dt.datetime.now(dt.timezone.utc).date()
    eligible={number:rec for number,rec in all_records.items() if rec.get("status")=="available"}
    if not eligible: raise RuntimeError("No previously available funds")
    for i,(number,rec) in enumerate(eligible.items(),1):
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
        if i%200==0: print(f"Checked {i}/{len(eligible)}",flush=True)
    coverage=(len(eligible)-len(failures))/len(eligible)
    print(f"Successfully refreshed {len(eligible)-len(failures)}/{len(eligible)} funds ({coverage:.1%})")
    for item in failures[:30]: print("Not refreshed:",*item)
    if coverage<args.min_coverage: raise RuntimeError("Insufficient verified coverage: no files were changed")
    if not any(new[k].get("asOf")!=record.get("asOf") for k,record in eligible.items()):
        raise RuntimeError("No newer verified return dates; keeping existing data")
    for path,original in zip(paths,old):
        chunk={k:new.get(k,all_records[k]) for k in original}
        data=json.dumps(chunk,ensure_ascii=False,separators=(",",":"))
        path.write_text('(function(root){const data='+data+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else(root.FUND_PERFORMANCE_PARTS ||= []).push(data);})(typeof window==="undefined"?globalThis:window);',encoding="utf-8")
    report={"requestFailures":len(failures),"total":len(all_records),"generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"counts":{status:sum(r.get("status")==status for r in (new.get(k,v) for k,v in all_records.items())) for status in ("available","not-found","not-provided")}}
    pth=ROOT/"maya-performance-data.js"
    src=pth.read_text(encoding="utf-8")
    src,count=re.subn(r'const report=\{.*?\};const funds=',"const report="+json.dumps(report,ensure_ascii=False,separators=(",",":"))+";const funds=",src,count=1)
    if count!=1: raise RuntimeError("Report schema mismatch")
    pth.write_text(src,encoding="utf-8")
if __name__=="__main__": main()
