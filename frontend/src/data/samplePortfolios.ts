export type Asset = { ticker: string; name: string; allocation: number; expectedReturn: number; risk: number };
export type Portfolio = {
  id: string;
  name: string;
  totalValue: number;
  expectedReturn: number;
  riskLevel: string;
  sparkline: number[];
  assets: Asset[];
  metrics: { sharpeRatio: number; volatility: number; maxDrawdown: number };
};

export const samplePortfolios: Portfolio[] = [
  {
    id: 'p1',
    name: 'Growth 60/40',
    totalValue: 190000,
    expectedReturn: 0.118,
    riskLevel: 'Moderate',
    sparkline: [100,102,101,104,103,106,107,110,108,112,116,120],
    assets: [
      { ticker: 'AAPL', name: 'Apple', allocation: 0.22, expectedReturn: 0.12, risk: 0.18 },
      { ticker: 'MSFT', name: 'Microsoft', allocation: 0.18, expectedReturn: 0.11, risk: 0.16 },
      { ticker: 'BND', name: 'US Bonds', allocation: 0.40, expectedReturn: 0.04, risk: 0.05 },
      { ticker: 'GLD', name: 'Gold', allocation: 0.10, expectedReturn: 0.06, risk: 0.12 },
      { ticker: 'Cash', name: 'Cash', allocation: 0.10, expectedReturn: 0.02, risk: 0.00 },
    ],
    metrics: { sharpeRatio: 1.2, volatility: 0.11, maxDrawdown: -0.18 },
  },
  {
    id: 'p2',
    name: 'Conservative Income',
    totalValue: 125000,
    expectedReturn: 0.064,
    riskLevel: 'Low',
    sparkline: [100,100,101,101,102,103,103,104,105,106,106,107],
    assets: [
      { ticker: 'BND', name: 'US Bonds', allocation: 0.55, expectedReturn: 0.04, risk: 0.05 },
      { ticker: 'LQD', name: 'Corp Bonds', allocation: 0.25, expectedReturn: 0.05, risk: 0.06 },
      { ticker: 'VTI', name: 'US Stocks', allocation: 0.15, expectedReturn: 0.08, risk: 0.18 },
      { ticker: 'Cash', name: 'Cash', allocation: 0.05, expectedReturn: 0.02, risk: 0.00 },
    ],
    metrics: { sharpeRatio: 0.9, volatility: 0.06, maxDrawdown: -0.09 },
  },
  {
    id: 'p3',
    name: 'Aggressive Tech',
    totalValue: 305000,
    expectedReturn: 0.182,
    riskLevel: 'High',
    sparkline: [100,103,99,104,110,108,112,118,115,121,125,133],
    assets: [
      { ticker: 'NVDA', name: 'NVIDIA', allocation: 0.28, expectedReturn: 0.22, risk: 0.32 },
      { ticker: 'AAPL', name: 'Apple', allocation: 0.22, expectedReturn: 0.12, risk: 0.18 },
      { ticker: 'MSFT', name: 'Microsoft', allocation: 0.20, expectedReturn: 0.11, risk: 0.16 },
      { ticker: 'QQQ', name: 'NASDAQ 100', allocation: 0.25, expectedReturn: 0.13, risk: 0.22 },
      { ticker: 'Cash', name: 'Cash', allocation: 0.05, expectedReturn: 0.02, risk: 0.00 },
    ],
    metrics: { sharpeRatio: 1.4, volatility: 0.19, maxDrawdown: -0.28 },
  },
];

