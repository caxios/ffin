import { Navbar } from "@/components/navbar";
import { CompanyDashboard } from "@/components/company-dashboard";

export default async function TickerDashboardPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upper = decodeURIComponent(ticker).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <CompanyDashboard ticker={upper} />
      </main>
    </div>
  );
}
