export function LoadingCar() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-amber-400 font-semibold text-lg">Chargement des véhicules...</p>
      <div className="flex gap-1 justify-center mt-3">
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
      </div>
    </div>
  );
}
