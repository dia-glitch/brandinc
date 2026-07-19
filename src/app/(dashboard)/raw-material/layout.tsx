import { RawMaterialTabs } from "./tabs";

export default function RawMaterialLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RawMaterialTabs />
      {children}
    </>
  );
}
