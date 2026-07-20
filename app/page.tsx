"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "style" | "closet" | "calendar";
type Category = "top" | "bottom";
type Season = "spring" | "summer" | "autumn" | "winter";
type Item = { id: string; category: Category; image?: string; seasons: Season[]; createdAt: number };
type Weather = { temp: number; high: number; low: number; rain: number; code: number; label: string };
type SavedLook = { id: string; top: Item; bottom: Item; date: string; weather?: Weather };

const DEMO_ITEMS: Item[] = [
  { id: "top-tee", category: "top", seasons: ["spring", "summer"], createdAt: 4 },
  { id: "top-shirt", category: "top", seasons: ["spring", "summer", "autumn"], createdAt: 3 },
  { id: "top-knit", category: "top", seasons: ["autumn", "winter"], createdAt: 2 },
  { id: "bottom-denim", category: "bottom", seasons: ["spring", "summer", "autumn", "winter"], createdAt: 4 },
  { id: "bottom-skirt", category: "bottom", seasons: ["spring", "summer"], createdAt: 3 },
  { id: "bottom-slacks", category: "bottom", seasons: ["spring", "autumn", "winter"], createdAt: 2 },
];

const seasonNames: Record<Season, string> = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
const todayKey = () => new Date().toLocaleDateString("sv-SE");
const dateLabel = (date = new Date()) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(date);
const currentSeason = (temp?: number): Season => temp == null ? "summer" : temp >= 24 ? "summer" : temp >= 16 ? "spring" : temp >= 8 ? "autumn" : "winter";

function Garment({ item, compact = false }: { item: Item; compact?: boolean }) {
  if (item.image) return <img className="garment-image" src={item.image} alt="등록한 옷" />;
  const kind = item.id.split("-")[1] || item.category;
  return <div className={`garment garment-${kind} ${compact ? "compact" : ""}`} aria-label="샘플 옷"><span /></div>;
}

function LookPreview({ look, compact = false }: { look: { top: Item; bottom: Item }; compact?: boolean }) {
  return <div className={`look-preview ${compact ? "compact" : ""}`}><Garment item={look.top} compact={compact} /><Garment item={look.bottom} compact={compact} /></div>;
}

function AppIcon({ name }: { name: Tab }) {
  return <span className={`nav-icon ${name}`} aria-hidden="true"><i /><b /></span>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("style");
  const [items, setItems] = useState<Item[]>(DEMO_ITEMS);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [weather, setWeather] = useState<Weather | undefined>();
  const [weatherNote, setWeatherNote] = useState("오늘 날씨를 확인하고 있어요");
  const [todayLooks, setTodayLooks] = useState<SavedLook[]>([]);
  const [wishLooks, setWishLooks] = useState<SavedLook[]>([]);
  const [toast, setToast] = useState("");
  const [closetTab, setClosetTab] = useState<"top" | "bottom" | "wish">("top");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [addOpen, setAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<Category>("top");
  const [newSeasons, setNewSeasons] = useState<Season[]>(["spring", "summer", "autumn", "winter"]);
  const [newImage, setNewImage] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("oneulmoipji-data");
      if (raw) {
        const data = JSON.parse(raw);
        setItems(data.items?.length ? data.items : DEMO_ITEMS);
        setTodayLooks(data.todayLooks || []);
        setWishLooks(data.wishLooks || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("oneulmoipji-data", JSON.stringify({ items, todayLooks, wishLooks }));
  }, [items, todayLooks, wishLooks]);

  useEffect(() => {
    const load = async (lat = 37.5665, lon = 126.978) => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`);
        const data = await res.json();
        const code = data.current.weather_code;
        const label = code >= 61 ? "비" : code >= 45 ? "흐림" : code >= 1 ? "구름 조금" : "맑음";
        const value = { temp: Math.round(data.current.temperature_2m), high: Math.round(data.daily.temperature_2m_max[0]), low: Math.round(data.daily.temperature_2m_min[0]), rain: data.daily.precipitation_probability_max[0], code, label };
        setWeather(value);
        setWeatherNote(value.rain >= 50 ? "비가 올 수 있어요. 우산을 챙겨요" : value.temp >= 27 ? "가볍고 시원한 옷이 좋은 날이에요" : value.temp <= 10 ? "따뜻한 옷과 아우터를 챙겨요" : "산뜻하게 입기 좋은 날이에요");
      } catch { setWeatherNote("날씨를 불러오지 못했어요"); }
    };
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => load(p.coords.latitude, p.coords.longitude), () => load(), { timeout: 5000 });
    else load();
  }, []);

  const season = currentSeason(weather?.temp);
  const filteredTops = useMemo(() => items.filter(i => i.category === "top" && i.seasons.includes(season)), [items, season]);
  const filteredBottoms = useMemo(() => items.filter(i => i.category === "bottom" && i.seasons.includes(season)), [items, season]);
  const tops = filteredTops.length ? filteredTops : items.filter(i => i.category === "top");
  const bottoms = filteredBottoms.length ? filteredBottoms : items.filter(i => i.category === "bottom");
  const top = tops[topIndex % Math.max(1, tops.length)];
  const bottom = bottoms[bottomIndex % Math.max(1, bottoms.length)];
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const move = (category: Category, amount: number) => category === "top" ? setTopIndex(i => (i + amount + tops.length) % tops.length) : setBottomIndex(i => (i + amount + bottoms.length) % bottoms.length);

  const saveLook = (type: "today" | "wish") => {
    if (!top || !bottom) return notify("상의와 하의를 먼저 등록해 주세요");
    const look: SavedLook = { id: crypto.randomUUID(), top, bottom, date: todayKey(), weather };
    if (type === "today") {
      setTodayLooks(current => [look, ...current.filter(i => i.date !== look.date)]);
      notify("오늘의 코디로 저장했어요");
    } else {
      setWishLooks(current => [look, ...current]);
      notify("입고 싶은 코디에 담았어요");
    }
  };

  const readImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewImage(String(reader.result));
    reader.readAsDataURL(file);
  };
  const addItem = () => {
    if (!newImage) return notify("옷 사진을 먼저 선택해 주세요");
    setItems(current => [{ id: crypto.randomUUID(), category: newCategory, image: newImage, seasons: newSeasons, createdAt: Date.now() }, ...current]);
    setNewImage(undefined); setAddOpen(false); notify("옷장에 추가했어요");
  };

  const monthCells = useMemo(() => {
    const year = month.getFullYear(), m = month.getMonth();
    const first = new Date(year, m, 1).getDay(), last = new Date(year, m + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);
  const selectedLook = todayLooks.find(l => l.date === selectedDate);

  return <main className="app-shell">
    <div className="brand-row"><div className="brand-mark"><span /></div><div><strong>오늘모입지</strong><small>TODAY&apos;S CLOSET</small></div><button className="profile" aria-label="내 정보">민</button></div>

    {tab === "style" && <section className="screen style-screen">
      <header className="page-heading"><div><span className="eyebrow">TODAY</span><h1>{dateLabel()}</h1></div><span className="season-chip">{seasonNames[season]} 옷만 보기</span></header>
      <article className="weather-card">
        <div className="weather-symbol" aria-hidden="true"><i className={weather?.code && weather.code >= 61 ? "rain" : "sun"} /></div>
        <div className="weather-main"><span>현재 날씨</span><strong>{weather ? `${weather.temp}°` : "--°"}</strong></div>
        <div className="weather-detail"><strong>{weather?.label || "불러오는 중"}</strong><span>최고 {weather?.high ?? "--"}° · 최저 {weather?.low ?? "--"}°</span><span>강수 확률 {weather?.rain ?? "--"}%</span></div>
      </article>
      <p className="weather-note">{weatherNote}</p>

      <div className="chooser-stack">
        <article className="chooser-card">
          <div className="card-label"><span>01</span><div><b>TOP</b><small>상의</small></div></div>
          <button className="arrow left" onClick={() => move("top", -1)} aria-label="이전 상의">‹</button>
          <div className="garment-stage">{top ? <Garment item={top} /> : <p>상의를 등록해 주세요</p>}</div>
          <button className="arrow right" onClick={() => move("top", 1)} aria-label="다음 상의">›</button>
          <div className="pager">{tops.map((_, i) => <i key={i} className={i === topIndex % tops.length ? "active" : ""} />)}</div>
        </article>
        <article className="chooser-card bottom-card">
          <div className="card-label"><span>02</span><div><b>BOTTOM</b><small>하의</small></div></div>
          <button className="arrow left" onClick={() => move("bottom", -1)} aria-label="이전 하의">‹</button>
          <div className="garment-stage">{bottom ? <Garment item={bottom} /> : <p>하의를 등록해 주세요</p>}</div>
          <button className="arrow right" onClick={() => move("bottom", 1)} aria-label="다음 하의">›</button>
          <div className="pager">{bottoms.map((_, i) => <i key={i} className={i === bottomIndex % bottoms.length ? "active" : ""} />)}</div>
        </article>
      </div>
      <div className="save-actions"><button className="primary-action" onClick={() => saveLook("today")}><span className="check">✓</span><span><b>오늘의 코디로 결정</b><small>오늘 날짜에 기록돼요</small></span></button><button className="wish-action" onClick={() => saveLook("wish")} aria-label="입고 싶은 코디로 저장">♡</button></div>
    </section>}

    {tab === "closet" && <section className="screen closet-screen">
      <header className="page-heading"><div><span className="eyebrow">MY CLOSET</span><h1>내 옷장</h1></div><button className="add-button" onClick={() => setAddOpen(true)}>+ 옷 추가</button></header>
      <div className="segmented"><button className={closetTab === "top" ? "active" : ""} onClick={() => setClosetTab("top")}>상의 <b>{items.filter(i=>i.category==="top").length}</b></button><button className={closetTab === "bottom" ? "active" : ""} onClick={() => setClosetTab("bottom")}>하의 <b>{items.filter(i=>i.category==="bottom").length}</b></button><button className={closetTab === "wish" ? "active" : ""} onClick={() => setClosetTab("wish")}>입고 싶은 코디 <b>{wishLooks.length}</b></button></div>
      {closetTab !== "wish" ? <div className="closet-grid">{items.filter(i => i.category === closetTab).map(item => <article className="closet-item" key={item.id}><div><Garment item={item} compact /></div><span>{item.seasons.map(s => seasonNames[s]).join(" · ")}</span><button onClick={() => setItems(v => v.filter(i => i.id !== item.id))} aria-label="옷 삭제">×</button></article>)}</div> : <div className="wishlist">{wishLooks.length ? wishLooks.map(look => <article className="saved-card" key={look.id}><LookPreview look={look} compact /><div><b>{dateLabel(new Date(look.date))} 저장</b><span>나중에 입고 싶은 코디</span><button onClick={() => { setTodayLooks(v => [{ ...look, id: crypto.randomUUID(), date: todayKey(), weather }, ...v.filter(i=>i.date!==todayKey())]); notify("오늘의 코디로 정했어요"); }}>오늘 입기</button></div><button className="remove" onClick={() => setWishLooks(v => v.filter(i=>i.id!==look.id))} aria-label="저장 코디 삭제">×</button></article>) : <div className="empty">아직 저장한 코디가 없어요</div>}</div>}
    </section>}

    {tab === "calendar" && <section className="screen calendar-screen">
      <header className="page-heading"><div><span className="eyebrow">OUTFIT LOG</span><h1>코디 달력</h1></div></header>
      <article className="calendar-card"><div className="month-nav"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}>‹</button><strong>{month.getFullYear()}년 {month.getMonth()+1}월</strong><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}>›</button></div><div className="weekdays">{"일월화수목금토".split("").map(d=><span key={d}>{d}</span>)}</div><div className="days">{monthCells.map((day, i) => { if (!day) return <span key={`e${i}`} />; const key = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const has = todayLooks.some(l=>l.date===key); return <button key={key} className={`${key===todayKey()?"today ":""}${key===selectedDate?"selected":""}`} onClick={()=>setSelectedDate(key)}><b>{day}</b>{has && <i />}</button> })}</div></article>
      <div className="selected-look"><div className="section-title"><div><span className="eyebrow">SELECTED DAY</span><h2>{new Intl.DateTimeFormat("ko-KR", { month:"long", day:"numeric", weekday:"long" }).format(new Date(selectedDate+"T12:00:00"))}</h2></div>{selectedLook?.weather && <span>{selectedLook.weather.temp}° · {selectedLook.weather.label}</span>}</div>{selectedLook ? <article className="day-look"><LookPreview look={selectedLook} /><div><b>이날의 코디</b><span>오늘 선택한 상의와 하의</span><button onClick={() => setTodayLooks(v=>v.filter(l=>l.id!==selectedLook.id))}>기록 삭제</button></div></article> : <div className="empty">이날은 저장된 코디가 없어요</div>}</div>
    </section>}

    <nav className="bottom-nav" aria-label="주 메뉴">{(["style","closet","calendar"] as Tab[]).map(name => <button key={name} className={tab===name?"active":""} onClick={()=>setTab(name)}><AppIcon name={name}/><span>{name==="style"?"코디":name==="closet"?"옷장":"달력"}</span></button>)}</nav>
    {toast && <div className="toast">✓ {toast}</div>}

    {addOpen && <div className="modal-backdrop" onMouseDown={() => setAddOpen(false)}><section className="add-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">ADD ITEM</span><h2>새 옷 등록</h2></div><button onClick={()=>setAddOpen(false)}>×</button></div><button className={`upload-box ${newImage?"has-image":""}`} onClick={()=>fileRef.current?.click()}>{newImage ? <img src={newImage} alt="업로드 미리보기"/> : <><b>+</b><span>누끼 딴 옷 사진 선택</span><small>PNG, JPG 파일</small></>}<input ref={fileRef} type="file" accept="image/*" hidden onChange={readImage}/></button><label>종류</label><div className="option-row"><button className={newCategory==="top"?"active":""} onClick={()=>setNewCategory("top")}>상의</button><button className={newCategory==="bottom"?"active":""} onClick={()=>setNewCategory("bottom")}>하의</button></div><label>입는 계절 <small>여러 개 선택 가능</small></label><div className="season-row">{(Object.keys(seasonNames) as Season[]).map(s=><button key={s} className={newSeasons.includes(s)?"active":""} onClick={()=>setNewSeasons(v=>v.includes(s)?v.filter(x=>x!==s):[...v,s])}>{seasonNames[s]}</button>)}</div><button className="submit-item" onClick={addItem}>옷장에 추가하기</button></section></div>}
  </main>;
}
