import Dashboard from "../components/Dashboard";
import { loadSetup } from "../lib/active";
import { evenSplits } from "../lib/plan";

export const dynamic = "force-dynamic"; // the active plan is read from the database at request time, never baked into the build
export default async function Page() {
  const { cfg, plan, sample, block, error } = await loadSetup();
  const withSplits = { ...plan, splits: plan.splits && plan.splits.length ? plan.splits : evenSplits(cfg.event) };
  return <Dashboard plan={withSplits} cfg={cfg} planInfo={{ sample, block, error }} />;
}
