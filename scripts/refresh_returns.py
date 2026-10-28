#!/usr/bin/env python3
"""Refresh fund NAV price changes from Maya's historical redemption-price CSV.
NAV changes do not include reinvested distributions. Do not mix with old category returns.
"""
import argparse, concurrent.futures, csv, datetime as dt, io, json, pathlib, re, time
import requests

ROOT=pathlib.Path(__file__).resolve().parents[1]
PARTS=ROOT/"maya-performance"
PERIODS=("יום קודם","מתחילת החודש","מתחילת השנה","12 חודשים")
def parse_part(path):
    m=re.search(r"const data=(\{.*?\});if\(typeof module",path.read_text(encoding="utf-8"),re.S)
    if not m: raise RuntimeError("Unrecognized performance part "+str(path))
    return json.loads(m.group(1))
def price_history(number,rec,today):
    api=rec.get("sourceApi","")
    if not api.startswith("https://maya.tase.co.il/api/v1/funds/"):
        raise ValueError("Untrusted or missing API url")
    url=api+"/history/file"
    frm=dt.date(today.year-2,1,1)
    params={"pageSize":900,"pageNumber":1,"period":4,
            "fromDate":frm.isoformat()+"T00:00:00.000Z",
            "toDate":(today+dt.timedelta(days=1)).isoformat()+"T00:00:00.000Z"}
    for attempt in range(3):
        try:
            res=requests.post(url,json=params,headers={"Origin":"https://maya.tase.co.il","Referer":"https://maya.tase.co.il/","Accept":"text/csv","User-Agent":"Mozilla/5.0"},timeout=35)
            res.raise_for_status()
            rows=list(csv.reader(io.StringIO(res.content.decode("utf-8-sig"))))
            if len(rows)<3 or "תאריך" not in rows[0] or "מחיר פדיון" not in rows[0]:
                raise ValueError("Unexpected historical CSV headers")
            coldate=rows[0].index("תאריך")
            colprice=rows[0].index("מחיר פדיון")
            colnumber=rows[0].index("מס' קרן")
            result={}
            for row in rows[1:]:
                if len(row)<=max(coldate,colprice,colnumber):continue
                if str(int(row[colnumber]))!=str(int(number)):
                    raise ValueError("Fund identifier mismatch")
                date=dt.datetime.strptime(row[coldate],"%d.%m.%Y").date()
                price=float(row[colprice].replace(",",""))
                if price<=0:raise ValueError("Non-positive redemption price")
                if date<=today:result[date]=price
            if len(result)<3:raise ValueError("Insufficient NAV history")
            return result
        except (requests.RequestException,ValueError) as exc:
            if attempt==2:raise
            time.sleep(attempt+1)
def calculate(number,record,today,max_age):
    nav=price_history(number,record,today)
    dates=sorted(nav)
    end=dates[-1]
    if not 0<=(today-end).days<=max_age:raise ValueError("Stale latest NAV date "+str(end))
    previous=dates[-2]
    def baseline(anchor,maxgap=8):
        candidates=[d for d in dates if d<=anchor]
        if not candidates:return None
        date=candidates[-1]
        return date if (anchor-date).days<=maxgap else None
    anchors=[previous,baseline(end.replace(day=1)-dt.timedelta(days=1)),
             baseline(dt.date(end.year-1,12,31)),baseline(end.replace(year=end.year-1))]
    changes=[]
    for period,base in zip(PERIODS,anchors):
        value=round((nav[end]/nav[base]-1)*100,6) if base is not None else None
        changes.append({"period":period,"fund":value,"classification":None,"remark":None})
    if sum(row["fund"] is not None for row in changes)<3:
        raise ValueError("Too few verified return periods")
    return number,{**record,"rows":changes,"asOf":end.isoformat(),"status":"available",
                   "returnMethod":"nav-price-change","fetchedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
                   "refreshWarning":False}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--max-age",type=int,default=5)
    p.add_argument("--min-coverage",type=float,default=.75)
    args=p.parse_args()
    paths=sorted(PARTS.glob("part-*.js"))
    if len(paths)!=16:raise RuntimeError("Expected 16 performance files")
    parts=[parse_part(path) for path in paths]
    existing={k:v for part in parts for k,v in part.items()}
    eligible={k:v for k,v in existing.items() if v.get("status")=="available"}
    today=dt.datetime.now(dt.timezone.utc).date()
    updated={}
    errors={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        jobs={pool.submit(calculate,k,v,today,args.max_age):k for k,v in eligible.items()}
        for job in concurrent.futures.as_completed(jobs):
            k=jobs[job]
            try:key,result=job.result();updated[key]=result
            except Exception as exc:errors[k]=str(exc)
    coverage=len(updated)/len(eligible)
    print(f"Verified NAV updates: {len(updated)}/{len(eligible)} ({coverage:.1%})",flush=True)
    for k,error in list(errors.items())[:25]:print("Not refreshed",k,error,flush=True)
    if coverage<args.min_coverage:raise RuntimeError("Below minimum verified coverage; no changes published")
    newer=sum(v.get("asOf")!=eligible[k].get("asOf") for k,v in updated.items())
    if not newer:raise RuntimeError("No new dates verified; nothing to publish")
    for path,part in zip(paths,parts):
        chunk={k:updated.get(k,v) for k,v in part.items()}
        data=json.dumps(chunk,ensure_ascii=False,separators=(",",":"))
        path.write_text('(function(root){const data='+data+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else(root.FUND_PERFORMANCE_PARTS ||= []).push(data);})(typeof window==="undefined"?globalThis:window);',encoding="utf-8")
    report={"requestFailures":len(errors),"total":len(existing),
            "generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
            "updatedNavCount":len(updated),"returnMethod":"nav-price-change",
            "counts":{status:sum((updated.get(k,v)).get("status")==status for k,v in existing.items()) for status in ("available","not-found","not-provided")}}
    reportpath=ROOT/"maya-performance-data.js"
    source=reportpath.read_text(encoding="utf-8")
    source,count=re.subn(r"const report=\{.*?\};const funds=",
                         "const report="+json.dumps(report,ensure_ascii=False,separators=(",",":"))+";const funds=",source,count=1)
    if count!=1:raise RuntimeError("Cannot update report summary")
    reportpath.write_text(source,encoding="utf-8")
if __name__=="__main__":main()
