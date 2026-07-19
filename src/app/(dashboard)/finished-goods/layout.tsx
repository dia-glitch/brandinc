import { FinishedGoodsTabs } from "./tabs";

export default function FinishedGoodsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FinishedGoodsTabs />
      {children}
    </>
  );
}
