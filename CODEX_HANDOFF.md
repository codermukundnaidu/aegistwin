# AEGIS-TWIN — Codex Handoff

## How to use this file
Paste the **System Context** block first in your Codex session, then paste the **Full Source** block.
Everything you need is here — no other files required.

---

## System Context (paste this first)

You are continuing development of **AEGIS-TWIN**, a single-file browser demo of a CubeSat
Fault Detection, Isolation & Recovery (FDIR) system.

**What it is:**
A React 18 (CDN, no build step) + Tailwind Play CDN + Babel Standalone dashboard in one HTML file.
It simulates onboard spacecraft FDIR: the satellite detects a fault while out of ground contact,
wakes an Edge-AI coprocessor, runs three candidate recovery branches through a digital twin,
gates them through deterministic physics checks, executes only the safe template, then logs a
compact 128-byte XAI explanation instead of 4.2 MB of raw telemetry.

**Core state machine:**
NOMINAL → ANOMALY_DETECTED → SANDBOX_EVALUATION → RECOVERY_VERIFIED

**Three injectable scenarios:**
- ADCS Thermal Runaway (battT spikes to 85.4°C, busV drops to 4.2V)
- SEU Bit-Flip / Radiation (SOC drops to 22%, busV drops to 5.8V)
- Unknown Sensor Corruption (fLoad spikes to 9.8W, battT 58°C)

**Panel layout (single screen, no scroll, 60 FPS):**
- Top strip: mission ID, master state LED, AI coprocessor state LED, downlink savings readout
- Left "Arena": 7 telemetry sliders with floor/ceil limits, live 3×2 readout grid, safety gate,
  3 fault injection buttons
- Center: Canvas orbit simulator (rAF loop, wireframe globe, satellite tracking, silence arc) +
  Hardware twin schematic (SVG animateMotion data-flow particles, watchdog ring countdown)
- Right: Ghost Futures (3 branches: α PASS, β PASS/SELECTED, γ BLOCKED) + XAI log with
  auto-scroll, color-coded sources (OBC/WATCHDOG/AI/TWIN/SAFETY GATE)

**Theme:** #070A12 bg · #0F172A panels · Cyan #00F0FF · Emerald #10B981 · Crimson #F43F5E ·
Amber #F59E0B · Purple #A78BFA · Fonts: Inter (UI) + JetBrains Mono (telemetry/terminal)

**Key architectural constraints:**
- `h-screen w-screen overflow:hidden` — zero layout shift
- All timers stored in `timers.current[]`, cleared on reset
- `requestAnimationFrame` canvas loop with `cancelAnimationFrame` cleanup
- Watchdog countdown via `setInterval` at 50ms, computing remaining from elapsed ratio

---

## Full Source

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AEGIS-TWIN // ORBITAL FDIR MISSION CONTROL</title>
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
:root{
  --void:#070A12;--panel:#0F172A;--panel2:#0d1526;--border:#1E293B;
  --cyan:#00F0FF;--emerald:#10B981;--crimson:#F43F5E;--amber:#F59E0B;
  --purple:#A78BFA;--blue:#4FC3F7;--slate:#64748B;
}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;overflow:hidden;background:var(--void);color:#c8d8e8;font-family:'Inter',sans-serif;}
#root{height:100%;}

/* Scrollbar */
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#1E293B;border-radius:2px;}
::-webkit-scrollbar-thumb:hover{background:#2d3f5e;}

/* Animations */
@keyframes glow-cyan{
  0%,100%{box-shadow:0 0 6px rgba(0,240,255,.45),0 0 18px rgba(0,240,255,.2);}
  50%{box-shadow:0 0 14px rgba(0,240,255,.85),0 0 40px rgba(0,240,255,.35);}
}
@keyframes glow-crimson{
  0%,100%{box-shadow:0 0 6px rgba(244,63,94,.5),0 0 18px rgba(244,63,94,.2);}
  50%{box-shadow:0 0 14px rgba(244,63,94,.9),0 0 40px rgba(244,63,94,.35);}
}
@keyframes glow-amber{
  0%,100%{box-shadow:0 0 5px rgba(245,158,11,.5);}
  50%{box-shadow:0 0 12px rgba(245,158,11,.9);}
}
@keyframes log-in{from{opacity:0;transform:translateX(-6px);}to{opacity:1;transform:translateX(0);}}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
@keyframes flow-down{
  0%{stroke-dashoffset:40;opacity:0;}
  20%{opacity:1;}
  80%{opacity:1;}
  100%{stroke-dashoffset:0;opacity:0;}
}
@keyframes heartbeat{
  0%,100%{opacity:1;}
  45%,55%{opacity:.12;}
}
@keyframes scanline{0%{transform:translateY(-100%);}100%{transform:translateY(100vh);}}
@keyframes pulse-ring{
  0%{transform:scale(.95);opacity:.6;}
  50%{transform:scale(1.05);opacity:1;}
  100%{transform:scale(.95);opacity:.6;}
}
@keyframes shimmer{
  0%{background-position:-200% center;}
  100%{background-position:200% center;}
}
@keyframes fadeUp{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}

.glow-cyan{animation:glow-cyan 2s ease-in-out infinite;}
.glow-crimson{animation:glow-crimson 1.1s ease-in-out infinite;}
.glow-amber{animation:glow-amber 1.4s ease-in-out infinite;}
.log-in{animation:log-in .22s ease-out both;}
.blink{animation:blink 1s step-end infinite;}
.hb{animation:heartbeat 1s ease-in-out infinite;}
.pulse-ring{animation:pulse-ring 1.6s ease-in-out infinite;}
.fade-up{animation:fadeUp .3s ease-out both;}

/* Scanline overlay */
.scanlines::after{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,240,255,.008) 2px,rgba(0,240,255,.008) 4px);
  z-index:10;
}

/* Range slider */
input[type=range]{-webkit-appearance:none;appearance:none;height:3px;border-radius:2px;outline:none;cursor:pointer;background:transparent;}
input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none;appearance:none;
  width:11px;height:11px;border-radius:50%;
  border:2px solid currentColor;background:var(--void);
  cursor:pointer;box-shadow:0 0 5px currentColor;
  transition:transform .15s,box-shadow .15s;
}
input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.25);box-shadow:0 0 10px currentColor;}
input[type=range]::-moz-range-thumb{
  width:11px;height:11px;border-radius:50%;
  border:2px solid currentColor;background:var(--void);
  cursor:pointer;box-shadow:0 0 5px currentColor;
}

/* Section label */
.slabel{
  font-family:'JetBrains Mono',monospace;
  font-size:8px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--slate);opacity:.6;margin-bottom:6px;
}

/* Ghost branch */
.branch{
  border:1px solid var(--border);border-radius:5px;padding:8px 10px;
  background:rgba(15,23,42,.85);transition:border-color .4s,box-shadow .4s;
}
.branch.sel{border-color:rgba(0,240,255,.55);box-shadow:0 0 14px rgba(0,240,255,.12);}
.branch.blocked{border-color:rgba(244,63,94,.35);}
.branch.pass{border-color:rgba(16,185,129,.35);}

/* Hardware block */
.hwblock{
  border:1px solid var(--border);border-radius:5px;padding:5px 10px;
  display:flex;align-items:center;gap:7px;
  background:rgba(7,10,18,.7);
  transition:border-color .4s,box-shadow .4s,background .4s;
  position:relative;overflow:hidden;
}
.hwblock.act{border-color:rgba(0,240,255,.65);background:rgba(0,240,255,.04);}
.hwblock.alert{border-color:rgba(244,63,94,.65);background:rgba(244,63,94,.04);}
.hwblock.warn{border-color:rgba(245,158,11,.65);background:rgba(245,158,11,.04);}

/* Connector lines */
.conn{height:18px;display:flex;justify-content:center;align-items:center;position:relative;}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useRef,useCallback,useMemo}=React;

const ST={
  NOMINAL:'NOMINAL',
  ANOMALY:'ANOMALY_DETECTED',
  SANDBOX:'SANDBOX_EVALUATION',
  RECOVERED:'RECOVERY_VERIFIED',
};

const AI={
  SLEEP:  {label:'AI_DEEP_SLEEP',  w:0.0, col:'#64748B'},
  WAKING: {label:'AI_WAKING',      w:3.2, col:'#F59E0B'},
  ACTIVE: {label:'AI_ACTIVE',      w:6.8, col:'#00F0FF'},
  INFER:  {label:'INFERENCE',      w:9.4, col:'#A78BFA'},
  SLEEP2: {label:'ENTERING_SLEEP', w:1.1, col:'#64748B'},
};

const NOM={busV:7.4,battT:28,solar:11.2,fLoad:1.8,soc:88,elecT:32,wdLimit:10.0};

const SCENARIOS={
  thermal:{
    label:'INJECT ADCS THERMAL RUNAWAY',col:'#F43F5E',
    msg:'ADCS Thermal Spike (85.4°C)',gap:42,conf:96.4,fault:'ADCS Thermal Latch-up',
    ov:{battT:85.4,busV:4.2},postV:7.1,postT:31.2,violT:89.2,
  },
  radiation:{
    label:'INJECT SEU BIT-FLIP (RADIATION)',col:'#A78BFA',
    msg:'SEU Bit-Flip in AI Register Bank',gap:18,conf:89.1,fault:'Radiation SEU Corruption',
    ov:{soc:22,busV:5.8},postV:7.3,postT:28.1,violT:71.0,
  },
  sensor:{
    label:'INJECT UNKNOWN SENSOR CORRUPTION',col:'#F59E0B',
    msg:'UNKNOWN SENSOR STATE — Uncertainty Threshold Exceeded',gap:67,conf:54.2,fault:'Sensor Data Corruption',
    ov:{fLoad:9.8,battT:58},postV:7.0,postT:33.5,violT:78.5,
  },
};

function OrbitCanvas({sysState}){
  const ref=useRef(null);
  const raf=useRef(null);
  const angle=useRef(3.4);

  useEffect(()=>{
    const cv=ref.current; if(!cv) return;
    const ctx=cv.getContext('2d');

    const STARS=Array.from({length:90},()=>({
      x:Math.random(),y:Math.random(),r:Math.random()*.9+.3,
      ph:Math.random()*Math.PI*2,sp:Math.random()*.0008+.0003,
    }));

    function frame(){
      const W=cv.width=cv.offsetWidth,H=cv.height=cv.offsetHeight;
      const cx=W*.5,cy=H*.5;
      const gr=Math.min(W,H)*.27;
      const or=gr*1.65;
      const tilt=.36;

      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#070A12'; ctx.fillRect(0,0,W,H);

      const t=Date.now();
      STARS.forEach(s=>{
        const op=.15+.55*(.5+.5*Math.sin(t*s.sp+s.ph));
        ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(180,210,255,${op})`;ctx.fill();
      });

      const cStart=3.2, cEnd=5.0;

      if(sysState!==ST.NOMINAL){
        ctx.save();
        ctx.beginPath();ctx.ellipse(cx,cy,or,or*tilt,0,cEnd,cStart+Math.PI*2);
        ctx.strokeStyle='rgba(244,63,94,.06)';ctx.lineWidth=22;ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();ctx.ellipse(cx,cy,or,or*tilt,0,0,Math.PI*2);
      ctx.strokeStyle='rgba(100,148,255,.15)';ctx.lineWidth=1;
      ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
      ctx.restore();

      ctx.save();
      ctx.beginPath();ctx.ellipse(cx,cy,or,or*tilt,0,cStart,cEnd);
      ctx.strokeStyle='rgba(16,185,129,.9)';ctx.lineWidth=3;ctx.stroke();
      ctx.beginPath();ctx.ellipse(cx,cy,or,or*tilt,0,cStart,cEnd);
      ctx.strokeStyle='rgba(16,185,129,.2)';ctx.lineWidth=9;ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();ctx.ellipse(cx,cy,or,or*tilt,0,cEnd,cStart+Math.PI*2);
      const silOp=sysState!==ST.NOMINAL?.75:.28;
      ctx.strokeStyle=`rgba(244,63,94,${silOp})`;ctx.lineWidth=sysState!==ST.NOMINAL?2.5:1.5;ctx.stroke();
      if(sysState!==ST.NOMINAL){
        ctx.beginPath();ctx.ellipse(cx,cy,or,or*tilt,0,cEnd,cStart+Math.PI*2);
        ctx.strokeStyle='rgba(244,63,94,.08)';ctx.lineWidth=14;ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.font='8px "JetBrains Mono",monospace';
      ctx.fillStyle='rgba(16,185,129,.85)';
      const gcx=cx+or*.08,gcy=cy+or*tilt+16;
      ctx.fillText('▼ GROUND CONTACT PASS',gcx-52,gcy);
      ctx.fillStyle=sysState!==ST.NOMINAL?'rgba(244,63,94,.95)':'rgba(244,63,94,.55)';
      ctx.fillText('▲ RADIO SILENCE / ECLIPSE',cx-or*.7,cy-or*tilt-8);
      ctx.restore();

      const gg=ctx.createRadialGradient(cx-gr*.22,cy-gr*.18,gr*.08,cx,cy,gr);
      gg.addColorStop(0,'#1b3a6e');gg.addColorStop(.55,'#0c1e42');gg.addColorStop(1,'#04091a');
      ctx.beginPath();ctx.arc(cx,cy,gr,0,Math.PI*2);ctx.fillStyle=gg;ctx.fill();

      ctx.save();
      ctx.strokeStyle='rgba(0,240,255,.1)';ctx.lineWidth=.5;
      for(let lt=-70;lt<=70;lt+=20){
        const lr=gr*Math.cos(lt*Math.PI/180),ly=cy+gr*Math.sin(lt*Math.PI/180);
        if(lr>0){ctx.beginPath();ctx.ellipse(cx,ly,lr,lr*.18,0,0,Math.PI*2);ctx.stroke();}
      }
      for(let ln=0;ln<180;ln+=30){
        ctx.beginPath();
        ctx.ellipse(cx,cy,gr*Math.cos(ln*Math.PI/180),gr,0,0,Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.beginPath();ctx.arc(cx,cy,gr,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,240,255,.35)';ctx.lineWidth=1;ctx.stroke();
      const atm=ctx.createRadialGradient(cx,cy,gr*.97,cx,cy,gr*1.1);
      atm.addColorStop(0,'rgba(0,240,255,.18)');atm.addColorStop(1,'rgba(0,240,255,0)');
      ctx.beginPath();ctx.arc(cx,cy,gr*1.1,0,Math.PI*2);ctx.fillStyle=atm;ctx.fill();

      const gsa=4.1;
      const gsx=cx+or*Math.cos(gsa),gsy=cy+or*tilt*Math.sin(gsa);
      for(let r=1;r<=3;r++){
        const rr=r*7+(t/300%7);
        ctx.beginPath();ctx.arc(gsx,gsy,rr,0,Math.PI*2);
        ctx.strokeStyle=`rgba(16,185,129,${.35-r*.08})`;ctx.lineWidth=1;ctx.stroke();
      }
      ctx.beginPath();ctx.arc(gsx,gsy,4,0,Math.PI*2);
      ctx.fillStyle='#10B981';ctx.fill();
      ctx.font='7px "JetBrains Mono",monospace';
      ctx.fillStyle='#10B981';ctx.fillText('GS-1',gsx+6,gsy-3);

      const sa=angle.current;
      const sx=cx+or*Math.cos(sa),sy=cy+or*tilt*Math.sin(sa);
      const inSilence=(sa>cEnd||sa<cStart);
      const satCol=inSilence?(sysState!==ST.NOMINAL?'#F43F5E':'#F59E0B'):'#10B981';

      for(let i=1;i<=14;i++){
        const ta=sa-i*.055;
        const tx=cx+or*Math.cos(ta),ty=cy+or*tilt*Math.sin(ta);
        ctx.beginPath();ctx.arc(tx,ty,1.6,0,Math.PI*2);
        ctx.fillStyle=`rgba(0,240,255,${(1-i/14)*.45})`;ctx.fill();
      }

      if(sysState!==ST.NOMINAL&&inSilence){
        const hg=ctx.createRadialGradient(sx,sy,0,sx,sy,24);
        hg.addColorStop(0,'rgba(244,63,94,.55)');hg.addColorStop(1,'rgba(244,63,94,0)');
        ctx.beginPath();ctx.arc(sx,sy,24,0,Math.PI*2);ctx.fillStyle=hg;ctx.fill();
      }

      ctx.save();ctx.translate(sx,sy);ctx.rotate(sa+Math.PI*.5);
      ctx.fillStyle='#1E3A8A';
      ctx.fillRect(-13,-2.5,8,5);ctx.fillRect(5,-2.5,8,5);
      ctx.strokeStyle=satCol;ctx.lineWidth=.8;
      ctx.strokeRect(-13,-2.5,8,5);ctx.strokeRect(5,-2.5,8,5);
      ctx.fillStyle='#0F172A';ctx.fillRect(-5,-5,10,10);
      ctx.strokeStyle=satCol;ctx.lineWidth=1.8;ctx.strokeRect(-5,-5,10,10);
      ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,-10);
      ctx.strokeStyle=`${satCol}80`;ctx.lineWidth=1;ctx.stroke();
      ctx.restore();

      if(!inSilence&&sysState===ST.NOMINAL){
        ctx.save();
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(gsx,gsy);
        ctx.strokeStyle='rgba(16,185,129,.25)';ctx.lineWidth=1;
        ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
        ctx.restore();
      }

      if(sysState!==ST.NOMINAL&&inSilence){
        ctx.save();
        ctx.font='bold 9px "JetBrains Mono",monospace';
        ctx.fillStyle='#F43F5E';
        const lx=sx>cx?sx-130:sx+10;
        ctx.fillText('⚠ FAULT — NO GROUND LINK',lx,sy-18);
        ctx.restore();
      }

      ctx.save();
      ctx.font='8px "JetBrains Mono",monospace';
      ctx.fillStyle='rgba(100,148,255,.6)';
      ctx.fillText('LEO 550 km  |  INC: 97.4°  |  PERIOD: 92 MIN  |  ALTITUDE: 550 km',cx-130,H-8);
      ctx.restore();

      angle.current=(sa+.0032)%(Math.PI*2);
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return()=>{if(raf.current)cancelAnimationFrame(raf.current);};
  },[sysState]);

  return <canvas ref={ref} style={{width:'100%',height:'100%',display:'block',willChange:'transform'}} />;
}

function HardwareTwin({sysState,aiState,wdSec,wdMax,gatePass}){
  const isAct=sysState!==ST.NOMINAL;
  const isEval=sysState===ST.SANDBOX||sysState===ST.RECOVERED;
  const isRec=sysState===ST.RECOVERED;

  const wdPct=wdSec/wdMax;
  const circ=2*Math.PI*18;
  const wdCol=wdPct>.6?'#10B981':wdPct>.3?'#F59E0B':'#F43F5E';

  function Block({id,icon,label,sub}){
    const s=
      (id==='adcs'&&sysState===ST.ANOMALY)?'alert':
      (id==='ai'&&aiState.label!==AI.SLEEP.label)?'act':
      (id==='obc'&&isAct)?'warn':
      (id==='watchdog'&&isAct)?'warn':'';
    const tc=s==='act'?'#00F0FF':s==='alert'?'#F43F5E':s==='warn'?'#F59E0B':'#475569';
    return(
      <div className={`hwblock ${s}`} style={{boxShadow:s?`0 0 10px ${tc}30`:'none'}}>
        <span style={{fontSize:13}}>{icon}</span>
        <div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:tc,fontWeight:600}}>{label}</div>
          {sub&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:'#374151',marginTop:1}}>{sub}</div>}
        </div>
        {s==='act'&&<div style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',width:5,height:5,borderRadius:'50%',background:'#00F0FF',boxShadow:'0 0 6px #00F0FF'}} className="pulse-ring"/>}
        {s==='alert'&&<div style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',width:5,height:5,borderRadius:'50%',background:'#F43F5E',boxShadow:'0 0 6px #F43F5E'}} className="pulse-ring"/>}
      </div>
    );
  }

  function Conn({active,col='#00F0FF',lbl}){
    return(
      <div className="conn">
        <svg width="160" height="18" style={{overflow:'visible'}}>
          <line x1="80" y1="0" x2="80" y2="18"
            stroke={active?col:'#1E293B'} strokeWidth={active?2:1}
            style={{transition:'stroke .4s,stroke-width .4s'}}/>
          <polygon points="76,12 80,18 84,12" fill={active?col:'#1E293B'} style={{transition:'fill .4s'}}/>
          {active&&[0,.5,1].map(d=>(
            <circle key={d} cx="80" cy="0" r="2" fill={col} opacity=".85">
              <animateMotion dur=".65s" begin={`${d}s`} repeatCount="indefinite" path="M0 0 L0 18"/>
            </circle>
          ))}
          {lbl&&<text x="90" y="12" fontSize="7" fontFamily="'JetBrains Mono',monospace" fill={active?col:'#374151'}>{lbl}</text>}
        </svg>
      </div>
    );
  }

  function GPIORow({active}){
    return(
      <div style={{width:'100%',padding:'4px 0'}}>
        {[
          {label:'GPIO_PIN_4  (POWER GATE)',col:'#00F0FF'},
          {label:'WATCHDOG HEARTBEAT  (1 Hz)',col:'#F59E0B'},
        ].map(({label,col},i)=>(
          <div key={i} style={{marginBottom:4}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:active?col:'#1E293B',marginBottom:2,transition:'color .4s'}}>{label}</div>
            <div style={{position:'relative',height:2,borderRadius:1,overflow:'hidden',background:'#1E293B'}}>
              <div style={{
                position:'absolute',inset:0,borderRadius:1,
                background:active?col:'transparent',
                boxShadow:active?`0 0 6px ${col}`:'none',
                transition:'background .4s,box-shadow .4s',
              }}/>
              {active&&<div style={{
                position:'absolute',top:0,left:'-60%',width:'60%',height:'100%',
                background:`linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent)`,
                animation:`heartbeat ${i===1?'1':'0.6'}s ease-in-out infinite`,
              }}/>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return(
    <div style={{display:'flex',gap:8,padding:'6px 10px',height:'100%',alignItems:'stretch'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-evenly',gap:0}}>
        <div style={{display:'flex',gap:6,width:'100%'}}>
          <div style={{flex:1}}><Block id="payload" icon="🛰" label="PAYLOAD" sub="Imager / Science Bus"/></div>
          <div style={{flex:1}}><Block id="comms" icon="📡" label="COMMS" sub="UHF 437 MHz / S-Band"/></div>
        </div>
        <Conn active={isAct} col="#F59E0B" lbl="28V BUS"/>
        <div style={{width:'100%'}}><Block id="obc" icon="⚙️" label="MASTER OBC" sub="FreeRTOS · Hard Real-Time C++"/></div>
        <div style={{width:'100%'}}><GPIORow active={isAct}/></div>
        <div style={{display:'flex',gap:6,width:'100%',alignItems:'stretch'}}>
          <div style={{flex:2}}><Block id="ai" icon="🧠" label="EDGE-AI COPROCESSOR" sub={`${aiState.label}  [${aiState.w.toFixed(1)}W]`}/></div>
          <div style={{
            flex:1,border:`1px solid ${isEval?(gatePass?'rgba(16,185,129,.65)':'rgba(244,63,94,.65)'):'#1E293B'}`,
            borderRadius:5,padding:'5px 7px',
            background:isEval?(gatePass?'rgba(16,185,129,.06)':'rgba(244,63,94,.06)'):'rgba(7,10,18,.7)',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
            transition:'all .4s',
            boxShadow:isEval?(gatePass?'0 0 10px rgba(16,185,129,.25)':'0 0 10px rgba(244,63,94,.25)'):'none',
          }}>
            <span style={{fontSize:12}}>{isRec?'✅':isEval?'⚡':'🔒'}</span>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:isEval?(gatePass?'#10B981':'#F43F5E'):'#374151',textAlign:'center',lineHeight:1.4}}>
              SAFETY<br/>GATE
            </div>
            {isEval&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6,color:gatePass?'#10B981':'#F43F5E'}}>{gatePass?'PASS':'BLOCK'}</div>}
          </div>
        </div>
        <Conn active={isAct} col="#10B981" lbl="TEMPLATE"/>
        <div style={{display:'flex',gap:6,width:'100%'}}>
          <div style={{flex:1}}><Block id="eps" icon="🔋" label="EPS / BATTERY" sub="28V LiPo Stack"/></div>
          <div style={{flex:1}}><Block id="adcs" icon="🔄" label="ADCS" sub="Reaction Wheels"/></div>
        </div>
      </div>

      {isAct&&(
        <div style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          gap:6,minWidth:62,borderLeft:'1px solid #1E293B',paddingLeft:10,
        }} className="fade-up">
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:'#F59E0B',letterSpacing:'.1em',textAlign:'center'}}>HW<br/>WATCHDOG</div>
          <svg width="50" height="50" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="18" fill="none" stroke="#1E293B" strokeWidth="3.5"/>
            <circle
              cx="25" cy="25" r="18"
              fill="none" stroke={wdCol} strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ*(1-wdPct)}
              transform="rotate(-90 25 25)"
              style={{
                transition:'stroke-dashoffset .1s linear,stroke .5s ease',
                filter:`drop-shadow(0 0 3px ${wdCol})`,
              }}
            />
            <text x="25" y="29" textAnchor="middle" fontSize="8.5" fontFamily="'JetBrains Mono',monospace" fill={wdCol} fontWeight="700">
              {wdSec.toFixed(1)}s
            </text>
          </svg>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6,color:'#374151',textAlign:'center',lineHeight:1.5}}>
            KILL-SWITCH<br/>ARMED
          </div>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#F43F5E',boxShadow:'0 0 8px #F43F5E'}} className="pulse-ring"/>
        </div>
      )}
    </div>
  );
}

function GhostFutures({sysState,scenario}){
  const ev=sysState===ST.SANDBOX||sysState===ST.RECOVERED;

  const branches=[
    {
      id:'a',name:'Branch α — EMERGENCY_SAFE_MODE',tpl:'Template #12',
      status:ev?'PASS':'PENDING',sel:false,blocked:false,
      recovery:100,impact:'-80% Science Ops',margin:`+2.1V, -38°C`,col:'#10B981',
    },
    {
      id:'b',name:'Branch β — RESTART_ADCS_CTRL',tpl:'Template #14',
      status:ev?'PASS / SELECTED':'PENDING',sel:ev,blocked:false,
      recovery:98,impact:'Minimal — 8min blackout',
      margin:`+${scenario?((scenario.postV-6).toFixed(1)):1.4}V, -${scenario?Math.round(scenario.violT-scenario.postT):22}°C`,
      col:'#00F0FF',
    },
    {
      id:'g',name:'Branch γ — OVERVOLT_HTR_BYPASS',tpl:'Template #07',
      status:ev?'BLOCKED BY GATE':'PENDING',sel:false,blocked:ev,
      recovery:0,impact:'N/A — Gate Rejected',
      margin:`VIOLATES: Temp ${scenario?scenario.violT.toFixed(1):89.2}°C > 65°C`,
      col:'#F43F5E',
    },
  ];

  const scol={'PASS':'#10B981','PASS / SELECTED':'#00F0FF','BLOCKED BY GATE':'#F43F5E','PENDING':'#374151'};

  return(
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {branches.map(b=>(
        <div key={b.id}
          className={`branch${b.sel?' sel':b.blocked?' blocked':ev?' pass':''}`}
          style={{transition:'all .5s'}}
        >
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:b.sel?'#00F0FF':b.blocked?'#F43F5E':'#475569',fontWeight:600}}>
              {b.name}
            </div>
            <div style={{
              fontFamily:"'JetBrains Mono',monospace",fontSize:7,
              color:scol[b.status]||'#374151',
              background:`${scol[b.status]||'#374151'}18`,
              padding:'1px 6px',borderRadius:3,
              border:`1px solid ${scol[b.status]||'#374151'}40`,
              whiteSpace:'nowrap',
            }}>{b.status}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 8px',marginBottom:b.blocked?0:5}}>
            {[['Recovery',b.blocked?'N/A':`${b.recovery}%`],['Template',b.tpl],['Impact',b.impact],['Margin',b.margin]].map(([k,v])=>(
              <div key={k}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:'#374151'}}>{k}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:b.blocked?'#F43F5E':b.sel?'#00F0FF':'#64748B'}}>{v}</div>
              </div>
            ))}
          </div>
          {!b.blocked&&ev&&(
            <div style={{height:2,background:'#1E293B',borderRadius:1,overflow:'hidden'}}>
              <div style={{
                height:'100%',width:`${b.recovery}%`,
                background:b.sel?'#00F0FF':'#10B981',borderRadius:1,
                boxShadow:b.sel?'0 0 5px rgba(0,240,255,.5)':'none',
                transition:'width 1s ease',
              }}/>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SafetyGate({tel,sysState}){
  const act=sysState!==ST.NOMINAL;
  const cur=(tel.fLoad/Math.max(tel.busV,.1)*1.2);
  const checks=[
    {lbl:'Bus Voltage ≥ 6.0V',  val:`${tel.busV.toFixed(2)}V`,  pass:tel.busV>=6.0},
    {lbl:'Battery Temp ≤ 65°C', val:`${tel.battT.toFixed(1)}°C`,pass:tel.battT<=65},
    {lbl:'Max Current ≤ 3.5A',  val:`${cur.toFixed(2)}A`,       pass:cur<=3.5},
    {lbl:'Battery SOC ≥ 30%',   val:`${tel.soc.toFixed(0)}%`,   pass:tel.soc>=30},
  ];
  const allPass=checks.every(c=>c.pass);
  return(
    <div style={{
      border:`1px solid ${act?(allPass?'rgba(16,185,129,.45)':'rgba(244,63,94,.45)'):'#1E293B'}`,
      borderRadius:5,padding:'8px 10px',background:'rgba(7,10,18,.7)',
      transition:'border-color .4s',marginBottom:8,
    }}>
      <div className="slabel" style={{marginBottom:6}}>DETERMINISTIC SAFETY GATE</div>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {checks.map(c=>(
          <div key={c.lbl} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:'#475569'}}>{c.lbl}</span>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:'#374151'}}>{c.val}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:c.pass?'#10B981':'#F43F5E',fontWeight:700}}>{c.pass?'✓':'✗'}</span>
            </div>
          </div>
        ))}
      </div>
      {act&&(
        <div style={{
          marginTop:7,padding:'3px 8px',borderRadius:4,textAlign:'center',
          background:allPass?'rgba(16,185,129,.08)':'rgba(244,63,94,.08)',
          border:`1px solid ${allPass?'rgba(16,185,129,.3)':'rgba(244,63,94,.3)'}`,
          fontFamily:"'JetBrains Mono',monospace",fontSize:9,
          color:allPass?'#10B981':'#F43F5E',
        }}>
          {allPass?'✓ GATE PASS — Template Cleared for Execution':'✗ GATE BLOCK — Unsafe Proposal Rejected'}
        </div>
      )}
    </div>
  );
}

function XAILog({entries,running}){
  const ref=useRef(null);
  useEffect(()=>{
    if(ref.current) ref.current.scrollTop=ref.current.scrollHeight;
  },[entries]);

  const sc={OBC:'#4FC3F7',WATCHDOG:'#F59E0B',AI:'#A78BFA',TWIN:'#10B981','SAFETY GATE':'#F43F5E'};
  const lc={CRITICAL:'#F43F5E',INFO:'#475569',PASS:'#10B981',BLOCK:'#F43F5E',EXEC:'#00F0FF',SUCCESS:'#10B981',WARN:'#F59E0B'};

  return(
    <div ref={ref} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:1}}>
      {entries.length===0&&(
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:'#1E293B',padding:'6px 0'}}>
          // Awaiting mission event<span className="blink">_</span>
        </div>
      )}
      {entries.map((e,i)=>(
        <div key={i} className="log-in" style={{
          display:'flex',gap:5,alignItems:'flex-start',
          padding:'2px 0',borderBottom:'1px solid rgba(30,41,59,.35)',
        }}>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:'#374151',whiteSpace:'nowrap',minWidth:46}}>{e.ts}</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:sc[e.src]||'#475569',whiteSpace:'nowrap',minWidth:72,fontWeight:600}}>[{e.src}]</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:lc[e.lvl]||'#475569',whiteSpace:'nowrap',minWidth:46}}>{e.lvl}:</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:'#64748B',flex:1,lineHeight:1.5}}>{e.msg}</span>
        </div>
      ))}
      {running&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:'#374151',padding:'2px 0'}}><span className="blink">█</span></div>}
    </div>
  );
}

function Slider({label,val,min,max,step,unit,onChange,floorMin,ceilMax,col='#00F0FF'}){
  const pct=((val-min)/(max-min))*100;
  const warn=(floorMin!==undefined&&val<floorMin)||(ceilMax!==undefined&&val>ceilMax);
  const sc=warn?'#F43F5E':col;
  return(
    <div style={{marginBottom:9}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <label style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:'#475569'}}>{label}</label>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:warn?'#F43F5E':'#c8d8e8',fontWeight:600}}>
          {typeof val==='number'?val.toFixed(step<.1?2:step<1?1:0):val}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e=>onChange(parseFloat(e.target.value))}
        style={{
          width:'100%',color:sc,
          background:`linear-gradient(90deg,${sc}70 0%,${sc}70 ${pct}%,#1E293B ${pct}%,#1E293B 100%)`,
        }}
      />
      {(floorMin!==undefined||ceilMax!==undefined)&&(
        <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
          {floorMin!==undefined&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6.5,color:'#1E293B'}}>floor: {floorMin}{unit}</span>}
          {ceilMax!==undefined&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6.5,color:'#1E293B',marginLeft:'auto'}}>ceil: {ceilMax}{unit}</span>}
        </div>
      )}
    </div>
  );
}

function LED({label,sub,col,glow}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{
        width:7,height:7,borderRadius:'50%',background:col,flexShrink:0,
        boxShadow:glow?`0 0 5px ${col},0 0 12px ${col}50`:'none',
        transition:'all .4s',
      }}/>
      <div>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:col,fontWeight:600,lineHeight:1.2}}>{label}</div>
        {sub&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:'#374151',lineHeight:1.2}}>{sub}</div>}
      </div>
    </div>
  );
}

function App(){
  const [tel,setTel]=useState({...NOM});
  const [sysState,setSysState]=useState(ST.NOMINAL);
  const [aiState,setAiState]=useState(AI.SLEEP);
  const [logs,setLogs]=useState([]);
  const [running,setRunning]=useState(false);
  const [wdSec,setWdSec]=useState(NOM.wdLimit);
  const [gatePass,setGatePass]=useState(null);
  const [scenario,setScenario]=useState(null);
  const t0=useRef(null);
  const wdIv=useRef(null);
  const timers=useRef([]);

  const clearAll=()=>{
    timers.current.forEach(clearTimeout);
    timers.current=[];
    if(wdIv.current)clearInterval(wdIv.current);
  };

  const addLog=useCallback((src,lvl,msg,delay)=>{
    timers.current.push(setTimeout(()=>{
      const ms=Date.now()-(t0.current||Date.now());
      const s=(ms/1000).toFixed(1).padStart(4,'0');
      const ts=`[00:${s}]`;
      setLogs(p=>[...p,{ts,src,lvl,msg}]);
    },delay));
  },[]);

  const go=useCallback((sc)=>{
    if(running)return;
    clearAll();
    setRunning(true);
    setScenario(sc);
    t0.current=Date.now();
    setLogs([]);
    setWdSec(NOM.wdLimit);
    setGatePass(null);
    setTel(p=>({...p,...sc.ov}));
    setSysState(ST.ANOMALY);
    setAiState(AI.WAKING);

    const seq=[
      {d:0,    src:'OBC',         lvl:'CRITICAL', msg:`CRITICAL: ${sc.msg}. Ground Contact: ${sc.gap}m away.`},
      {d:280,  src:'OBC',         lvl:'INFO',     msg:`Waking Coprocessor. Asserting GPIO_PIN_4 HIGH.`},
      {d:480,  src:'WATCHDOG',    lvl:'INFO',     msg:`${NOM.wdLimit.toFixed(1)}s Countdown Armed. Kill-switch engaged.`},
      {d:1100, src:'AI',          lvl:'INFO',     msg:`Diagnostics Complete: ${sc.conf}% confidence ${sc.fault}.`},
      {d:1700, src:'TWIN',        lvl:'INFO',     msg:'Simulating Branch α: EMERGENCY_SAFE_MODE.'},
      {d:1950, src:'TWIN',        lvl:'INFO',     msg:'Simulating Branch β: RESTART_ADCS_CONTROLLER.'},
      {d:2200, src:'TWIN',        lvl:'INFO',     msg:'Simulating Branch γ: OVERVOLT_HEATER_BYPASS.'},
      {d:2750, src:'SAFETY GATE', lvl:'PASS',     msg:`Branch α: Voltage ${sc.postV}V ✓ | Temp 38°C ✓ | SOC OK ✓ → [PASS]`},
      {d:3050, src:'SAFETY GATE', lvl:'PASS',     msg:`Branch β: Voltage ${sc.postV}V ✓ | Temp ${sc.postT}°C ✓ | SOC OK ✓ → [PASS / SELECTED]`},
      {d:3350, src:'SAFETY GATE', lvl:'BLOCK',    msg:`Branch γ: Temp VIOLATION ${sc.violT}°C > 65°C → [BLOCKED BY GATE]`},
      {d:3900, src:'OBC',         lvl:'EXEC',     msg:'Executing Template #14: Power Cycle ADCS Controller.'},
      {d:4450, src:'OBC',         lvl:'INFO',     msg:`ADCS Thermal nominal: ${sc.postT}°C. Bus voltage nominal: ${sc.postV}V.`},
      {d:5150, src:'OBC',         lvl:'INFO',     msg:'De-asserting GPIO_PIN_4. Coprocessor entering Deep Sleep.'},
      {d:5600, src:'WATCHDOG',    lvl:'INFO',     msg:'Heartbeat received. Countdown cancelled. System nominal.'},
      {d:6150, src:'OBC',         lvl:'SUCCESS',  msg:`Recovery verified. Mission state: RECOVERY_VERIFIED. XAI Log: 128B (saved 98.6%).`},
    ];
    seq.forEach(({d,src,lvl,msg})=>addLog(src,lvl,msg,d));

    const schedule=(fn,d)=>{timers.current.push(setTimeout(fn,d));};
    schedule(()=>setAiState(AI.ACTIVE),480);
    schedule(()=>setAiState(AI.INFER),1100);
    schedule(()=>setSysState(ST.SANDBOX),1700);
    schedule(()=>setGatePass(true),2750);
    schedule(()=>{
      setSysState(ST.RECOVERED);
      setTel(p=>({...p,busV:sc.postV,battT:sc.postT}));
    },3900);
    schedule(()=>setAiState(AI.SLEEP2),5150);
    schedule(()=>{
      setAiState(AI.SLEEP);
      setRunning(false);
      setWdSec(NOM.wdLimit);
    },6150);

    const start=Date.now();
    const dur=6100;
    wdIv.current=setInterval(()=>{
      const el=(Date.now()-start)/dur;
      setWdSec(Math.max(0,NOM.wdLimit*(1-el)));
      if(el>=1)clearInterval(wdIv.current);
    },50);
  },[running,addLog]);

  const reset=()=>{
    clearAll();
    setSysState(ST.NOMINAL);
    setAiState(AI.SLEEP);
    setTel({...NOM});
    setLogs([]);
    setRunning(false);
    setWdSec(NOM.wdLimit);
    setGatePass(null);
    setScenario(null);
  };

  const stCfg={
    [ST.NOMINAL]:  {lbl:'NOMINAL',    col:'#10B981',glow:false},
    [ST.ANOMALY]:  {lbl:'ANOMALY',    col:'#F43F5E',glow:true},
    [ST.SANDBOX]:  {lbl:'EVALUATING', col:'#F59E0B',glow:true},
    [ST.RECOVERED]:{lbl:'RECOVERING', col:'#F59E0B',glow:false},
  };
  const sc=stCfg[sysState];
  const upd=key=>v=>setTel(p=>({...p,[key]:v}));

  return(
    <div style={{
      height:'100vh',width:'100vw',overflow:'hidden',
      background:'#070A12',
      display:'grid',
      gridTemplateRows:'auto 1fr',
      gridTemplateColumns:'1fr',
      gap:6,padding:6,
    }}>
      <div style={{
        background:'#0F172A',border:'1px solid #1E293B',borderRadius:6,
        padding:'0 14px',display:'flex',alignItems:'center',
        justifyContent:'space-between',height:44,flexShrink:0,
        position:'relative',overflow:'hidden',
      }}>
        <div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#00F0FF',fontWeight:700,letterSpacing:'.07em'}}>
            AEGIS-TWIN // ORBITAL FDIR BENCHMARK
          </div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7.5,color:'#374151',marginTop:1}}>
            BUS-ID: DSU-CUBESAT-1U &nbsp;|&nbsp; LEO 550 km &nbsp;|&nbsp; INC: 97.4° &nbsp;|&nbsp; PERIOD: 92 MIN
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:18}}>
          <LED label={sc.lbl} sub="MASTER STATE" col={sc.col} glow={sc.glow}/>
          <div style={{width:1,height:22,background:'#1E293B'}}/>
          <LED
            label={aiState.label}
            sub={`[${aiState.w.toFixed(1)} W]`}
            col={aiState.col}
            glow={aiState!==AI.SLEEP&&aiState!==AI.SLEEP2}
          />
          <div style={{width:1,height:22,background:'#1E293B'}}/>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{
              width:7,height:7,borderRadius:'50%',
              background:sysState===ST.NOMINAL?'#10B981':'#374151',
              boxShadow:sysState===ST.NOMINAL?'0 0 6px #10B981':'none',
              flexShrink:0,transition:'all .4s',
            }}/>
            <div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:'#64748B',fontWeight:600}}>OBC WATCHDOG</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:'#374151'}}>
                {sysState!==ST.NOMINAL?`${wdSec.toFixed(1)}s REMAINING`:`${tel.wdLimit.toFixed(1)}s NOMINAL`}
              </div>
            </div>
          </div>
        </div>
        <div style={{
          fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:'#10B981',
          background:'rgba(16,185,129,.07)',border:'1px solid rgba(16,185,129,.2)',
          padding:'4px 10px',borderRadius:5,textAlign:'right',
        }}>
          <div style={{fontWeight:700}}>Downlink Savings: 98.6%</div>
          <div style={{color:'#374151',fontSize:7}}>128B XAI Log vs 4.2MB Raw Telemetry</div>
        </div>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'3fr 6fr 3fr',
        gap:6,minHeight:0,overflow:'hidden',
      }}>
        <div style={{
          background:'#0F172A',border:'1px solid #1E293B',borderRadius:6,
          padding:'10px 10px 10px 12px',
          display:'flex',flexDirection:'column',overflow:'hidden',
        }}>
          <div className="slabel">THE ARENA // JUDGE CONTROLS</div>
          <div style={{flex:1,overflowY:'auto',paddingRight:4}}>
            <Slider label="Bus Voltage"       val={tel.busV}     min={0}   max={10}  step={.01} unit="V"  onChange={upd('busV')}     floorMin={6.0}  col="#00F0FF"/>
            <Slider label="Battery Temp"      val={tel.battT}    min={-20} max={100} step={.5}  unit="°C" onChange={upd('battT')}    ceilMax={65}    col="#F59E0B"/>
            <Slider label="Solar Input"       val={tel.solar}    min={0}   max={15}  step={.1}  unit="W"  onChange={upd('solar')}                    col="#10B981"/>
            <Slider label="System Fault Load" val={tel.fLoad}    min={0}   max={12}  step={.1}  unit="W"  onChange={upd('fLoad')}                    col="#F43F5E"/>
            <Slider label="Battery SOC"       val={tel.soc}      min={0}   max={100} step={1}   unit="%"  onChange={upd('soc')}      floorMin={30}   col="#10B981"/>
            <Slider label="Electronics Temp"  val={tel.elecT}    min={-20} max={90}  step={.5}  unit="°C" onChange={upd('elecT')}    ceilMax={65}    col="#F59E0B"/>
            <Slider label="HW Watchdog Limit" val={tel.wdLimit}  min={1}   max={15}  step={.5}  unit="s"  onChange={upd('wdLimit')}                  col="#F59E0B"/>
            <div style={{
              display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,
              padding:'8px 0',borderTop:'1px solid #1E293B',marginBottom:10,
            }}>
              {[
                {lbl:'VOLTAGE',val:`${tel.busV.toFixed(1)}V`,warn:tel.busV<6.0},
                {lbl:'TEMP',   val:`${tel.battT.toFixed(0)}°C`,warn:tel.battT>65},
                {lbl:'SOC',    val:`${tel.soc.toFixed(0)}%`,warn:tel.soc<30},
                {lbl:'SOLAR',  val:`${tel.solar.toFixed(1)}W`,warn:false},
                {lbl:'LOAD',   val:`${tel.fLoad.toFixed(1)}W`,warn:tel.fLoad>8},
                {lbl:'E-TEMP', val:`${tel.elecT.toFixed(0)}°C`,warn:tel.elecT>65},
              ].map(m=>(
                <div key={m.lbl} style={{textAlign:'center'}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6.5,color:'#374151'}}>{m.lbl}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:m.warn?'#F43F5E':'#00F0FF',fontWeight:700}}>{m.val}</div>
                </div>
              ))}
            </div>
            <SafetyGate tel={tel} sysState={sysState}/>
            <div className="slabel">ANOMALY INJECTION TRIGGERS</div>
            {Object.entries(SCENARIOS).map(([k,s])=>(
              <button key={k}
                onClick={()=>go(s)}
                disabled={running}
                style={{
                  width:'100%',marginBottom:6,padding:'7px 10px',
                  background:running?'rgba(30,41,59,.2)':`${s.col}10`,
                  border:`1px solid ${running?'#1E293B':s.col+'45'}`,
                  borderRadius:4,color:running?'#374151':s.col,
                  fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,
                  cursor:running?'not-allowed':'pointer',textAlign:'left',
                  letterSpacing:'.04em',transition:'all .2s',lineHeight:1.4,
                }}
                onMouseEnter={e=>{if(!running)e.currentTarget.style.background=`${s.col}22`;}}
                onMouseLeave={e=>{if(!running)e.currentTarget.style.background=`${s.col}10`;}}
              >
                ⚡ {s.label}
              </button>
            ))}
            {sysState!==ST.NOMINAL&&!running&&(
              <button onClick={reset} style={{
                width:'100%',padding:'6px 10px',
                background:'rgba(16,185,129,.09)',border:'1px solid rgba(16,185,129,.35)',
                borderRadius:4,color:'#10B981',
                fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,
                cursor:'pointer',letterSpacing:'.04em',
              }}>↺ RESET TO NOMINAL</button>
            )}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:6,minHeight:0,overflow:'hidden'}}>
          <div style={{
            flex:'0 0 47%',background:'#0F172A',border:'1px solid #1E293B',
            borderRadius:6,overflow:'hidden',position:'relative',
          }} className="scanlines">
            <div style={{
              position:'absolute',top:8,left:12,zIndex:5,
              fontFamily:"'JetBrains Mono',monospace",fontSize:8,
              color:'rgba(0,240,255,.65)',letterSpacing:'.1em',
            }}>ORBITAL TRACK — GROUND PASS SIMULATOR</div>
            <OrbitCanvas sysState={sysState}/>
          </div>
          <div style={{
            flex:'1 1 0',background:'#0F172A',border:'1px solid #1E293B',
            borderRadius:6,overflow:'hidden',position:'relative',
            display:'flex',flexDirection:'column',
          }}>
            <div style={{
              padding:'8px 12px 0',
              fontFamily:"'JetBrains Mono',monospace",fontSize:8,
              color:'#475569',letterSpacing:'.1em',flexShrink:0,
            }}>SUBSYSTEM HARDWARE TWIN</div>
            <div style={{flex:1,minHeight:0}}>
              <HardwareTwin sysState={sysState} aiState={aiState} wdSec={wdSec} wdMax={tel.wdLimit} gatePass={gatePass}/>
            </div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:6,minHeight:0,overflow:'hidden'}}>
          <div style={{
            background:'#0F172A',border:'1px solid #1E293B',borderRadius:6,
            padding:'10px 10px 10px 12px',flexShrink:0,
          }}>
            <div className="slabel">DIGITAL TWIN "GHOST FUTURES"</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7.5,color:'#374151',marginBottom:8}}>
              PARALLEL SANDBOX SIMULATIONS
            </div>
            <GhostFutures sysState={sysState} scenario={scenario}/>
          </div>
          <div style={{
            flex:1,background:'#0F172A',border:'1px solid #1E293B',borderRadius:6,
            padding:'10px 10px 10px 12px',
            display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden',
          }}>
            <div className="slabel">OBC / AI EXECUTION REPLAY LOG</div>
            <div style={{
              display:'flex',justifyContent:'space-between',
              fontFamily:"'JetBrains Mono',monospace",fontSize:7.5,color:'#374151',
              marginBottom:6,flexShrink:0,
            }}>
              <span>MISSION EVENTS</span>
              <span style={{color:'#475569'}}>{logs.length} entries</span>
            </div>
            <div style={{
              display:'flex',flexWrap:'wrap',gap:'4px 8px',marginBottom:6,
              paddingBottom:6,borderBottom:'1px solid #1E293B',flexShrink:0,
            }}>
              {[['OBC','#4FC3F7'],['WATCHDOG','#F59E0B'],['AI','#A78BFA'],['TWIN','#10B981'],['SAFETY GATE','#F43F5E']].map(([s,c])=>(
                <div key={s} style={{display:'flex',alignItems:'center',gap:3}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:c}}/>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:c}}>{s}</span>
                </div>
              ))}
            </div>
            <XAILog entries={logs} running={running}/>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
</script>
</body>
</html>
```
