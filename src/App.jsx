import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Download, Upload, Plus, Trash2, Copy, Printer, CalendarPlus, Save } from "lucide-react";
import { motion } from "framer-motion";

// === Helpers ===
const DEFAULT_DAYS = ["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"];

function pad(n){ return n.toString().padStart(2, "0"); }

function genTimeSlots(start="12:00", end="22:00", stepMins=30){
  // returns ["12:00","12:30",...]
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startM = sh*60+sm;
  const endM = eh*60+em;
  const out = [];
  for(let m=startM; m<=endM; m+=stepMins){
    const h = Math.floor(m/60);
    const mm = m%60;
    out.push(`${pad(h)}:${pad(mm)}`);
  }
  return out;
}

function to12hLabel(time){
  // time "HH:MM" -> Arabic 12h like "12:00 ظهرًا", "09:30 مساءً"
  const [hS,mS] = time.split(":");
  let h = parseInt(hS,10);
  const m = mS;
  const isPM = h>=12;
  const period = isPM ? "مساءً" : "صباحًا";
  const h12 = h%12 === 0 ? 12 : h%12;
  // Special label for 12:00
  let special = null;
  if(h===12 && m==="00") special = "ظهرًا";
  const label = `${pad(h12)}:${m} ${special?special:period}`;
  return label;
}

const emptyGrid = (days, times)=>{
  const data = {};
  days.forEach(d=>{
    data[d] = {};
    times.forEach(t=> data[d][t] = "");
  });
  return data;
};

const STORAGE_KEY = "teacher_timetable_v1";

export default function TeacherTimetableApp(){
  const [rtl, setRtl] = useState(true);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("22:00");
  const [step, setStep] = useState(30);
  const times = useMemo(()=> genTimeSlots(start,end,step), [start,end,step]);
  const [grid, setGrid] = useState(()=> emptyGrid(DEFAULT_DAYS, genTimeSlots("12:00","22:00",30)));
  const [use12h, setUse12h] = useState(true);
  const [newDay, setNewDay] = useState("");
  const [history, setHistory] = useState([]); // archive of past weeks

  // Load from localStorage
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        setRtl(parsed.rtl ?? true);
        setDays(parsed.days ?? DEFAULT_DAYS);
        setStart(parsed.start ?? "12:00");
        setEnd(parsed.end ?? "22:00");
        setStep(parsed.step ?? 30);
        setGrid(parsed.grid ?? emptyGrid(DEFAULT_DAYS, genTimeSlots("12:00","22:00",30)));
        setUse12h(parsed.use12h ?? true);
        setHistory(parsed.history ?? []);
      }
    }catch(e){
      console.error(e);
    }
  },[]);

  // Reconcile grid if time/day structure changes
  useEffect(()=>{
    setGrid(prev=>{
      const next = emptyGrid(days, times);
      // copy over any existing values
      days.forEach(d=>{
        times.forEach(t=>{
          next[d][t] = prev?.[d]?.[t] ?? "";
        });
      });
      return next;
    });
  },[days, times.length]);

  // Persist
  useEffect(()=>{
    const payload = { rtl, days, start, end, step, grid, use12h, history };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  },[rtl, days, start, end, step, grid, use12h, history]);

  const addDay = ()=>{
    if(!newDay.trim()) return;
    if(days.includes(newDay.trim())) return;
    setDays(prev=> [newDay.trim(), ...prev]);
    setNewDay("");
  };

  const removeDay = (d)=>{
    setDays(prev=> prev.filter(x=> x!==d));
  };

  const addTimeSlot = (time)=>{
    // insert if not exists, keep sorted
    const all = new Set(times);
    if(all.has(time)) return;
    const allTimes = [...times, time].sort();
    // update by changing start/end to min/max and step stays; fallback keep custom
    setGrid(prev=>{
      const next = emptyGrid(days, allTimes);
      days.forEach(d=>{
        allTimes.forEach(t=>{
          next[d][t] = prev?.[d]?.[t] ?? "";
        });
      });
      return next;
    });
  };

  const onCellChange = (day, time, value)=>{
    setGrid(prev=> ({...prev, [day]: { ...prev[day], [time]: value }}));
  };

  const exportJSON = ()=>{
    const blob = new Blob([JSON.stringify({days, times, grid}, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timetable.json";
    a.click();
  };

  const exportCSV = ()=>{
    const headers = ["اليوم", ...times.map(t=> use12h ? to12hLabel(t) : t)];
    const rows = days.map(d=> [d, ...times.map(t=> (grid[d]?.[t] ?? "").replace(/\n/g," "))]);
    const csv = [headers, ...rows].map(r=> r.map(v=> `"${(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timetable.csv";
    a.click();
  };

  const importJSON = (file)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const obj = JSON.parse(e.target.result);
        if(obj.days && obj.times && obj.grid){
          setDays(obj.days);
          // keep current start/end/step but rebuild grid to those times from file
          setGrid(emptyGrid(obj.days, obj.times));
          setTimeout(()=>{
            setGrid(obj.grid);
          },0);
        }
      }catch(err){ alert("ملف غير صالح"); }
    };
    reader.readAsText(file);
  };

  const newWeek = ()=>{
    // archive current then clear values keeping structure
    setHistory(h=>[{ timestamp: Date.now(), days:[...days], times:[...times], grid: JSON.parse(JSON.stringify(grid)) }, ...h]);
    setGrid(prev=>{
      const cleared = emptyGrid(days, times);
      return cleared;
    });
  };

  const printView = ()=>{
    window.print();
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-50" dir={rtl?"rtl":"ltr"}>
      <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}>
        <Card className="max-w-full shadow-lg">
          <CardHeader className="space-y-4">
            <CardTitle className="text-2xl font-bold">جدول المدرّس الأسبوعي</CardTitle>
            <div className="flex flex-wrap gap-2 items-center no-print">
              <Button onClick={()=>setRtl(v=>!v)} variant="secondary">اتجاه: {rtl?"يمين ← يسار":"يسار ← يمين"}</Button>
              <div className="flex items-center gap-2">
                <span className="text-sm">طريقة الوقت</span>
                <Switch checked={use12h} onCheckedChange={setUse12h} />
                <span className="text-sm">{use12h?"12 ساعة":"24 ساعة"}</span>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary"><CalendarPlus className="w-4 h-4 mr-2"/>إعدادات الوقت</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>نطاق الزمن وحجم التقسيم</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm">من</label>
                      <Input value={start} onChange={e=>setStart(e.target.value)} placeholder="HH:MM"/>
                    </div>
                    <div>
                      <label className="text-sm">إلى</label>
                      <Input value={end} onChange={e=>setEnd(e.target.value)} placeholder="HH:MM"/>
                    </div>
                    <div>
                      <label className="text-sm">كل (دقيقة)</label>
                      <Input type="number" value={step} onChange={e=>setStep(parseInt(e.target.value||"30",10))}/>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={newWeek}><Copy className="w-4 h-4 mr-2"/>أسبوع جديد (نفس القالب)</Button>
              <Button onClick={printView} variant="outline"><Printer className="w-4 h-4 mr-2"/>طباعة</Button>
              <Button onClick={exportJSON} variant="outline"><Download className="w-4 h-4 mr-2"/>تصدير JSON</Button>
              <Button onClick={exportCSV} variant="outline"><Download className="w-4 h-4 mr-2"/>تصدير CSV</Button>
              <label className="cursor-pointer flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-xl border"><Upload className="w-4 h-4"/>استيراد JSON
                <input type="file" accept="application/json" className="hidden" onChange={(e)=> e.target.files && importJSON(e.target.files[0])}/>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day controls */}
            <div className="mb-4 flex flex-wrap gap-2 items-end no-print">
              <div className="flex flex-col gap-1">
                <label className="text-sm">إضافة يوم</label>
                <div className="flex gap-2">
                  <Input placeholder="مثال: السبت المسائي" value={newDay} onChange={e=>setNewDay(e.target.value)} className="w-56"/>
                  <Button onClick={addDay}><Plus className="w-4 h-4 mr-2"/>إضافة</Button>
                </div>
              </div>
              {days.length>0 && (
                <div className="flex gap-2 flex-wrap">
                  {days.map(d=> (
                    <Button key={d} variant="destructive" onClick={()=>removeDay(d)} className="text-xs"><Trash2 className="w-4 h-4 mr-1"/>حذف {d}</Button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid */}
            <div className="overflow-auto border rounded-2xl shadow-sm">
              <div className="min-w-[900px]">
                <div className="grid" style={{gridTemplateColumns: `200px repeat(${times.length}, minmax(120px, 1fr))`}}>
                  {/* Header row */}
                  <div className="sticky top-0 z-20 bg-white border-b p-3 font-semibold">اليوم / الوقت</div>
                  {times.map((t)=> (
                    <div key={t} className="sticky top-0 z-20 bg-white border-b p-3 text-center text-sm">
                      {use12h ? to12hLabel(t) : t}
                    </div>
                  ))}
                  {/* Rows */}
                  {days.map((d)=> (
                    <React.Fragment key={d}>
                      <div className="sticky right-0 bg-white z-10 border-b p-3 font-medium">{d}</div>
                      {times.map((t)=> (
                        <div key={`${d}-${t}`} className="border-b p-0">
                          <Textarea
                            value={grid[d]?.[t] ?? ""}
                            onChange={(e)=> onCellChange(d,t,e.target.value)}
                            placeholder="اكتب الدرس/الملاحظة هنا"
                            className="w-full h-20 resize-none rounded-none focus-visible:ring-0 focus:outline-none border-0"
                          />
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom time slot adder */}
            <div className="mt-4 flex items-center gap-2 no-print">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary"><Plus className="w-4 h-4 mr-2"/>إضافة وقت مخصص</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>إضافة خانة زمنية</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">أدخل الوقت بصيغة 24 ساعة مثل 10:30 أو 14:00</p>
                    <Input id="custom-time" placeholder="HH:MM" />
                    <Button onClick={()=>{
                      const el = document.getElementById("custom-time");
                      const val = (el?.value || "").trim();
                      if(!/^\d{2}:\d{2}$/.test(val)) { alert("صيغة غير صحيحة"); return; }
                      addTimeSlot(val);
                    }}>إضافة</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* History */}
            {history.length>0 && (
              <div className="mt-6 no-print">
                <h3 className="font-semibold mb-2">الأرشيف (أسابيع سابقة)</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {history.map((h,i)=> (
                    <Card key={i} className="border-dashed">
                      <CardHeader>
                        <CardTitle className="text-base">أسبوع محفوظ: {new Date(h.timestamp).toLocaleString()}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-600">أيام: {h.days.join("، ")}</div>
                        <div className="text-sm text-gray-600">خانات وقت: {h.times.length}</div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={()=>{
                            setDays(h.days);
                            setGrid(h.grid);
                          }}><Save className="w-4 h-4 mr-2"/>استرجاع</Button>
                          <Button size="sm" variant="destructive" onClick={()=> setHistory(prev=> prev.filter((_,idx)=> idx!==i))}><Trash2 className="w-4 h-4 mr-2"/>حذف</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}