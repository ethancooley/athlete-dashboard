// A provider returns { source, today, generatedAt, acts[], daily[], pmc, prediction } for the dashboard and
// { id, points[], laps[], session, zones } for one activity. Add a provider by implementing getDashboard and getActivity.
import * as athletedata from "./athletedata";
import * as mock from "./mock";

const pick = () => (process.env.MOCK === "1" || process.env.PROVIDER === "mock" ? mock : athletedata);
export const getDashboard = (setup) => pick().getDashboard(setup);
export const getActivity = (id) => pick().getActivity(id);
