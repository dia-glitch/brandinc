import { SalesTabs } from "./tabs";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SalesTabs />
      {children}
    </>
  );
}
