export const KINDS = [
  { value: "finished", label: "Gudang Jadi" },
  { value: "damage", label: "Damage" },
  { value: "material", label: "Bahan Baku" },
  { value: "store", label: "Toko" },
  { value: "warehouse", label: "Umum" },
];

export const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;
