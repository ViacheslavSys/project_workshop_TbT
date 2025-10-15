export default function PortfolioPage(){
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[1,2,3].map(i=>(
        <div key={i} className="card">
          <div className="card-body">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold">Портфель {i}</h3>
                <p className="text-xs text-muted mt-0.5">Цель: долгосрочные накопления</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-border">Умеренный</span>
            </div>

            <div className="text-2xl font-bold mb-1">1 900 000₽</div>
            <div className="text-sm text-success">+11.8%</div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Прогресс к цели</span><span>12.7%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded">
                <div className="h-2 bg-primary rounded" style={{width:"12.7%"}}/>
              </div>
              <div className="text-xs text-muted mt-1">Цель: 15 000 000₽</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
