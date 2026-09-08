import { runApixCollection } from "../server/apix";

const result = await runApixCollection("manual", `bootstrap-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`);
console.log(JSON.stringify(result, null, 2));
