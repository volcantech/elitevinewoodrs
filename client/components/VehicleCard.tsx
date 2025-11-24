import { Vehicle } from "@/data/vehicles";
import { Package, DollarSign, Users, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VehicleCardProps {
  vehicle: Vehicle;
}

export default function VehicleCard({ vehicle }: VehicleCardProps) {
  const formattedPrice = vehicle.price
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    .concat("$");

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 group">
      {/* Image Container */}
      <div className="relative overflow-hidden h-48 bg-gray-900">
        <img
          src={vehicle.image}
          alt={vehicle.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>

      {/* Content Container */}
      <div className="p-5">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
          {vehicle.name}
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-sm text-gray-400">{vehicle.category}</p>
          {vehicle.particularity && (
            <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {vehicle.particularity}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <DollarSign className="w-4 h-4 text-amber-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Prix
            </p>
            <p className="text-sm font-bold text-amber-400 text-center">
              {formattedPrice}
            </p>
          </div>

          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <Package className="w-4 h-4 text-blue-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Coffre
            </p>
            <p className="text-sm font-bold text-blue-400 text-center">
              {vehicle.trunkWeight} kg
            </p>
          </div>

          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <Users className="w-4 h-4 text-green-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Places
            </p>
            <p className="text-sm font-bold text-green-400 text-center">
              {vehicle.seats}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
