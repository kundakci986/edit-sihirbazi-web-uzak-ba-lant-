import { create } from 'zustand'


export type Segment = { id: string; start: number; end: number; transition?: 'none'|'fade' };
export type Filter = { brightness: number; contrast: number; saturate: number; hue: number };


type State = {
fileUrl: string | null;
fileType: string | null;
setMedia: (url: string, type: string) => void;


audioUrl: string | null;
setAudio: (url: string | null) => void;


segments: Segment[];
setSegments: (s: Segment[]) => void;


zoom: number; // 1..5
setZoom: (z: number) => void;


filter: Filter;
setFilter: (f: Partial<Filter>) => void;
}


export const useEditorStore = create<State>((set) => ({
fileUrl: null,
fileType: null,
setMedia: (url, type) => set({ fileUrl: url, fileType: type }),


audioUrl: null,
setAudio: (url) => set({ audioUrl: url }),


segments: [],
setSegments: (segments) => set({ segments }),


zoom: 1,
setZoom: (zoom) => set({ zoom }),


filter: { brightness: 1, contrast: 1, saturate: 1, hue: 0 },
setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
}))