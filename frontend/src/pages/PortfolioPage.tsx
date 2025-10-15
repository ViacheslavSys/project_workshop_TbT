export default function PortfolioPage(){
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[1,2,3].map(i=>(
        <div key={i} className="bg-[var(--color-surface)] rounded-lg p-6 border border-white/10">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-white text-lg font-semibold">Портфель {i}</h3>
            <span className="text-xs text-white/60">Умеренный</span>
          </div>
          <p className="text-white/70 text-sm mb-3">Цель: долгосрочные накопления</p>
          <div className="text-2xl font-bold mb-1">1,900,000₽</div>
          <div className="text-sm text-green-500">+11.8%</div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>Прогресс к цели</span><span>12.7%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded">
              <div className="h-2 bg-[var(--color-primary)] rounded" style={{width:"12.7%"}}/>
            </div>
            <div className="text-xs text-white/50 mt-1">Цель: 15,000,000₽</div>
          </div>
        </div>
      ))}
    </div>
  );
}
