import { ProductionTabs } from "./tabs";

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProductionTabs />
      {children}
    </>
  );
}
