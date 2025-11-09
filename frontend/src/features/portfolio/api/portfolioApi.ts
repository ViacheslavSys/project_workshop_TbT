export async function fetchPortfolioAnalysis(userId: string): Promise<string> {
  // Placeholder: in real app, call backend API with userId
  // For now, return a short markdown explanation to render in MLReport
  const text = `# Portfolio Analysis\n\n` +
    `This is a demo analysis for user \`${userId}\`.\n\n` +
    `- Diversify across asset classes to reduce risk.\n` +
    `- Rebalance quarterly to maintain target allocations.\n` +
    `- Consider long-term expected returns and volatility.`;
  // Simulate latency for UX
  await new Promise((r) => setTimeout(r, 300));
  return text;
}
