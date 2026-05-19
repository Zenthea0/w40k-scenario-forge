import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════
// ══  CONSTANTS & HELPERS  ══
// ══════════════════════════════════════
const MM_TO_INCH = 1 / 25.4;
const OBJECTIVE_RADIUS_INCH = 40 * MM_TO_INCH / 2;
const MAX_PROJECTS = 20;
const MAX_SCENARIOS = 20;
const STORAGE_KEY = "w40k_deploy_projects";
const SCENARIO_STORAGE_KEY = "w40k_deploy_scenarios";
const DPI_EXPORT = 200;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const PIXELS_PER_INCH = 10;

let _uid = Date.now();
const uid = () => `obj_${_uid++}`;

const shapeDefaults = {
  line: () => ({ type: "line", name: "Droite", x1: 0, y1: 0, x2: 10, y2: 0, strokeColor: "#ff0000", strokeWidth: 2, dashed: false }),
  arrow: () => ({ type: "arrow", name: "Flèche", x1: 0, y1: 0, x2: 10, y2: 0, strokeColor: "#ff0000", strokeWidth: 2, dashed: false, showDistance: false }),
  rect: () => ({ type: "rect", name: "Rectangle", x1: 0, y1: 0, x2: 10, y2: 10, strokeColor: "#3366ff", strokeWidth: 2, dashed: false, fillColor: "#3366ff", fillOpacity: 0.3 }),
  triangle: () => ({ type: "triangle", name: "Triangle", x1: 0, y1: 0, x2: 5, y2: 10, x3: 10, y3: 0, strokeColor: "#33cc33", strokeWidth: 2, dashed: false, fillColor: "#33cc33", fillOpacity: 0.3 }),
  circle: () => ({ type: "circle", name: "Cercle", cx: 10, cy: 10, r: 5, strokeColor: "#ffcc00", strokeWidth: 2, dashed: false, fillColor: "#ffcc00", fillOpacity: 0.3 }),
  objective: () => ({ type: "objective", name: "Objectif", cx: 10, cy: 10, fillColor: "#8800aa", fillOpacity: 0.8 }),
  text: () => ({ type: "text", name: "Texte", x: 10, y: 10, content: "Texte", fontSize: 14, textColor: "#000000" }),
};

const newScenario = () => ({
  id: uid(), name: "Nouveau scénario", mapId: null,
  title: "", narrative: "", specialRules: [], primaryObjectives: [], secondaryObjectives: [], tertiaryObjectives: [],
  created: Date.now(),
});

const newListItem = () => ({ id: uid(), name: "", description: "" });

const cssVars = {
  "--bg-dark": "#1a1a2e", "--bg-panel": "#16213e", "--bg-input": "#0f3460", "--bg-canvas": "#f5f0e8",
  "--border": "#2a3a5e", "--text-primary": "#e0e0e0", "--text-secondary": "#8899bb", "--text-tertiary": "#556688",
  "--accent": "#e94560", "--accent-secondary": "#0f9b8e", "--highlight": "#00ffff",
};

// ══════════════════════════════════════
// ══  SHARED COMPONENTS  ══
// ══════════════════════════════════════
function ColorPicker({ color, onChange, label }) {
  const [hex, setHex] = useState(color);
  useEffect(() => setHex(color), [color]);
  const presets = ["#f5f0e8","#000000","#ffffff","#8b2020","#2d5a2d","#3366ff","#ffcc00","#ff6600","#8800aa","#00cccc"];
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
        <span style={{ fontSize:11,color:"var(--text-secondary)",minWidth:60 }}>{label}</span>
        <input type="color" value={color} onChange={e=>{onChange(e.target.value);setHex(e.target.value);}} style={{ width:28,height:28,border:"none",background:"none",cursor:"pointer",padding:0 }}/>
        <input type="text" value={hex} onChange={e=>{setHex(e.target.value);if(/^#[0-9a-fA-F]{6}$/.test(e.target.value))onChange(e.target.value);}} style={{ width:72,fontSize:11,padding:"2px 4px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-primary)",fontFamily:"monospace" }}/>
      </div>
      <div style={{ display:"flex",gap:2,marginLeft:60 }}>
        {presets.map(c=>(<div key={c} onClick={()=>{onChange(c);setHex(c);}} style={{ width:16,height:16,borderRadius:3,background:c,cursor:"pointer",border:c===color?"2px solid var(--highlight)":c==="#000000"?"1px solid #444":"1px solid #888",boxSizing:"border-box" }}/>))}
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, step=0.5, min, max, unit='"' }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:3 }}>
      <span style={{ fontSize:11,color:"var(--text-secondary)",minWidth:22 }}>{label}</span>
      <input type="number" value={value} step={step} min={min} max={max} onChange={e=>onChange(parseFloat(e.target.value)||0)} style={{ width:52,fontSize:11,padding:"2px 3px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-primary)" }}/>
      <span style={{ fontSize:9,color:"var(--text-tertiary)" }}>{unit}</span>
    </div>
  );
}

function CoordRow({ labelX, labelY, vx, vy, onChangeX, onChangeY }) {
  return (<div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3 }}><NumInput label={labelX} value={vx} onChange={onChangeX}/><NumInput label={labelY} value={vy} onChange={onChangeY}/></div>);
}

// ── Rich text editor (simple contentEditable with toolbar) ──
function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (ref.current && !isInternalChange.current) {
      if (ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
    }
    isInternalChange.current = false;
  }, [value]);

  function handleInput() {
    isInternalChange.current = true;
    onChange(ref.current.innerHTML);
  }
  function exec(cmd, val) { document.execCommand(cmd, false, val); ref.current?.focus(); }

  const btnStyle = { background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-secondary)",cursor:"pointer",fontSize:12,padding:"2px 6px",minWidth:24 };

  return (
    <div style={{ border:"1px solid var(--border)",borderRadius:4,overflow:"hidden" }}>
      <div style={{ display:"flex",gap:2,padding:"3px 4px",background:"var(--bg-dark)",borderBottom:"1px solid var(--border)",flexWrap:"wrap" }}>
        <button onClick={()=>exec("bold")} style={{...btnStyle,fontWeight:"bold"}} title="Gras">B</button>
        <button onClick={()=>exec("italic")} style={{...btnStyle,fontStyle:"italic"}} title="Italique">I</button>
        <button onClick={()=>exec("underline")} style={{...btnStyle,textDecoration:"underline"}} title="Souligné">U</button>
        <span style={{ width:1,background:"var(--border)",margin:"0 2px" }}/>
        <button onClick={()=>exec("insertUnorderedList")} style={btnStyle} title="Liste à puces">• Liste</button>
        <button onClick={()=>exec("insertOrderedList")} style={btnStyle} title="Liste numérotée">1. Liste</button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight:60,padding:"6px 8px",fontSize:12,color:"var(--text-primary)",background:"var(--bg-input)",outline:"none",lineHeight:1.5 }}/>
    </div>
  );
}

// ── Structured list editor (for rules/objectives) ──
function StructuredList({ items, onChange, labelName="Nom", labelDesc="Description" }) {
  function update(id, patch) { onChange(items.map(it=>it.id===id?{...it,...patch}:it)); }
  function remove(id) { onChange(items.filter(it=>it.id!==id)); }
  function add() { onChange([...items, newListItem()]); }
  function move(id, dir) {
    const idx = items.findIndex(it=>it.id===id); if(idx<0) return;
    const ni = idx+dir; if(ni<0||ni>=items.length) return;
    const arr=[...items]; [arr[idx],arr[ni]]=[arr[ni],arr[idx]]; onChange(arr);
  }
  return (
    <div>
      {items.map((it,i)=>(
        <div key={it.id} style={{ background:"rgba(0,0,0,0.15)",borderRadius:4,padding:6,marginBottom:4,border:"1px solid var(--border)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:4,marginBottom:4 }}>
            <input type="text" value={it.name} onChange={e=>update(it.id,{name:e.target.value})} placeholder={labelName}
              style={{ flex:1,fontSize:12,padding:"3px 6px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-primary)",fontWeight:700 }}/>
            <button onClick={()=>move(it.id,-1)} style={{ background:"none",border:"none",color:"var(--text-secondary)",cursor:"pointer",fontSize:11 }}>▲</button>
            <button onClick={()=>move(it.id,1)} style={{ background:"none",border:"none",color:"var(--text-secondary)",cursor:"pointer",fontSize:11 }}>▼</button>
            <button onClick={()=>remove(it.id)} style={{ background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:11 }}>✕</button>
          </div>
          <RichTextEditor value={it.description} onChange={v=>update(it.id,{description:v})} placeholder={labelDesc}/>
        </div>
      ))}
      <button onClick={add} style={{ fontSize:11,padding:"4px 10px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text-secondary)",cursor:"pointer",width:"100%" }}>+ Ajouter</button>
    </div>
  );
}

// ══════════════════════════════════════
// ══  MAP SVG GENERATION (shared)  ══
// ══════════════════════════════════════
function generateMapSVGString(project, dpi) {
  if (!project) return "";
  const tableW = project.tableSize === "60x44" ? 60 : 44;
  const tableH = project.tableSize === "60x44" ? 44 : 30;
  const expW = Math.round(tableW * dpi);
  const expH = Math.round(tableH * dpi);
  let shapes = "";
  for (const obj of project.objects) shapes += shapeToSVGStr(obj, dpi, tableH);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${expW}" height="${expH}" viewBox="0 0 ${expW} ${expH}"><rect width="${expW}" height="${expH}" fill="#f5f0e8"/>${shapes}</svg>`;
}

function shapeToSVGStr(obj, scl, tableH) {
  const dash = obj.dashed ? `stroke-dasharray="${4*(obj.strokeWidth||2)} ${4*(obj.strokeWidth||2)}"` : "";
  const sw = obj.strokeWidth||2;
  const toX = x=>x*scl; const toY = y=>(tableH-y)*scl;
  switch(obj.type) {
    case "line": return `<line x1="${toX(obj.x1)}" y1="${toY(obj.y1)}" x2="${toX(obj.x2)}" y2="${toY(obj.y2)}" stroke="${obj.strokeColor}" stroke-width="${sw}" ${dash}/>`;
    case "arrow": {
      const aid=`ah_${obj.id}`;
      const midX=(toX(obj.x1)+toX(obj.x2))/2;const midY=(toY(obj.y1)+toY(obj.y2))/2;
      const dist=Math.sqrt((obj.x2-obj.x1)**2+(obj.y2-obj.y1)**2);
      const distLabel=`${Math.round(dist*10)/10}"`;const labelFs=scl*0.8;
      const angle=Math.atan2(toY(obj.y2)-toY(obj.y1),toX(obj.x2)-toX(obj.x1));
      const offsetDist=sw*4;const labelX=midX-Math.sin(angle)*offsetDist;const labelY=midY+Math.cos(angle)*offsetDist;
      let r=`<defs><marker id="${aid}_s" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto-start-reverse"><polygon points="0 0, 6 2, 0 4" fill="${obj.strokeColor}"/></marker><marker id="${aid}_e" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="${obj.strokeColor}"/></marker></defs><line x1="${toX(obj.x1)}" y1="${toY(obj.y1)}" x2="${toX(obj.x2)}" y2="${toY(obj.y2)}" stroke="${obj.strokeColor}" stroke-width="${sw}" ${dash} marker-start="url(#${aid}_s)" marker-end="url(#${aid}_e)"/>`;
      if(obj.showDistance) r+=`<text x="${labelX}" y="${labelY}" fill="${obj.strokeColor}" font-size="${labelFs}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-weight="bold">${distLabel}</text>`;
      return r;
    }
    case "rect": return `<rect x="${toX(Math.min(obj.x1,obj.x2))}" y="${toY(Math.max(obj.y1,obj.y2))}" width="${Math.abs(obj.x2-obj.x1)*scl}" height="${Math.abs(obj.y2-obj.y1)*scl}" stroke="${obj.strokeColor}" stroke-width="${sw}" ${dash} fill="${obj.fillColor||"transparent"}" fill-opacity="${obj.fillOpacity??0.3}"/>`;
    case "triangle": return `<polygon points="${toX(obj.x1)},${toY(obj.y1)} ${toX(obj.x2)},${toY(obj.y2)} ${toX(obj.x3)},${toY(obj.y3)}" stroke="${obj.strokeColor}" stroke-width="${sw}" ${dash} fill="${obj.fillColor||"transparent"}" fill-opacity="${obj.fillOpacity??0.3}"/>`;
    case "circle": return `<circle cx="${toX(obj.cx)}" cy="${toY(obj.cy)}" r="${obj.r*scl}" stroke="${obj.strokeColor}" stroke-width="${sw}" ${dash} fill="${obj.fillColor||"transparent"}" fill-opacity="${obj.fillOpacity??0.3}"/>`;
    case "objective": { const r=OBJECTIVE_RADIUS_INCH*scl;const cx=toX(obj.cx);const cy=toY(obj.cy);const fs=r*1.5; return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${obj.fillColor}" fill-opacity="${obj.fillOpacity??0.8}" stroke="#ffffff" stroke-width="${sw}"/><text x="${cx}" y="${cy}" fill="#ffffff" font-size="${fs}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">☠</text>`; }
    case "text": { const fs=(obj.fontSize||14)*scl/10; return `<text x="${toX(obj.x)}" y="${toY(obj.y)}" fill="${obj.textColor||"#000000"}" font-size="${fs}" font-family="sans-serif" dominant-baseline="middle">${obj.content||"Texte"}</text>`; }
    default: return "";
  }
}

// ══════════════════════════════════════
// ══  MAIN APP  ══
// ══════════════════════════════════════
export default function App() {
  // Navigation: "home", "editor", "scenario"
  const [page, setPage] = useState("home");
  const [projects, setProjects] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteScenarioId, setConfirmDeleteScenarioId] = useState(null);

  // Load/save
  useEffect(() => {
    try { const r=localStorage.getItem(STORAGE_KEY); if(r) setProjects(JSON.parse(r)); } catch{}
    try { const r=localStorage.getItem(SCENARIO_STORAGE_KEY); if(r) setScenarios(JSON.parse(r)); } catch{}
  }, []);
  useEffect(() => { try{localStorage.setItem(STORAGE_KEY,JSON.stringify(projects));}catch{} }, [projects]);
  useEffect(() => { try{localStorage.setItem(SCENARIO_STORAGE_KEY,JSON.stringify(scenarios));}catch{} }, [scenarios]);

  // Project CRUD
  function createProject(tableSize) {
    if(projects.length>=MAX_PROJECTS)return;
    const p={id:uid(),name:`Carte ${projects.length+1}`,tableSize,objects:[],created:Date.now()};
    setProjects([...projects,p]); setCurrentProjectId(p.id); setPage("editor");
  }
  function deleteProject(id) {
    if(confirmDeleteId===id){setProjects(projects.filter(p=>p.id!==id));setConfirmDeleteId(null);}
    else setConfirmDeleteId(id);
  }
  function duplicateProject(id) {
    if(projects.length>=MAX_PROJECTS)return;
    const src=projects.find(p=>p.id===id);if(!src)return;
    setProjects([...projects,{...JSON.parse(JSON.stringify(src)),id:uid(),name:src.name+" (copie)",created:Date.now()}]);
  }
  function renameProject(id,n){setProjects(projects.map(p=>p.id===id?{...p,name:n}:p));}
  function openProject(id){setCurrentProjectId(id);setPage("editor");}

  // Scenario CRUD
  function createScenario() {
    if(scenarios.length>=MAX_SCENARIOS)return;
    const s=newScenario(); s.name=`Scénario ${scenarios.length+1}`;
    setScenarios([...scenarios,s]); setCurrentScenarioId(s.id); setPage("scenario");
  }
  function deleteScenario(id) {
    if(confirmDeleteScenarioId===id){setScenarios(scenarios.filter(s=>s.id!==id));setConfirmDeleteScenarioId(null);}
    else setConfirmDeleteScenarioId(id);
  }
  function duplicateScenario(id) {
    if(scenarios.length>=MAX_SCENARIOS)return;
    const src=scenarios.find(s=>s.id===id);if(!src)return;
    setScenarios([...scenarios,{...JSON.parse(JSON.stringify(src)),id:uid(),name:src.name+" (copie)",created:Date.now()}]);
  }
  function renameScenario(id,n){setScenarios(scenarios.map(s=>s.id===id?{...s,name:n}:s));}
  function openScenario(id){setCurrentScenarioId(id);setPage("scenario");}
  function updateScenario(id,patch){setScenarios(scenarios.map(s=>s.id===id?{...s,...patch}:s));}

  // ══ HOME PAGE ══
  if (page === "home") {
    return (
      <div style={{...cssVars,background:"var(--bg-dark)",minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"var(--text-primary)",padding:24,overflowY:"auto"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <h1 style={{fontSize:28,fontWeight:800,letterSpacing:2,color:"var(--accent)",margin:0,textTransform:"uppercase"}}>⚔ W40K Deploy</h1>
          <p style={{color:"var(--text-secondary)",fontSize:13,marginTop:4}}>Générateur de cartes de déploiement & scénarios</p>
        </div>

        <div style={{display:"flex",gap:24,maxWidth:1000,margin:"0 auto",flexWrap:"wrap"}}>
          {/* Maps column */}
          <div style={{flex:1,minWidth:280}}>
            <h2 style={{fontSize:16,color:"var(--highlight)",marginBottom:12,borderBottom:"1px solid var(--border)",paddingBottom:6}}>🗺 Cartes ({projects.length}/{MAX_PROJECTS})</h2>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button onClick={()=>createProject("60x44")} style={{padding:"8px 14px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer"}}>+ 60×44"</button>
              <button onClick={()=>createProject("44x30")} style={{padding:"8px 14px",background:"var(--accent-secondary)",color:"#fff",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer"}}>+ 44×30"</button>
            </div>
            {projects.length===0&&<p style={{fontSize:11,color:"var(--text-tertiary)",fontStyle:"italic"}}>Aucune carte.</p>}
            {projects.map(p=>(
              <div key={p.id} style={{background:"var(--bg-panel)",borderRadius:6,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:8,border:"1px solid var(--border)"}}>
                <div style={{flex:1,cursor:"pointer"}} onClick={()=>openProject(p.id)}>
                  <div style={{fontWeight:700,fontSize:13}}>{p.name}</div>
                  <div style={{fontSize:10,color:"var(--text-tertiary)"}}>{p.tableSize==="60x44"?"60×44\"":"44×30\""} · {p.objects.length} objets</div>
                </div>
                <input type="text" value={p.name} onChange={e=>renameProject(p.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{width:100,fontSize:10,padding:"3px 5px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-primary)"}}/>
                <button onClick={e=>{e.stopPropagation();duplicateProject(p.id);}} title="Dupliquer" style={{background:"none",border:"none",color:"var(--text-secondary)",cursor:"pointer",fontSize:14}}>📋</button>
                <button onClick={e=>{e.stopPropagation();deleteProject(p.id);}} style={{background:confirmDeleteId===p.id?"var(--accent)":"none",border:"none",color:confirmDeleteId===p.id?"#fff":"var(--accent)",cursor:"pointer",fontSize:confirmDeleteId===p.id?10:14,borderRadius:3,padding:confirmDeleteId===p.id?"2px 6px":"0"}}>{confirmDeleteId===p.id?"Confirmer ?":"🗑"}</button>
              </div>
            ))}
          </div>

          {/* Scenarios column */}
          <div style={{flex:1,minWidth:280}}>
            <h2 style={{fontSize:16,color:"var(--highlight)",marginBottom:12,borderBottom:"1px solid var(--border)",paddingBottom:6}}>📜 Scénarios ({scenarios.length}/{MAX_SCENARIOS})</h2>
            <button onClick={createScenario} style={{padding:"8px 14px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",marginBottom:12}}>+ Nouveau scénario</button>
            {scenarios.length===0&&<p style={{fontSize:11,color:"var(--text-tertiary)",fontStyle:"italic"}}>Aucun scénario.</p>}
            {scenarios.map(s=>{
              const linkedMap=projects.find(p=>p.id===s.mapId);
              return (
                <div key={s.id} style={{background:"var(--bg-panel)",borderRadius:6,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:8,border:"1px solid var(--border)"}}>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>openScenario(s.id)}>
                    <div style={{fontWeight:700,fontSize:13}}>{s.name}</div>
                    <div style={{fontSize:10,color:"var(--text-tertiary)"}}>{linkedMap?`Carte: ${linkedMap.name}`:"Aucune carte"}</div>
                  </div>
                  <input type="text" value={s.name} onChange={e=>renameScenario(s.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{width:100,fontSize:10,padding:"3px 5px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-primary)"}}/>
                  <button onClick={e=>{e.stopPropagation();duplicateScenario(s.id);}} title="Dupliquer" style={{background:"none",border:"none",color:"var(--text-secondary)",cursor:"pointer",fontSize:14}}>📋</button>
                  <button onClick={e=>{e.stopPropagation();deleteScenario(s.id);}} style={{background:confirmDeleteScenarioId===s.id?"var(--accent)":"none",border:"none",color:confirmDeleteScenarioId===s.id?"#fff":"var(--accent)",cursor:"pointer",fontSize:confirmDeleteScenarioId===s.id?10:14,borderRadius:3,padding:confirmDeleteScenarioId===s.id?"2px 6px":"0"}}>{confirmDeleteScenarioId===s.id?"Confirmer ?":"🗑"}</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ══ SCENARIO EDITOR ══
  if (page === "scenario") {
    return <ScenarioEditor
      scenarios={scenarios} setScenarios={setScenarios} projects={projects}
      scenarioId={currentScenarioId} updateScenario={updateScenario}
      onBack={()=>setPage("home")}
      generateMapSVGString={generateMapSVGString}
    />;
  }

  // ══ MAP EDITOR ══
  return <MapEditor
    projects={projects} setProjects={setProjects}
    projectId={currentProjectId}
    onBack={()=>setPage("home")}
  />;
}

// ══════════════════════════════════════
// ══  SCENARIO EDITOR COMPONENT  ══
// ══════════════════════════════════════
function ScenarioEditor({ scenarios, setScenarios, projects, scenarioId, updateScenario, onBack, generateMapSVGString }) {
  const [showPreview, setShowPreview] = useState(false);
  const scenario = scenarios.find(s=>s.id===scenarioId);
  if (!scenario) return null;

  function upd(patch) { updateScenario(scenarioId, patch); }

  const linkedMap = projects.find(p=>p.id===scenario.mapId);

  // Section component
  function Section({ title, children, show=true }) {
    if(!show) return null;
    return (
      <div style={{marginBottom:16}}>
        <h3 style={{fontSize:13,color:"var(--highlight)",marginBottom:6,borderBottom:"1px solid var(--border)",paddingBottom:4}}>{title}</h3>
        {children}
      </div>
    );
  }

  // ── Preview / PDF Export ──
  function renderPreviewHTML() {
    let html = `<div style="font-family:Georgia,serif;max-width:170mm;margin:0 auto;padding:20mm 20mm;color:#1a1a1a;line-height:1.6;">`;
    if (scenario.title) html += `<h1 style="text-align:center;font-size:24pt;margin-bottom:4mm;border-bottom:2px solid #333;padding-bottom:3mm;">${scenario.title}</h1>`;
    if (scenario.narrative) html += `<div style="margin-bottom:6mm;font-size:11pt;text-align:justify;">${scenario.narrative}</div>`;
    if (scenario.mapId && linkedMap) {
      const svgStr = generateMapSVGString(linkedMap, 150);
      html += `<div style="text-align:center;margin:6mm 0;">${svgStr}</div>`;
    }
    function renderItems(title, items) {
      if (!items || items.length === 0) return "";
      const filtered = items.filter(it=>it.name||it.description);
      if (filtered.length===0) return "";
      let s = `<h2 style="font-size:14pt;margin:5mm 0 3mm;color:#333;border-bottom:1px solid #999;padding-bottom:2mm;">${title}</h2>`;
      for (const it of filtered) {
        s += `<div style="margin-bottom:3mm;"><strong style="font-size:11pt;">${it.name}</strong>`;
        if (it.description) s += `<div style="font-size:10pt;margin-top:1mm;padding-left:4mm;">${it.description}</div>`;
        s += `</div>`;
      }
      return s;
    }
    html += renderItems("Règles Spéciales", scenario.specialRules);
    html += renderItems("Objectifs Primaires", scenario.primaryObjectives);
    html += renderItems("Objectifs Secondaires", scenario.secondaryObjectives);
    html += renderItems("Objectifs Tertiaires", scenario.tertiaryObjectives);
    html += `</div>`;
    return html;
  }

  function exportPDF() {
    const content = renderPreviewHTML();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${scenario.name}</title><style>@page{size:A4 portrait;margin:0;}body{margin:0;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(()=>{printWindow.print();},500);
  }

  // ── Preview overlay ──
  if (showPreview) {
    return (
      <div style={{...cssVars,background:"var(--bg-dark)",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"var(--text-primary)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",padding:"6px 12px",background:"var(--bg-panel)",borderBottom:"1px solid var(--border)",gap:8}}>
          <button onClick={()=>setShowPreview(false)} style={{background:"none",border:"none",color:"var(--accent)",fontSize:18,cursor:"pointer"}}>←</button>
          <span style={{fontWeight:700,fontSize:14,flex:1}}>Aperçu — {scenario.name}</span>
          <button onClick={exportPDF} style={{padding:"4px 12px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:4,fontWeight:700,fontSize:12,cursor:"pointer"}}>Exporter PDF</button>
        </div>
        <div style={{flex:1,overflow:"auto",background:"#666",display:"flex",justifyContent:"center",padding:20}}>
          <div style={{background:"#fff",width:"210mm",minHeight:"297mm",boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}} dangerouslySetInnerHTML={{__html:renderPreviewHTML()}}/>
        </div>
      </div>
    );
  }

  // ── Editor ──
  return (
    <div style={{...cssVars,background:"var(--bg-dark)",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"var(--text-primary)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",padding:"6px 12px",background:"var(--bg-panel)",borderBottom:"1px solid var(--border)",gap:8,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"var(--accent)",fontSize:18,cursor:"pointer"}}>←</button>
        <span style={{fontWeight:700,fontSize:14,flex:1}}>{scenario.name}</span>
        <button onClick={()=>setShowPreview(true)} style={{padding:"4px 10px",background:"var(--accent-secondary)",color:"#fff",border:"none",borderRadius:4,fontWeight:700,fontSize:12,cursor:"pointer"}}>👁 Aperçu</button>
        <button onClick={exportPDF} style={{padding:"4px 12px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:4,fontWeight:700,fontSize:12,cursor:"pointer"}}>Exporter PDF</button>
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:"auto",padding:16,maxWidth:700,margin:"0 auto",width:"100%"}}>
        {/* Title */}
        <Section title="Titre du scénario">
          <input type="text" value={scenario.title} onChange={e=>upd({title:e.target.value})} placeholder="Nom du scénario..."
            style={{width:"100%",fontSize:16,padding:"6px 10px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text-primary)",fontWeight:700}}/>
        </Section>

        {/* Map selection */}
        <Section title="Carte de déploiement">
          <select value={scenario.mapId||""} onChange={e=>upd({mapId:e.target.value||null})}
            style={{width:"100%",fontSize:12,padding:"6px 8px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text-primary)"}}>
            <option value="">— Aucune carte —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name} ({p.tableSize==="60x44"?"60×44\"":"44×30\""})</option>)}
          </select>
          {linkedMap && <p style={{fontSize:10,color:"var(--text-tertiary)",marginTop:4}}>Carte sélectionnée : {linkedMap.name} · {linkedMap.objects.length} objets</p>}
        </Section>

        {/* Narrative */}
        <Section title="Contexte narratif">
          <RichTextEditor value={scenario.narrative} onChange={v=>upd({narrative:v})} placeholder="Décrivez le contexte narratif du scénario..."/>
        </Section>

        {/* Special rules */}
        <Section title="Règles Spéciales">
          <StructuredList items={scenario.specialRules} onChange={v=>upd({specialRules:v})} labelName="Nom de la règle" labelDesc="Description de la règle"/>
        </Section>

        {/* Primary objectives */}
        <Section title="Objectifs Primaires">
          <StructuredList items={scenario.primaryObjectives} onChange={v=>upd({primaryObjectives:v})} labelName="Nom de l'objectif" labelDesc="Description"/>
        </Section>

        {/* Secondary objectives */}
        <Section title="Objectifs Secondaires">
          <StructuredList items={scenario.secondaryObjectives} onChange={v=>upd({secondaryObjectives:v})} labelName="Nom de l'objectif" labelDesc="Description"/>
        </Section>

        {/* Tertiary objectives */}
        <Section title="Objectifs Tertiaires">
          <StructuredList items={scenario.tertiaryObjectives} onChange={v=>upd({tertiaryObjectives:v})} labelName="Nom de l'objectif" labelDesc="Description"/>
        </Section>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ══  MAP EDITOR COMPONENT  ══
// ══════════════════════════════════════
function MapEditor({ projects, setProjects, projectId, onBack }) {
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState("select");
  const [drawing, setDrawing] = useState(null);
  const [panelTab, setPanelTab] = useState("tree");
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({w:0,h:0});
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({x:0,y:0});
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({x:0,y:0,ox:0,oy:0});
  const pinchRef = useRef({dist:0,zoom:1});

  const project = projects.find(p=>p.id===projectId);
  const tableW = project?(project.tableSize==="60x44"?60:44):60;
  const tableH = project?(project.tableSize==="60x44"?44:30):44;
  const svgW = tableW*PIXELS_PER_INCH; const svgH = tableH*PIXELS_PER_INCH;
  const PPI = PIXELS_PER_INCH;

  useEffect(()=>{setZoom(1);setPanOffset({x:0,y:0});},[projectId]);
  useEffect(()=>{
    function resize(){const c=containerRef.current;if(!c)return;setCanvasSize({w:c.clientWidth,h:c.clientHeight});}
    resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);
  },[projectId]);

  const viewBoxW=svgW/zoom;const viewBoxH=svgH/zoom;
  const viewBoxX=(svgW-viewBoxW)/2+panOffset.x;const viewBoxY=(svgH-viewBoxH)/2+panOffset.y;
  function resetView(){setZoom(1);setPanOffset({x:0,y:0});}

  const screenToInch=useCallback((sx,sy)=>{
    const el=canvasRef.current;if(!el)return{x:0,y:0};const rect=el.getBoundingClientRect();
    const vbX=viewBoxX+(sx-rect.left)/rect.width*viewBoxW;const vbY=viewBoxY+(sy-rect.top)/rect.height*viewBoxH;
    let ix=vbX/PPI;let iy=tableH-vbY/PPI;
    if(snapToGrid){ix=Math.round(ix);iy=Math.round(iy);}
    return{x:Math.max(0,Math.min(tableW,ix)),y:Math.max(0,Math.min(tableH,iy))};
  },[viewBoxX,viewBoxY,viewBoxW,viewBoxH,tableW,tableH,snapToGrid]);

  useEffect(()=>{
    const el=canvasRef.current;if(!el)return;
    function h(e){e.preventDefault();setZoom(z=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,z*(e.deltaY<0?1.15:1/1.15))));}
    el.addEventListener("wheel",h,{passive:false});return()=>el.removeEventListener("wheel",h);
  },[projectId]);

  useEffect(()=>{
    const el=canvasRef.current;if(!el)return;
    function dist(t){const dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.sqrt(dx*dx+dy*dy);}
    function mid(t){return{x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2};}
    function ts(e){if(e.touches.length===2){e.preventDefault();pinchRef.current={dist:dist(e.touches),mid:mid(e.touches),zoom,panX:panOffset.x,panY:panOffset.y};}}
    function tm(e){if(e.touches.length===2){e.preventDefault();const nd=dist(e.touches);const nm=mid(e.touches);const f=nd/pinchRef.current.dist;const nz=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,pinchRef.current.zoom*f));setZoom(nz);const rect=el.getBoundingClientRect();const dx=(nm.x-pinchRef.current.mid.x)/rect.width*(svgW/nz);const dy=(nm.y-pinchRef.current.mid.y)/rect.height*(svgH/nz);setPanOffset({x:pinchRef.current.panX-dx,y:pinchRef.current.panY-dy});}}
    el.addEventListener("touchstart",ts,{passive:false});el.addEventListener("touchmove",tm,{passive:false});
    return()=>{el.removeEventListener("touchstart",ts);el.removeEventListener("touchmove",tm);};
  },[projectId,zoom,panOffset,svgW,svgH]);

  function updateObjects(o){setProjects(projects.map(p=>p.id===projectId?{...p,objects:o}:p));}
  const objects=project?project.objects:[];
  const selectedObj=objects.find(o=>o.id===selectedId);
  function updateObject(id,patch){updateObjects(objects.map(o=>o.id===id?{...o,...patch}:o));}
  function deleteObject(id){updateObjects(objects.filter(o=>o.id!==id));if(selectedId===id)setSelectedId(null);}
  function moveObject(id,dir){const idx=objects.findIndex(o=>o.id===id);if(idx<0)return;const ni=idx+dir;if(ni<0||ni>=objects.length)return;const a=[...objects];[a[idx],a[ni]]=[a[ni],a[idx]];updateObjects(a);}

  function handlePanStart(e){if(e.button===1||e.button===2){e.preventDefault();setIsPanning(true);panStart.current={x:e.clientX,y:e.clientY,ox:panOffset.x,oy:panOffset.y};}}
  function handlePanMove(e){if(!isPanning)return;const el=canvasRef.current;if(!el)return;const rect=el.getBoundingClientRect();setPanOffset({x:panStart.current.ox-(e.clientX-panStart.current.x)/rect.width*viewBoxW,y:panStart.current.oy-(e.clientY-panStart.current.y)/rect.height*viewBoxH});}
  function handlePanEnd(){if(isPanning)setIsPanning(false);}

  function handlePointerDown(e){if(e.button===1||e.button===2){handlePanStart(e);return;}if(tool==="select"||!project)return;setDrawing({type:tool,start:screenToInch(e.clientX,e.clientY),current:screenToInch(e.clientX,e.clientY)});}
  function handlePointerMove(e){if(isPanning){handlePanMove(e);return;}if(!drawing)return;setDrawing({...drawing,current:screenToInch(e.clientX,e.clientY)});}
  function handlePointerUp(){
    if(isPanning){handlePanEnd();return;}if(!drawing)return;
    const{type,start,current}=drawing;const factory=shapeDefaults[type];if(!factory){setDrawing(null);return;}
    const obj={...factory(),id:uid()};
    if(type==="line"||type==="arrow"){obj.x1=start.x;obj.y1=start.y;obj.x2=current.x;obj.y2=current.y;}
    else if(type==="rect"){obj.x1=Math.min(start.x,current.x);obj.y1=Math.min(start.y,current.y);obj.x2=Math.max(start.x,current.x);obj.y2=Math.max(start.y,current.y);}
    else if(type==="triangle"){obj.x1=start.x;obj.y1=start.y;obj.x2=(start.x+current.x)/2;obj.y2=current.y;obj.x3=current.x;obj.y3=start.y;}
    else if(type==="circle"){obj.cx=start.x;obj.cy=start.y;obj.r=Math.max(0.5,Math.sqrt((current.x-start.x)**2+(current.y-start.y)**2));}
    else if(type==="objective"){obj.cx=start.x;obj.cy=start.y;}
    else if(type==="text"){obj.x=start.x;obj.y=start.y;}
    updateObjects([...objects,obj]);setSelectedId(obj.id);setDrawing(null);setPanelTab("props");
  }

  function renderShape(obj,forExport=false,expScale=PPI){
    const s=forExport?expScale:PPI;const dash=obj.dashed?`${4*(obj.strokeWidth||2)} ${4*(obj.strokeWidth||2)}`:undefined;
    const sw=obj.strokeWidth||2;const toX=x=>x*s;const toY=y=>(tableH-y)*s;
    const sel=!forExport&&obj.id===selectedId;const selStroke=sel?{filter:"drop-shadow(0 0 3px #00ffff)"}:{};
    const swScaled=forExport?sw:sw/zoom;
    switch(obj.type){
      case "line": return <line key={obj.id} x1={toX(obj.x1)} y1={toY(obj.y1)} x2={toX(obj.x2)} y2={toY(obj.y2)} stroke={obj.strokeColor} strokeWidth={swScaled} strokeDasharray={dash} style={selStroke}/>;
      case "arrow":{
        const aid=`ah_${obj.id}_${sw}`;const ms=6;const mh=4;
        const midX=(toX(obj.x1)+toX(obj.x2))/2;const midY=(toY(obj.y1)+toY(obj.y2))/2;
        const dist=Math.sqrt((obj.x2-obj.x1)**2+(obj.y2-obj.y1)**2);const distLabel=`${Math.round(dist*10)/10}"`;
        const labelFs=forExport?s*0.8:25/zoom;
        const angle=Math.atan2(toY(obj.y2)-toY(obj.y1),toX(obj.x2)-toX(obj.x1));
        const offsetDist=forExport?sw*4:(sw+6)/zoom;const labelX=midX-Math.sin(angle)*offsetDist;const labelY=midY+Math.cos(angle)*offsetDist;
        return <g key={obj.id} style={selStroke}>
          <defs>
            <marker id={`${aid}_s`} markerWidth={ms} markerHeight={mh} refX={0} refY={mh/2} orient="auto-start-reverse" markerUnits="strokeWidth"><polygon points={`0 0,${ms} ${mh/2},0 ${mh}`} fill={obj.strokeColor}/></marker>
            <marker id={`${aid}_e`} markerWidth={ms} markerHeight={mh} refX={0} refY={mh/2} orient="auto" markerUnits="strokeWidth"><polygon points={`0 0,${ms} ${mh/2},0 ${mh}`} fill={obj.strokeColor}/></marker>
          </defs>
          <line x1={toX(obj.x1)} y1={toY(obj.y1)} x2={toX(obj.x2)} y2={toY(obj.y2)} stroke={obj.strokeColor} strokeWidth={swScaled} strokeDasharray={dash} markerStart={`url(#${aid}_s)`} markerEnd={`url(#${aid}_e)`}/>
          {obj.showDistance&&<text x={labelX} y={labelY} fill={obj.strokeColor} fontSize={labelFs} textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif" fontWeight="bold">{distLabel}</text>}
        </g>;
      }
      case "rect": return <rect key={obj.id} x={toX(Math.min(obj.x1,obj.x2))} y={toY(Math.max(obj.y1,obj.y2))} width={Math.abs(obj.x2-obj.x1)*s} height={Math.abs(obj.y2-obj.y1)*s} stroke={obj.strokeColor} strokeWidth={swScaled} strokeDasharray={dash} fill={obj.fillColor||"transparent"} fillOpacity={obj.fillOpacity??0.3} style={selStroke}/>;
      case "triangle":{const pts=`${toX(obj.x1)},${toY(obj.y1)} ${toX(obj.x2)},${toY(obj.y2)} ${toX(obj.x3)},${toY(obj.y3)}`;return <polygon key={obj.id} points={pts} stroke={obj.strokeColor} strokeWidth={swScaled} strokeDasharray={dash} fill={obj.fillColor||"transparent"} fillOpacity={obj.fillOpacity??0.3} style={selStroke}/>;}
      case "circle": return <circle key={obj.id} cx={toX(obj.cx)} cy={toY(obj.cy)} r={obj.r*s} stroke={obj.strokeColor} strokeWidth={swScaled} strokeDasharray={dash} fill={obj.fillColor||"transparent"} fillOpacity={obj.fillOpacity??0.3} style={selStroke}/>;
      case "objective":{const r=OBJECTIVE_RADIUS_INCH*s;const cx=toX(obj.cx);const cy=toY(obj.cy);const fs=r*1.5;return <g key={obj.id} style={selStroke}><circle cx={cx} cy={cy} r={r} fill={obj.fillColor} fillOpacity={obj.fillOpacity??0.8} stroke="#ffffff" strokeWidth={swScaled}/><text x={cx} y={cy} fill="#ffffff" fontSize={fs} textAnchor="middle" dominantBaseline="central" fontFamily="sans-serif">☠</text></g>;}
      case "text":{const fs=(obj.fontSize||14)*s/10;return <text key={obj.id} x={toX(obj.x)} y={toY(obj.y)} fill={obj.textColor||"#000000"} fontSize={fs} fontFamily="sans-serif" dominantBaseline="middle" style={selStroke}>{obj.content||"Texte"}</text>;}
      default:return null;
    }
  }

  function renderDrawingPreview(){
    if(!drawing)return null;const{type,start,current}=drawing;
    const toX=x=>x*PPI;const toY=y=>(tableH-y)*PPI;const sw=1.5/zoom;
    const st={stroke:"#00ffff",strokeWidth:sw,strokeDasharray:"4 4",fill:"rgba(0,255,255,0.15)"};
    switch(type){
      case "line":case "arrow":return <line x1={toX(start.x)} y1={toY(start.y)} x2={toX(current.x)} y2={toY(current.y)} {...st} fill="none"/>;
      case "rect":return <rect x={toX(Math.min(start.x,current.x))} y={toY(Math.max(start.y,current.y))} width={Math.abs(current.x-start.x)*PPI} height={Math.abs(current.y-start.y)*PPI} {...st}/>;
      case "triangle":return <polygon points={`${toX(start.x)},${toY(start.y)} ${toX((start.x+current.x)/2)},${toY(current.y)} ${toX(current.x)},${toY(start.y)}`} {...st}/>;
      case "circle":{const r=Math.sqrt((current.x-start.x)**2+(current.y-start.y)**2)*PPI;return <circle cx={toX(start.x)} cy={toY(start.y)} r={r} {...st}/>;}
      case "objective":return <circle cx={toX(start.x)} cy={toY(start.y)} r={OBJECTIVE_RADIUS_INCH*PPI} {...st}/>;
      default:return null;
    }
  }

  function exportPNG(){
    if(!project)return;const expW=Math.round(tableW*DPI_EXPORT);const expH=Math.round(tableH*DPI_EXPORT);
    const svgStr=generateMapSVGString(project,DPI_EXPORT);
    const blob=new Blob([svgStr],{type:"image/svg+xml"});const url=URL.createObjectURL(blob);const img=new Image();
    img.onload=()=>{const cvs=document.createElement("canvas");cvs.width=expW;cvs.height=expH;cvs.getContext("2d").drawImage(img,0,0);URL.revokeObjectURL(url);cvs.toBlob(b=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`${project.name.replace(/[^a-zA-Z0-9_-]/g,"_")}.png`;a.click();},"image/png");};
    img.src=url;
  }

  const tools=[{id:"select",icon:"↖",label:"Sélect."},{id:"line",icon:"╱",label:"Droite"},{id:"arrow",icon:"↔",label:"Flèche"},{id:"rect",icon:"▭",label:"Rect."},{id:"triangle",icon:"△",label:"Triangle"},{id:"circle",icon:"○",label:"Cercle"},{id:"objective",icon:"☠",label:"Objectif"},{id:"text",icon:"A",label:"Texte"}];
  const gridStrokeW=0.3/zoom;const gridStrokeWThick=0.8/zoom;const gridFontSize=Math.max(4,9/zoom);

  return (
    <div style={{...cssVars,background:"var(--bg-dark)",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"var(--text-primary)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",padding:"6px 12px",background:"var(--bg-panel)",borderBottom:"1px solid var(--border)",gap:8,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"var(--accent)",fontSize:18,cursor:"pointer",padding:"2px 6px"}}>←</button>
        <span style={{fontWeight:700,fontSize:14,flex:1,minWidth:80}}>{project?.name}</span>
        <span style={{fontSize:10,color:"var(--text-tertiary)"}}>{tableW}×{tableH}"</span>
        <label style={{fontSize:11,display:"flex",alignItems:"center",gap:4,color:"var(--text-secondary)"}}><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/> Grille</label>
        <label style={{fontSize:11,display:"flex",alignItems:"center",gap:4,color:"var(--text-secondary)"}}><input type="checkbox" checked={snapToGrid} onChange={e=>setSnapToGrid(e.target.checked)}/> Aimant.</label>
        <button onClick={exportPNG} style={{padding:"4px 12px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:4,fontWeight:700,fontSize:12,cursor:"pointer"}}>Export PNG</button>
      </div>
      <div style={{display:"flex",padding:"4px 8px",gap:2,background:"var(--bg-panel)",borderBottom:"1px solid var(--border)",flexShrink:0,overflowX:"auto"}}>
        {tools.map(t=><button key={t.id} onClick={()=>setTool(t.id)} style={{padding:"6px 10px",border:tool===t.id?"2px solid var(--highlight)":"1px solid var(--border)",borderRadius:4,background:tool===t.id?"var(--bg-input)":"transparent",color:tool===t.id?"var(--highlight)":"var(--text-secondary)",fontSize:11,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:48}}><span style={{fontSize:16}}>{t.icon}</span><span>{t.label}</span></button>)}
      </div>
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div ref={containerRef} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#000000",overflow:"hidden",position:"relative"}} onContextMenu={e=>e.preventDefault()}>
          <svg ref={canvasRef} width={canvasSize.w} height={canvasSize.h} viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`} preserveAspectRatio="xMidYMid meet"
            style={{cursor:isPanning?"grabbing":tool==="select"?"default":"crosshair",touchAction:"none"}}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
            onClick={e=>{if(tool!=="select"||isPanning)return;const pt=screenToInch(e.clientX,e.clientY);let found=null;for(let i=objects.length-1;i>=0;i--){if(hitTest(objects[i],pt.x,pt.y)){found=objects[i].id;break;}}setSelectedId(found);if(found)setPanelTab("props");}}>
            <rect x={viewBoxX} y={viewBoxY} width={viewBoxW} height={viewBoxH} fill="#000000"/>
            <rect x={0} y={0} width={svgW} height={svgH} fill="var(--bg-canvas)"/>
            {objects.map(obj=>renderShape(obj))}
            {renderDrawingPreview()}
            {showGrid&&<>{Array.from({length:tableW+1},(_,i)=><line key={`gx${i}`} x1={i*PPI} y1={0} x2={i*PPI} y2={svgH} stroke={i%6===0?"#ccbbaa":"#ddd5c8"} strokeWidth={i%6===0?gridStrokeWThick:gridStrokeW}/>)}
              {Array.from({length:tableH+1},(_,i)=><line key={`gy${i}`} x1={0} y1={(tableH-i)*PPI} x2={svgW} y2={(tableH-i)*PPI} stroke={i%6===0?"#ccbbaa":"#ddd5c8"} strokeWidth={i%6===0?gridStrokeWThick:gridStrokeW}/>)}
              {Array.from({length:Math.floor(tableW/6)+1},(_,i)=><text key={`lx${i}`} x={i*6*PPI} y={svgH-2/zoom} fontSize={gridFontSize} fill="#998877" textAnchor="middle">{i*6}"</text>)}
              {Array.from({length:Math.floor(tableH/6)+1},(_,i)=><text key={`ly${i}`} x={4/zoom} y={(tableH-i*6)*PPI} fontSize={gridFontSize} fill="#998877" dominantBaseline="middle">{i*6}"</text>)}</>}
          </svg>
          <div style={{position:"absolute",bottom:12,right:12,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:"#fff",background:"rgba(0,0,0,0.6)",padding:"3px 8px",borderRadius:4,fontFamily:"monospace"}}>×{zoom.toFixed(1)}</span>
            <button onClick={resetView} title="Réinitialiser la vue" style={{padding:"6px 10px",background:"var(--accent-secondary)",color:"#fff",border:"none",borderRadius:4,fontWeight:700,fontSize:12,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>⌂ Vue</button>
          </div>
        </div>
        <div style={{width:260,background:"var(--bg-panel)",borderLeft:"1px solid var(--border)",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          <div style={{display:"flex",borderBottom:"1px solid var(--border)"}}>
            <button onClick={()=>setPanelTab("tree")} style={{flex:1,padding:"8px 0",background:panelTab==="tree"?"var(--bg-input)":"transparent",border:"none",borderBottom:panelTab==="tree"?"2px solid var(--highlight)":"2px solid transparent",color:panelTab==="tree"?"var(--highlight)":"var(--text-secondary)",fontSize:12,fontWeight:700,cursor:"pointer"}}>Arbre</button>
            <button onClick={()=>setPanelTab("props")} style={{flex:1,padding:"8px 0",background:panelTab==="props"?"var(--bg-input)":"transparent",border:"none",borderBottom:panelTab==="props"?"2px solid var(--highlight)":"2px solid transparent",color:panelTab==="props"?"var(--highlight)":"var(--text-secondary)",fontSize:12,fontWeight:700,cursor:"pointer"}}>Propriétés</button>
          </div>
          <div style={{flex:1,overflow:"auto",padding:8}}>
            {panelTab==="tree"&&<div>
              {objects.length===0&&<p style={{fontSize:11,color:"var(--text-tertiary)",fontStyle:"italic"}}>Aucun objet</p>}
              {[...objects].reverse().map((obj,ri)=>{const idx=objects.length-1-ri;return(
                <div key={obj.id} onClick={()=>{setSelectedId(obj.id);setPanelTab("props");}} style={{padding:"5px 6px",marginBottom:2,borderRadius:4,cursor:"pointer",background:obj.id===selectedId?"var(--bg-input)":"transparent",border:obj.id===selectedId?"1px solid var(--highlight)":"1px solid transparent",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10,color:"var(--text-tertiary)",width:16}}>{idx}</span>
                  <span style={{flex:1,fontSize:11,color:"var(--text-primary)"}}>{obj.name}</span>
                  <button onClick={e=>{e.stopPropagation();moveObject(obj.id,1);}} style={{background:"none",border:"none",color:"var(--text-secondary)",cursor:"pointer",fontSize:11,padding:"0 2px"}}>▲</button>
                  <button onClick={e=>{e.stopPropagation();moveObject(obj.id,-1);}} style={{background:"none",border:"none",color:"var(--text-secondary)",cursor:"pointer",fontSize:11,padding:"0 2px"}}>▼</button>
                  <button onClick={e=>{e.stopPropagation();deleteObject(obj.id);}} style={{background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:11,padding:"0 2px"}}>✕</button>
                </div>);})}
            </div>}
            {panelTab==="props"&&selectedObj&&<div>
              <div style={{marginBottom:8}}><span style={{fontSize:10,color:"var(--text-tertiary)"}}>Nom</span><input type="text" value={selectedObj.name} onChange={e=>updateObject(selectedId,{name:e.target.value})} style={{width:"100%",fontSize:12,padding:"4px 6px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text-primary)",marginTop:2}}/></div>
              <div style={{marginBottom:8,padding:6,background:"rgba(0,0,0,0.2)",borderRadius:4}}>
                <span style={{fontSize:10,color:"var(--text-tertiary)",display:"block",marginBottom:4}}>Coordonnées</span>
                {(selectedObj.type==="line"||selectedObj.type==="arrow")&&<><CoordRow labelX="X1" labelY="Y1" vx={selectedObj.x1} vy={selectedObj.y1} onChangeX={v=>updateObject(selectedId,{x1:v})} onChangeY={v=>updateObject(selectedId,{y1:v})}/><CoordRow labelX="X2" labelY="Y2" vx={selectedObj.x2} vy={selectedObj.y2} onChangeX={v=>updateObject(selectedId,{x2:v})} onChangeY={v=>updateObject(selectedId,{y2:v})}/></>}
                {selectedObj.type==="rect"&&<><CoordRow labelX="X1" labelY="Y1" vx={selectedObj.x1} vy={selectedObj.y1} onChangeX={v=>updateObject(selectedId,{x1:v})} onChangeY={v=>updateObject(selectedId,{y1:v})}/><CoordRow labelX="X2" labelY="Y2" vx={selectedObj.x2} vy={selectedObj.y2} onChangeX={v=>updateObject(selectedId,{x2:v})} onChangeY={v=>updateObject(selectedId,{y2:v})}/></>}
                {selectedObj.type==="triangle"&&<><CoordRow labelX="X1" labelY="Y1" vx={selectedObj.x1} vy={selectedObj.y1} onChangeX={v=>updateObject(selectedId,{x1:v})} onChangeY={v=>updateObject(selectedId,{y1:v})}/><CoordRow labelX="X2" labelY="Y2" vx={selectedObj.x2} vy={selectedObj.y2} onChangeX={v=>updateObject(selectedId,{x2:v})} onChangeY={v=>updateObject(selectedId,{y2:v})}/><CoordRow labelX="X3" labelY="Y3" vx={selectedObj.x3} vy={selectedObj.y3} onChangeX={v=>updateObject(selectedId,{x3:v})} onChangeY={v=>updateObject(selectedId,{y3:v})}/></>}
                {(selectedObj.type==="circle"||selectedObj.type==="objective")&&<><CoordRow labelX="CX" labelY="CY" vx={selectedObj.cx} vy={selectedObj.cy} onChangeX={v=>updateObject(selectedId,{cx:v})} onChangeY={v=>updateObject(selectedId,{cy:v})}/>{selectedObj.type==="circle"&&<NumInput label="R" value={selectedObj.r} onChange={v=>updateObject(selectedId,{r:v})}/>}</>}
                {selectedObj.type==="text"&&<CoordRow labelX="X" labelY="Y" vx={selectedObj.x} vy={selectedObj.y} onChangeX={v=>updateObject(selectedId,{x:v})} onChangeY={v=>updateObject(selectedId,{y:v})}/>}
              </div>
              <div style={{marginBottom:8,padding:6,background:"rgba(0,0,0,0.2)",borderRadius:4}}>
                <span style={{fontSize:10,color:"var(--text-tertiary)",display:"block",marginBottom:4}}>Style</span>
                {selectedObj.type!=="text"&&selectedObj.type!=="objective"&&<>
                  <ColorPicker label="Contour" color={selectedObj.strokeColor||"#ff0000"} onChange={v=>updateObject(selectedId,{strokeColor:v})}/>
                  <NumInput label="Épaiss." value={selectedObj.strokeWidth||2} onChange={v=>updateObject(selectedId,{strokeWidth:v})} step={0.5} min={0.5} max={20} unit="px"/>
                  <label style={{fontSize:11,display:"flex",alignItems:"center",gap:4,color:"var(--text-secondary)",marginBottom:4}}><input type="checkbox" checked={selectedObj.dashed||false} onChange={e=>updateObject(selectedId,{dashed:e.target.checked})}/> Pointillé</label>
                  {selectedObj.type==="arrow"&&<label style={{fontSize:11,display:"flex",alignItems:"center",gap:4,color:"var(--text-secondary)",marginBottom:4}}><input type="checkbox" checked={selectedObj.showDistance||false} onChange={e=>updateObject(selectedId,{showDistance:e.target.checked})}/> Afficher distance</label>}
                </>}
                {(selectedObj.type==="rect"||selectedObj.type==="triangle"||selectedObj.type==="circle"||selectedObj.type==="objective")&&<>
                  <ColorPicker label="Rempliss." color={selectedObj.fillColor||"#3366ff"} onChange={v=>updateObject(selectedId,{fillColor:v})}/>
                  <NumInput label="Opacité" value={selectedObj.fillOpacity??0.3} onChange={v=>updateObject(selectedId,{fillOpacity:Math.max(0,Math.min(1,v))})} step={0.05} min={0} max={1} unit=""/>
                </>}
                {selectedObj.type==="text"&&<>
                  <div style={{marginBottom:4}}><span style={{fontSize:11,color:"var(--text-secondary)"}}>Contenu</span><input type="text" value={selectedObj.content||""} onChange={e=>updateObject(selectedId,{content:e.target.value})} style={{width:"100%",fontSize:12,padding:"4px 6px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text-primary)",marginTop:2}}/></div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <NumInput label="Taille" value={selectedObj.fontSize||14} onChange={v=>updateObject(selectedId,{fontSize:v})} step={1} min={4} max={200} unit="pt"/>
                    <button onClick={()=>updateObject(selectedId,{fontSize:Math.max(4,(selectedObj.fontSize||14)-1)})} style={{width:22,height:22,background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-secondary)",cursor:"pointer",fontSize:14,padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                    <button onClick={()=>updateObject(selectedId,{fontSize:Math.min(200,(selectedObj.fontSize||14)+1)})} style={{width:22,height:22,background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-secondary)",cursor:"pointer",fontSize:14,padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                  </div>
                  <div style={{display:"flex",gap:4,marginTop:4}}>
                    <button onClick={()=>updateObject(selectedId,{textColor:"#000000"})} style={{flex:1,padding:"4px 0",background:"#000",color:"#fff",border:selectedObj.textColor==="#000000"?"2px solid var(--highlight)":"1px solid var(--border)",borderRadius:4,fontSize:11,cursor:"pointer"}}>Noir</button>
                    <button onClick={()=>updateObject(selectedId,{textColor:"#ffffff"})} style={{flex:1,padding:"4px 0",background:"#fff",color:"#000",border:selectedObj.textColor==="#ffffff"?"2px solid var(--highlight)":"1px solid var(--border)",borderRadius:4,fontSize:11,cursor:"pointer"}}>Blanc</button>
                  </div>
                </>}
              </div>
            </div>}
            {panelTab==="props"&&!selectedObj&&<p style={{fontSize:11,color:"var(--text-tertiary)",fontStyle:"italic",textAlign:"center",marginTop:20}}>Sélectionnez un objet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══ HIT TESTING ══
function hitTest(obj,ix,iy){
  const t=1;
  switch(obj.type){
    case "line":case "arrow":return distToSeg(ix,iy,obj.x1,obj.y1,obj.x2,obj.y2)<t;
    case "rect":return ix>=Math.min(obj.x1,obj.x2)&&ix<=Math.max(obj.x1,obj.x2)&&iy>=Math.min(obj.y1,obj.y2)&&iy<=Math.max(obj.y1,obj.y2);
    case "triangle":return ptInTri(ix,iy,obj.x1,obj.y1,obj.x2,obj.y2,obj.x3,obj.y3);
    case "circle":return Math.sqrt((ix-obj.cx)**2+(iy-obj.cy)**2)<=obj.r;
    case "objective":return Math.sqrt((ix-obj.cx)**2+(iy-obj.cy)**2)<=OBJECTIVE_RADIUS_INCH;
    case "text":return Math.abs(ix-obj.x)<3&&Math.abs(iy-obj.y)<1.5;
    default:return false;
  }
}
function distToSeg(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy;if(l===0)return Math.sqrt((px-x1)**2+(py-y1)**2);let t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l));return Math.sqrt((px-(x1+t*dx))**2+(py-(y1+t*dy))**2);}
function ptInTri(px,py,x1,y1,x2,y2,x3,y3){const s=(px,py,x1,y1,x2,y2)=>(px-x2)*(y1-y2)-(x1-x2)*(py-y2);const d1=s(px,py,x1,y1,x2,y2),d2=s(px,py,x2,y2,x3,y3),d3=s(px,py,x3,y3,x1,y1);return!((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));}
