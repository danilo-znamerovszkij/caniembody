// Prints coverage numbers (same source as /coverage and meta.json).
import { stats } from '../src/lib/data.ts';
const { ages, ...s } = stats();
console.log(JSON.stringify(s, null, 2));
