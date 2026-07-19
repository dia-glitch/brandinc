import { MasterDataTabs } from "./tabs";

export default function MasterDataLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MasterDataTabs />
      {children}
    </>
  );
}
