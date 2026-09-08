import { getEnabledRoutes, saveBacktest } from "./db";

const DGCA_PORTAL = "https://www.dgca.gov.in/digigov-portal/?page=monthlyStatistics/259/4751/html&main259/4184/servicename";
const DGCA_PUBLIC_REPORT = "https://infra.economictimes.indiatimes.com/news/aviation/average-airfare-on-72-domestic-routes-rose-20-5-in-june-compared-to-may-2025-dgca-data/132664921";

function variation(seed: string) {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) total = (total * 33 + seed.charCodeAt(index)) % 1009;
  return (total % 21) - 10;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function correlation(a: number[], b: number[]) {
  const meanA = average(a);
  const meanB = average(b);
  const numerator = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const denominator = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0) * b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  return denominator ? numerator / denominator : 0;
}

export async function runThirtyDayBacktest() {
  const routes = await getEnabledRoutes();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 29);
  const apiValues: number[] = [];
  const referenceValues: number[] = [];
  for (let day = 0; day < 30; day += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + day);
    const routeValues = routes.map((route) => 100 + variation(`${route.routeCode}-${date.toISOString().slice(0, 10)}`) * 0.25 + day * 0.08);
    apiValues.push(average(routeValues));
    // The published public DGCA statement provides an aggregate 20.5% comparison,
    // not a daily route panel. This interpolated reference is therefore demo-only.
    referenceValues.push(100 + (20.5 * day) / 29);
  }
  const percentageErrors = apiValues.map((value, index) => Math.abs((value - referenceValues[index]) / referenceValues[index]) * 100);
  const squaredErrors = apiValues.map((value, index) => (value - referenceValues[index]) ** 2);
  const result = await saveBacktest({
    runKey: `backtest-30d-demo-${start.toISOString().slice(0, 10)}`,
    referenceSource: `${DGCA_PORTAL} | aggregate context: ${DGCA_PUBLIC_REPORT}`,
    referenceStatus: "demo",
    startDate: start,
    endDate: new Date(),
    dayCount: 30,
    routeCount: routes.length,
    meanAbsolutePercentageError: average(percentageErrors).toFixed(4),
    rootMeanSquareError: Math.sqrt(average(squaredErrors)).toFixed(4),
    correlation: correlation(apiValues, referenceValues).toFixed(6),
    reportUri: "backtest://apiX/30-day-demo-reference",
  });
  return result;
}
