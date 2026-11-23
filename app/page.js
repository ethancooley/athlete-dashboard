import Dashboard from "../components/Dashboard";
import { getSetup } from "../lib/config";
import { evenSplits } from "../lib/plan";

export const dynamic = "force-dynamic"; // the plan and config are read at request time, never baked into the build
export default function Page() {
  const { cfg, plan } = getSetup();
  const withSplits = { ...plan, splits: plan.splits && plan.splits.length ? plan.splits : evenSplits(cfg.event) };
  return <Dashboard plan={withSplits} cfg={cfg} />;
}
