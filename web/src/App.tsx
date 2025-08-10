import React, { useRef, useState } from 'react';

const COMMON_INGREDIENTS = [
  'tomato', 'onion', 'garlic', 'potato', 'egg', 'milk', 'cheese', 'butter',
  'yogurt', 'spinach', 'carrot', 'bell_pepper', 'chicken', 'beef', 'pork',
  'tuna', 'salmon', 'rice', 'pasta', 'bread', 'mushroom', 'zucchini',
  'broccoli', 'cauliflower', 'lemon', 'lime', 'avocado', 'cucumber',
  'olive', 'ham', 'bacon'
];

function Badge({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={'px-3 py-1 rounded-full text-sm border transition shadow-sm mr-2 mb-2 ' + (active ? 'bg-black text-white border-black' : 'bg-white border-gray-300 hover:bg-gray-100')}
    >
      {children}
    </button>
  );
}

function RecipeCard({ meal, onOpen }: any) {
  return (
    <div className="rounded-2xl overflow-hidden shadow hover:shadow-lg transition bg-white">
      <img src={meal.strMealThumb} alt={meal.strMeal} className="w-full h-40 object-cover" />
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{meal.strMeal}</h3>
        <div className="text-sm text-gray-600 mb-2 flex flex-wrap gap-2">
          {meal.strArea && <span className="px-2 py-0.5 bg-gray-100 rounded-full">{meal.strArea}</span>}
          {meal.strCategory && <span className="px-2 py-0.5 bg-gray-100 rounded-full">{meal.strCategory}</span>}
        </div>
        <button onClick={() => onOpen(meal)} className="w-full mt-2 py-2 rounded-xl bg-black text-white hover:opacity-90">Apri ricetta</button>
      </div>
    </div>
  );
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [detected, setDetected] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingDetect, setLoadingDetect] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [meals, setMeals] = useState<any[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<any | null>(null);
  const [error, setError] = useState('');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (videoRef.current) {
        (videoRef.current as any).srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (e) {
      setError("Impossibile accedere alla fotocamera. Concedi i permessi o usa l'upload.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && (videoRef.current as any).srcObject) {
      const tracks = ((videoRef.current as any).srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      (videoRef.current as any).srcObject = null;
    }
    setStreaming(false);
  };

  const takePhoto = () => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    if (!video || !canvas) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, w, h);
    const url = canvas.toDataURL('image/jpeg', 0.9);
    setPhotoDataUrl(url);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const toggleSelect = (ing: string) => {
    setSelected((prev) => (prev.includes(ing) ? prev.filter((x) => x !== ing) : [...prev, ing]));
  };

  const detectWithServer = async () => {
    try {
      setLoadingDetect(true);
      setError('');
      if (!photoDataUrl) throw new Error('Nessuna immagine');
      const form = new FormData();
      const blob = await (await fetch(photoDataUrl)).blob();
      form.append('image', blob, 'fridge.jpg');
      const resp = await fetch('/api/detect', { method: 'POST', body: form });
      if (!resp.ok) throw new Error('Detect API non disponibile');
      const data = await resp.json();
      const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
      setDetected(ingredients);
      setSelected((prev) => Array.from(new Set([...prev, ...ingredients])));
    } catch (e) {
      setError('Rilevazione non disponibile. Configura il backend /api/detect.');
    } finally {
      setLoadingDetect(false);
    }
  };

  const fetchRecipes = async () => {
    try {
      setLoadingRecipes(true);
      setError('');
      setMeals([]);
      const ings = selected.map((s) => s.replace(/\s+/g, '_').toLowerCase());
      if (ings.length === 0) {
        setError('Seleziona almeno un ingrediente.');
        return;
      }
      const lists = await Promise.all(
        ings.map(async (ing) => {
          const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ing)}`;
          const r = await fetch(url);
          if (!r.ok) return [] as any[];
          const j = await r.json();
          return Array.isArray(j.meals) ? j.meals : [];
        })
      );
      const idSets = lists.map((arr) => new Set(arr.map((m: any) => m.idMeal)));
      let commonIds = idSets[0] || new Set<string>();
      for (let i = 1; i < idSets.length; i++) {
        commonIds = new Set([...commonIds].filter((x) => idSets[i].has(x)));
      }
      let candidates = (lists[0] || []).filter((m: any) => commonIds.has(m.idMeal));
      if (candidates.length === 0) {
        const all = lists.flat();
        const byId: Record<string, any> = {};
        for (const m of all) byId[m.idMeal] = byId[m.idMeal] || { ...m, score: 0 };
        for (let i = 0; i < lists.length; i++) for (const m of lists[i]) if (m && m.idMeal) byId[m.idMeal].score += 1;
        candidates = Object.values(byId).sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 30);
      }
      const detailed = await Promise.all(
        candidates.slice(0, 20).map(async (m: any) => {
          const r = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`);
          const j = await r.json();
          return j.meals?.[0] || m;
        })
      );
      setMeals(detailed);
    } catch (e) {
      setError('Impossibile caricare ricette. Riprova.');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const mealIngredients = (meal: any) => {
    const items: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const meas = meal[`strMeasure${i}`];
      if (ing && String(ing).trim()) items.push(`${ing}${meas ? ` — ${meas}` : ''}`);
    }
    return items;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">FridgeChef</h1>
          <div className="text-xs text-gray-500">Dev server Vite · proxy /api · Tailwind</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <section className="grid md:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-2xl p-4 shadow">
            <h2 className="font-semibold text-lg mb-2">1) Scatta o carica una foto del frigo</h2>
            <div className="relative rounded-xl overflow-hidden bg-black">
              <video ref={videoRef} className="w-full aspect-video object-cover" playsInline muted />
              {!streaming && (<div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">Fotocamera spenta</div>)}
            </div>
            <div className="flex gap-2 mt-3">
              {!streaming ? (
                <button onClick={startCamera} className="px-4 py-2 rounded-xl bg-black text-white">Apri fotocamera</button>
              ) : (
                <>
                  <button onClick={takePhoto} className="px-4 py-2 rounded-xl bg-black text-white">Scatta foto</button>
                  <button onClick={stopCamera} className="px-4 py-2 rounded-xl bg-gray-200">Chiudi</button>
                </>
              )}
              <label className="px-4 py-2 rounded-xl bg-white border cursor-pointer">Upload immagine
                <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
              </label>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {photoDataUrl && (<div className="mt-3"><img src={photoDataUrl} alt="Snapshot" className="rounded-xl w-full object-contain border" /></div>)}
          </div>

          <div className="bg-white rounded-2xl p-4 shadow">
            <h2 className="font-semibold text-lg mb-2">2) Ingredienti rilevati o selezionati</h2>
            <p className="text-sm text-gray-600 mb-2">Puoi selezionare a mano oppure usare un detector server premendo il pulsante qui sotto.</p>
            <div className="flex flex-wrap mb-3">
              {COMMON_INGREDIENTS.map((ing) => (
                <Badge key={ing} active={selected.includes(ing)} onClick={() => setSelected((prev) => (prev.includes(ing) ? prev.filter((x) => x !== ing) : [...prev, ing]))}>
                  {ing.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={detectWithServer} disabled={!photoDataUrl || loadingDetect} className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50">{loadingDetect ? 'Rilevo…' : 'Rileva con AI (server)'}</button>
              {detected.length > 0 && (<div className="text-xs text-gray-600 self-center">Suggeriti: {detected.join(', ')}</div>)}
              <button onClick={() => { setSelected([]); setDetected([]); }} className="px-4 py-2 rounded-xl bg-gray-100">Pulisci</button>
            </div>
          </div>
        </section>

        <section className="mt-6 bg-white rounded-2xl p-4 shadow">
          <h2 className="font-semibold text-lg mb-2">3) Ricette suggerite</h2>
          <p className="text-sm text-gray-600 mb-3">Seleziona almeno un ingrediente e premi "Cerca ricette". Usiamo TheMealDB e combiniamo più ingredienti con intersezione client‑side.</p>
          <div className="flex gap-2 mb-4">
            <button onClick={fetchRecipes} disabled={loadingRecipes || selected.length === 0} className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50">{loadingRecipes ? 'Cerco…' : 'Cerca ricette'}</button>
          </div>

          {error && (<div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{error}</div>)}

          {meals.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {meals.map((m) => (<RecipeCard key={m.idMeal} meal={m} onOpen={setSelectedMeal} />))}
            </div>
          ) : (!loadingRecipes && (<div className="text-sm text-gray-600">Nessuna ricetta ancora. Seleziona ingredienti e avvia la ricerca.</div>))}
        </section>

        {selectedMeal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center" onClick={() => setSelectedMeal(null)}>
            <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <img src={selectedMeal.strMealThumb} alt={selectedMeal.strMeal} className="w-full h-56 object-cover rounded-t-2xl" />
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-1">{selectedMeal.strMeal}</h3>
                <div className="text-sm text-gray-600 mb-3 flex flex-wrap gap-2">
                  {selectedMeal.strArea && <span className="px-2 py-0.5 bg-gray-100 rounded-full">{selectedMeal.strArea}</span>}
                  {selectedMeal.strCategory && <span className="px-2 py-0.5 bg-gray-100 rounded-full">{selectedMeal.strCategory}</span>}
                </div>
                <h4 className="font-semibold mb-1">Ingredienti</h4>
                <ul className="list-disc ml-6 mb-3 text-sm">
                  {mealIngredients(selectedMeal).map((x: string, i: number) => (<li key={i}>{x}</li>))}
                </ul>
                {selectedMeal.strSource && (<a href={selectedMeal.strSource} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">Fonte</a>)}
                <h4 className="font-semibold mt-3 mb-1">Istruzioni</h4>
                <p className="whitespace-pre-line text-sm leading-6">{selectedMeal.strInstructions || 'Visita la fonte per le istruzioni complete.'}</p>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setSelectedMeal(null)} className="px-4 py-2 rounded-xl bg-black text-white">Chiudi</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-gray-500">
        <p>Dev server Vite con proxy /api → http://localhost:3001. Per il riconoscimento reale collega il backend a /api/detect.</p>
      </footer>
    </div>
  );
}