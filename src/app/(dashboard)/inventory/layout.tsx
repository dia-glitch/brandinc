import { InventoryTabs } from "./tabs";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InventoryTabs />
      {children}
    </>
  );
}
