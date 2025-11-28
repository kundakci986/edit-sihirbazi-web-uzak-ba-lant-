// store/editorStore.ts

// Filtre değerlerinin tipi
export type FilterState = {
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
};

// Editörün global durum tipi
export type EditorState = {
  fileUrl: string | null;
  fileType: string | null;
  audioUrl: string | null; // RightPanel burada audioUrl bekliyor
  filter: FilterState;
  // RightPanel setFilter(s => s.setFilter) kullanıyor,
  // şimdilik dummy (boş) bir fonksiyon veriyoruz
  setFilter: (updater: (prev: FilterState) => FilterState) => void;
};

// Varsayılan, boş state
const initialState: EditorState = {
  fileUrl: null,
  fileType: null,
  audioUrl: null,
  filter: {
    brightness: 1,
    contrast: 1,
    saturate: 1,
    hue: 0,
  },
  setFilter: () => {
    // Şimdilik hiçbir şey yapmıyor.
    // İleride gerçek global store (Zustand vs.) kurunca burayı değiştireceğiz.
  },
};

// Very basit "selector" tabanlı hook taklidi.
// Preview, RightPanel vs. içinde useEditorStore(s => s.xxx) çağırdığında
// yukarıdaki initialState üzerinden değer döndürüyor.
export function useEditorStore<T>(selector: (s: EditorState) => T): T {
  return selector(initialState);
}
