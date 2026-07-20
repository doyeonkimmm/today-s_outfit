"use client";

import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from "react";

type Tab = "style" | "closet" | "calendar";
type Category = "top" | "bottom";
type Season = "spring" | "summer" | "autumn" | "winter";
type Item = { id: string; category: Category; image?: string; seasons: Season[]; createdAt: number; scale?: number; offsetY?: number };
type Weather = { temp: number; high: number; low: number; rain: number; label: string };
type SavedLook = { id: string; top: Item; bottom: Item; date: string; weather?: Weather };

const seasonNames: Record<Season, string> = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
const todayKey = () => new Date().toLocaleDateString("sv-SE");
const fullDate = (value: string) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date(`${value}T12:00:00`));
const assetPath = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

function optimizeImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSide = 1000;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(source);
      if (!context) return reject(new Error("이미지를 처리할 수 없습니다"));

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
      }

      if (right < left || bottom < top) return resolve(canvas.toDataURL("image/webp", .8));
      const padding = Math.max(4, Math.round(Math.max(right - left, bottom - top) * .02));
      left = Math.max(0, left - padding); top = Math.max(0, top - padding);
      right = Math.min(canvas.width - 1, right + padding); bottom = Math.min(canvas.height - 1, bottom + padding);
      const trimmed = document.createElement("canvas");
      trimmed.width = right - left + 1; trimmed.height = bottom - top + 1;
      trimmed.getContext("2d")?.drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
      resolve(trimmed.toDataURL("image/webp", .8));
    };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("이미지를 불러올 수 없습니다")); };
    image.src = source;
  });
}

function Garment({ item, type, adjusted = true, offsetRatio = 1 }: { item?: Item; type: Category; adjusted?: boolean; offsetRatio?: number }) {
  if (item?.image) return <div className={`garment-frame ${type}`}><img className={`garment-image ${type}`} style={adjusted ? { transform:`translateY(${(item.offsetY ?? 0) * offsetRatio}px) scale(${item.scale ?? 1})` } as CSSProperties : undefined} src={item.image} alt={type === "top" ? "상의" : "하의"} /></div>;
  return <div className={`garment-frame ${type}`}><img className={`empty-garment ${type}`} src={assetPath(type === "top" ? "shirt.svg" : "pants.svg")} alt="등록된 옷 없음" /></div>;
}

function OutfitPreview({ look, offsetRatio = 1, topOffsetRatio }: { look: { top: Item; bottom: Item }; offsetRatio?: number; topOffsetRatio?: number }) {
  return <div className="outfit-preview"><Garment item={look.top} type="top" offsetRatio={topOffsetRatio ?? offsetRatio} /><Garment item={look.bottom} type="bottom" offsetRatio={offsetRatio} /></div>;
}

function Checker({ className = "" }: { className?: string }) {
  return <div className={`checker ${className}`} aria-hidden="true" />;
}

export default function Home() {
  const [name, setName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [intro, setIntro] = useState<"name" | "enter" | "done">("name");
  const [tab, setTab] = useState<Tab>("style");
  const [items, setItems] = useState<Item[]>([]);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [weather, setWeather] = useState<Weather>();
  const [todayLooks, setTodayLooks] = useState<SavedLook[]>([]);
  const [wishLooks, setWishLooks] = useState<SavedLook[]>([]);
  const [toast, setToast] = useState("");
  const [closetTab, setClosetTab] = useState<"top" | "bottom" | "wish">("top");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [weekMode, setWeekMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<Category>("top");
  const [newSeasons, setNewSeasons] = useState<Season[]>(["spring", "summer", "autumn", "winter"]);
  const [newImage, setNewImage] = useState<string>();
  const [newScale, setNewScale] = useState(1);
  const [newOffsetY, setNewOffsetY] = useState(0);
  const [editingId, setEditingId] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const storedName = localStorage.getItem("oneulmoipji-name-v5") || "";
      const saved = localStorage.getItem("oneulmoipji-data");
      if (storedName) { setName(storedName); setDraftName(storedName); setIntro("done"); }
      if (saved) {
        const data = JSON.parse(saved);
        const loadedItems = (data.items || []).filter((item: Item) => Boolean(item.image));
        const itemMap = new Map<string, Item>(loadedItems.map((item: Item) => [item.id, item]));
        const hydrate = (look: SavedLook): SavedLook => ({ ...look, top: itemMap.get(look.top.id) || look.top, bottom: itemMap.get(look.bottom.id) || look.bottom });
        setItems(loadedItems);
        setTodayLooks((data.todayLooks || []).map(hydrate));
        setWishLooks((data.wishLooks || []).map(hydrate));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const withoutImage = (item: Item): Item => ({ ...item, image: undefined });
    const compactLook = (look: SavedLook): SavedLook => ({ ...look, top: withoutImage(look.top), bottom: withoutImage(look.bottom) });
    try {
      localStorage.setItem("oneulmoipji-data", JSON.stringify({ items, todayLooks: todayLooks.map(compactLook), wishLooks: wishLooks.map(compactLook) }));
    } catch {
      setToast("저장 공간이 부족합니다. 큰 사진을 삭제해주세요");
    }
  }, [items, todayLooks, wishLooks]);

  useEffect(() => {
    if (!items.some(item => item.image && !item.image.startsWith("data:image/webp"))) return;
    let cancelled = false;
    Promise.all(items.map(async item => {
      if (!item.image || item.image.startsWith("data:image/webp")) return item;
      try {
        const blob = await (await fetch(item.image)).blob();
        return { ...item, image: await optimizeImage(blob) };
      } catch { return item; }
    })).then(normalized => {
      if (cancelled) return;
      const itemMap = new Map(normalized.map(item => [item.id, item]));
      setItems(normalized);
      setTodayLooks(looks => looks.map(look => ({ ...look, top: itemMap.get(look.top.id) || look.top, bottom: itemMap.get(look.bottom.id) || look.bottom })));
      setWishLooks(looks => looks.map(look => ({ ...look, top: itemMap.get(look.top.id) || look.top, bottom: itemMap.get(look.bottom.id) || look.bottom })));
    });
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    const load = async (lat = 37.5665, lon = 126.978) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`);
        const data = await response.json();
        const code = data.current.weather_code;
        setWeather({
          temp: Math.round(data.current.temperature_2m), high: Math.round(data.daily.temperature_2m_max[0]), low: Math.round(data.daily.temperature_2m_min[0]), rain: data.daily.precipitation_probability_max[0],
          label: code >= 61 ? "비" : code >= 45 ? "흐림" : code >= 1 ? "구름" : "맑음",
        });
      } catch {}
    };
    navigator.geolocation?.getCurrentPosition(p => load(p.coords.latitude, p.coords.longitude), () => load(), { timeout: 4000 });
  }, []);

  const tops = items.filter(item => item.category === "top");
  const bottoms = items.filter(item => item.category === "bottom");
  const top = tops[topIndex % Math.max(tops.length, 1)];
  const bottom = bottoms[bottomIndex % Math.max(bottoms.length, 1)];
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 1800); };
  const move = (category: Category, amount: number) => {
    const list = category === "top" ? tops : bottoms;
    if (!list.length) return;
    if (category === "top") setTopIndex(value => (value + amount + list.length) % list.length);
    else setBottomIndex(value => (value + amount + list.length) % list.length);
  };
  const save = (kind: "today" | "wish") => {
    if (!top || !bottom) return notify("옷을 추가해주세요");
    const look: SavedLook = { id: crypto.randomUUID(), top, bottom, date: todayKey(), weather };
    if (kind === "today") setTodayLooks(value => [look, ...value.filter(item => item.date !== look.date)]);
    else setWishLooks(value => [look, ...value]);
    notify("저장했습니다");
  };
  const submitName = () => {
    const value = draftName.trim().slice(0, 10);
    if (!value) return;
    setName(value); localStorage.setItem("oneulmoipji-name-v5", value); setIntro("enter");
  };
  const readImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { setNewImage(await optimizeImage(file)); }
    catch { notify("이미지를 불러오지 못했습니다"); }
  };
  const addItem = () => {
    if (!newImage) return notify("사진을 선택해주세요");
    if (editingId) {
      const changes = { category:newCategory, image:newImage, seasons:newSeasons, scale:newScale, offsetY:newOffsetY };
      setItems(value => value.map(item => item.id === editingId ? { ...item, ...changes } : item));
      const updateLooks = (looks: SavedLook[]) => looks.map(look => ({ ...look, top:look.top.id === editingId ? { ...look.top, ...changes, category:"top" } : look.top, bottom:look.bottom.id === editingId ? { ...look.bottom, ...changes, category:"bottom" } : look.bottom }));
      setTodayLooks(updateLooks); setWishLooks(updateLooks);
    } else setItems(value => [{ id: crypto.randomUUID(), category: newCategory, image: newImage, seasons: newSeasons, createdAt: Date.now(), scale: newScale, offsetY: newOffsetY }, ...value]);
    setNewImage(undefined); setNewScale(1); setNewOffsetY(0); setEditingId(undefined); setAddOpen(false); notify(editingId ? "수정했습니다" : "추가했습니다");
  };
  const openNewItem = () => { setEditingId(undefined); setNewImage(undefined); setNewScale(1); setNewOffsetY(0); setNewCategory("top"); setNewSeasons(["spring", "summer", "autumn", "winter"]); setAddOpen(true); };
  const editItem = (item: Item) => { setEditingId(item.id); setNewImage(item.image); setNewScale(item.scale ?? 1); setNewOffsetY(item.offsetY ?? 0); setNewCategory(item.category); setNewSeasons(item.seasons); setAddOpen(true); };

  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  }, [month]);
  const selectedWeek = useMemo(() => {
    const selected = new Date(`${selectedDate}T12:00:00`);
    const sunday = new Date(selected);
    sunday.setDate(selected.getDate() - selected.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + index);
      return date;
    });
  }, [selectedDate]);
  const selectedLooks = todayLooks.filter(item => item.date === selectedDate);

  if (intro !== "done") return <main className="intro-shell">
    <Checker className="intro-checker top" />
    <section className="intro-content">
      {intro === "name" ? <form onSubmit={event => { event.preventDefault(); submitName(); }}>
        <p>안녕하세요<br />이름이 무엇인가요?</p>
        <label className="name-ticket"><input value={draftName} onChange={event => setDraftName(event.target.value)} maxLength={10} aria-label="이름" placeholder="이름을 적어주세요" autoFocus /></label>
        <button className="name-submit" type="submit">확인</button>
      </form> : <button className="enter-button" onClick={() => setIntro("done")}><span>{name}의 옷장<br />들어가기</span><b>→</b></button>}
    </section>
    <Checker className="intro-checker bottom" />
  </main>;

  return <main className="app-shell">
    <Checker className="top-checker" />

    {tab === "style" && <section className="style-screen">
      <div className="weather-bar">{weather ? `${weather.temp}° ${weather.label} · 최고 ${weather.high}° 최저 ${weather.low}° · 비 ${weather.rain}%` : "날씨 불러오는 중"}</div>
      <div className="photo-strip">
        <div className="garment-slot">
          <button onClick={() => move("top", -1)} aria-label="이전 상의">◀</button><Garment item={top} type="top" /><button onClick={() => move("top", 1)} aria-label="다음 상의">▶</button>
        </div>
        {!top && !bottom && <p className="empty-message">저장 되어있는 옷이 없어용<br />옷을 추가해보세용</p>}
        <div className="garment-slot">
          <button onClick={() => move("bottom", -1)} aria-label="이전 하의">◀</button><Garment item={bottom} type="bottom" /><button onClick={() => move("bottom", 1)} aria-label="다음 하의">▶</button>
        </div>
      </div>
      <div className="outfit-actions"><button onClick={() => save("today")}>오늘의 코디</button><button onClick={() => save("wish")}>입고 싶은 코디</button></div>
    </section>}

    {tab === "closet" && <section className="cream-screen closet-screen">
      <div className="closet-heading"><h1>{name}의 옷장</h1><button onClick={openNewItem}>옷 추가</button></div>
      <div className="closet-tabs"><button onClick={() => setClosetTab("top")}>상의</button><button onClick={() => setClosetTab("bottom")}>하의</button><button onClick={() => setClosetTab("wish")}>저장</button></div>
      <div className="closet-scroll">
        {closetTab !== "wish" ? <div className="closet-grid">{items.filter(item => item.category === closetTab).map(item => <article className="closet-card" key={item.id}><div><Garment item={item} type={item.category} adjusted={false} /></div><div className="closet-card-actions"><button onClick={() => editItem(item)}>수정</button><button onClick={() => setItems(value => value.filter(row => row.id !== item.id))}>삭제</button></div></article>)}</div>
        : <div className="saved-grid">{wishLooks.map(look => <SavedCard key={look.id} look={look} onWear={() => { setTodayLooks(value => [{ ...look, id: crypto.randomUUID(), date: todayKey(), weather }, ...value.filter(item => item.date !== todayKey())]); notify("오늘의 코디로 저장했습니다"); }} onDelete={() => setWishLooks(value => value.filter(item => item.id !== look.id))} compact />)}{!wishLooks.length && <p className="boxed-empty">저장된 코디가 없습니다</p>}</div>}
      </div>
    </section>}

    {tab === "calendar" && <section className={`cream-screen calendar-screen ${weekMode ? "week-mode" : ""}`}>
      <div className="calendar-fixed">
        <div className="month-row"><button onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setWeekMode(false); }}>〈</button><button className="month-title" onClick={() => setWeekMode(false)}>{month.getFullYear()}년 {month.getMonth() + 1}월</button><button onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setWeekMode(false); }}>〉</button></div>
        <div className="weekdays">{"일월화수목금토".split("").map(day => <span key={day}>{day}</span>)}</div>
        <div className="days">{weekMode ? selectedWeek.map(date => {
          const key = date.toLocaleDateString("sv-SE");
          return <button key={key} className={`${selectedDate === key ? "selected" : ""} ${date.getMonth() !== month.getMonth() ? "outside" : ""}`} onClick={() => { setSelectedDate(key); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}>{date.getDate()}{todayLooks.some(item => item.date === key) && <i />}</button>;
        }) : monthCells.map((day, i) => {
          if (!day) return <span key={`empty-${i}`} />;
          const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return <button key={key} className={selectedDate === key ? "selected" : ""} onClick={() => { setSelectedDate(key); setWeekMode(true); }}>{day}{todayLooks.some(item => item.date === key) && <i />}</button>;
        })}</div>
        {weekMode && <h2>{fullDate(selectedDate)}</h2>}
      </div>
      {!weekMode && <div className="calendar-hint" aria-label="날짜 선택 안내">
        <span className="hint-arrow">↑</span>
        <p>날짜를 눌러<br />그날의 코디를 확인해보세요</p>
      </div>}
      {weekMode && <div className="calendar-outfit-viewport">
        {selectedLooks.length ? <SavedCard look={selectedLooks[0]} onWear={() => {}} onDelete={() => setTodayLooks(value => value.filter(item => item.id !== selectedLooks[0].id))} calendar /> : <article className="saved-card empty-saved-card"><p>저장된 코디가 없습니다</p><div aria-hidden="true" /></article>}
      </div>}
    </section>}

    <Checker className="bottom-checker" />
    <nav className="bottom-nav"><button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>코디</button><button className={tab === "closet" ? "active" : ""} onClick={() => setTab("closet")}>옷장</button><button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>달력</button></nav>
    {toast && <div className="toast">{toast}</div>}

    {addOpen && <div className="add-overlay"><section className="add-screen">
      <div className="add-heading"><h2>{editingId ? "옷 수정" : "옷 추가"}</h2><button onClick={() => { setAddOpen(false); setEditingId(undefined); }}>닫기</button></div>
      <button className="upload-frame" onClick={() => fileRef.current?.click()}>{newImage ? <img src={newImage} alt="미리보기" style={{ transform:`translateY(${newOffsetY / 10}px) scale(${newScale})` }} /> : <><img src={assetPath("shirt.svg")} alt="" /><span>사진 선택</span></>}</button>
      <input ref={fileRef} type="file" hidden accept="image/*" onChange={readImage} />
      {newImage && <div className="image-adjustments">
        <label><span>크기</span><input type="range" min="30" max="140" value={Math.round(newScale * 100)} onChange={event => setNewScale(Number(event.target.value) / 100)} /></label>
        <label><span>위치</span><input type="range" min="-180" max="100" value={newOffsetY} onChange={event => setNewOffsetY(Number(event.target.value))} /></label>
      </div>}
      <div className="type-row"><button className={newCategory === "top" ? "active" : ""} onClick={() => setNewCategory("top")}>상의</button><button className={newCategory === "bottom" ? "active" : ""} onClick={() => setNewCategory("bottom")}>하의</button></div>
      <div className="season-row">{(Object.keys(seasonNames) as Season[]).map(season => <button key={season} className={newSeasons.includes(season) ? "active" : ""} onClick={() => setNewSeasons(value => value.includes(season) ? value.filter(item => item !== season) : [...value, season])}>{seasonNames[season]}</button>)}</div>
      <button className="add-submit" onClick={addItem}>{editingId ? "수정 완료" : "추가"}</button>
    </section></div>}
  </main>;
}

function SavedCard({ look, onWear, onDelete, calendar = false, compact = false }: { look: SavedLook; onWear: () => void; onDelete: () => void; calendar?: boolean; compact?: boolean }) {
  const ratio = calendar ? .7 : compact ? .45 : 1;
  return <article className="saved-card"><OutfitPreview look={look} offsetRatio={ratio} topOffsetRatio={calendar ? .58 : ratio} /><div>{!calendar && <button onClick={onWear}>오늘 입기</button>}<button onClick={onDelete}>삭제</button></div></article>;
}
