export interface FramePreset {
  id: string;
  label: string;
  wrapperClass: string;
  imageClass: string;
  modalWrapperClass: string;
}

export const FRAMES: FramePreset[] = [
  {
    id: 'none',
    label: 'None',
    wrapperClass: '',
    imageClass: 'w-full h-auto block',
    modalWrapperClass: '',
  },
  {
    id: 'white',
    label: 'Gallery',
    wrapperClass: 'bg-white p-4',
    imageClass: 'w-full h-auto block',
    modalWrapperClass: 'bg-white p-6',
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    wrapperClass: 'bg-white pt-4 px-4 pb-10',
    imageClass: 'w-full h-auto block',
    modalWrapperClass: 'bg-white pt-6 px-6 pb-16',
  },
  {
    id: 'dark',
    label: 'Dark Mat',
    wrapperClass: 'bg-zinc-950 p-4',
    imageClass: 'w-full h-auto block',
    modalWrapperClass: 'bg-zinc-950 p-6',
  },
  {
    id: 'film',
    label: 'Film',
    wrapperClass: 'bg-zinc-950 p-2 border-y-[6px] border-zinc-800',
    imageClass: 'w-full h-auto block',
    modalWrapperClass: 'bg-zinc-950 p-3 border-y-8 border-zinc-800',
  },
];

export const DEFAULT_FRAME = FRAMES[0];

export function getFrame(id?: string | null): FramePreset {
  return FRAMES.find(f => f.id === id) ?? DEFAULT_FRAME;
}
