import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Asset { ticker:string; name:string; allocation:number; expectedReturn:number; risk:number; }
interface Portfolio { name:string; totalValue:number; expectedReturn:number; riskLevel:string; assets:Asset[]; metrics:{ sharpeRatio:number; volatility:number; maxDrawdown:number; }; }
interface State { list: Portfolio[]; selected: Portfolio | null; }
const initialState: State = { list: [], selected: null };

const slice = createSlice({
  name: "portfolio",
  initialState,
  reducers: {
    setList(s, a:PayloadAction<Portfolio[]>) { s.list = a.payload; },
    setSelected(s, a:PayloadAction<Portfolio|null>) { s.selected = a.payload; }
  }
});
export const { setList, setSelected } = slice.actions;
export default slice.reducer;
