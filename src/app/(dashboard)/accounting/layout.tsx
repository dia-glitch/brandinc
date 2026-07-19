import { AccountingTabs } from "./tabs";

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccountingTabs />
      {children}
    </>
  );
}
