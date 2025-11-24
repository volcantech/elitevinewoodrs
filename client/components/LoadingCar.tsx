export function LoadingCar() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <svg
        width="200"
        height="120"
        viewBox="0 0 200 120"
        className="mb-6"
      >
        <defs>
          <style>{`
            @keyframes drive {
              0% { transform: translateX(-50px); }
              100% { transform: translateX(250px); }
            }
            @keyframes spin-wheel {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .car {
              animation: drive 2s ease-in-out infinite;
            }
            .wheel {
              animation: spin-wheel 0.8s linear infinite;
              transform-origin: 30px 95px;
            }
            .wheel2 {
              animation: spin-wheel 0.8s linear infinite;
              transform-origin: 150px 95px;
            }
          `}</style>
        </defs>
        
        {/* Road line */}
        <line x1="0" y1="100" x2="200" y2="100" stroke="#666" strokeWidth="2" strokeDasharray="10,10" />
        
        {/* Car group */}
        <g className="car">
          {/* Car body */}
          <rect x="20" y="60" width="100" height="25" rx="3" fill="#dc2626" />
          
          {/* Car top */}
          <rect x="35" y="40" width="70" height="20" rx="3" fill="#dc2626" />
          
          {/* Windows */}
          <rect x="38" y="43" width="20" height="15" rx="2" fill="#87ceeb" opacity="0.6" />
          <rect x="67" y="43" width="20" height="15" rx="2" fill="#87ceeb" opacity="0.6" />
          
          {/* Front bumper */}
          <rect x="20" y="85" width="100" height="3" fill="#333" />
          
          {/* Wheel 1 */}
          <g className="wheel">
            <circle cx="30" cy="95" r="12" fill="#333" />
            <circle cx="30" cy="95" r="8" fill="#555" />
            <line x1="30" y1="87" x2="30" y2="103" stroke="#888" strokeWidth="1" />
            <line x1="22" y1="95" x2="38" y2="95" stroke="#888" strokeWidth="1" />
          </g>
          
          {/* Wheel 2 */}
          <g className="wheel2">
            <circle cx="150" cy="95" r="12" fill="#333" />
            <circle cx="150" cy="95" r="8" fill="#555" />
            <line x1="150" y1="87" x2="150" y2="103" stroke="#888" strokeWidth="1" />
            <line x1="142" y1="95" x2="158" y2="95" stroke="#888" strokeWidth="1" />
          </g>
        </g>
      </svg>
      
      <div className="text-center">
        <p className="text-amber-400 font-semibold text-lg">Chargement des véhicules...</p>
        <div className="flex gap-1 justify-center mt-3">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
}
