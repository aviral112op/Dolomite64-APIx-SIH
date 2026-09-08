import { runThirtyDayBacktest } from "../server/backtest";

const result = await runThirtyDayBacktest();
console.log(JSON.stringify(result, null, 2));
