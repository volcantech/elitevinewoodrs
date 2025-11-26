import { useState } from "react";
import { Vehicle } from "@/data/vehicles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Scale, X, Sparkles, Plus, Search, DollarSign, Package, Users } from "lucide-react";

interface CompareDialogProps {
  vehicles: (Vehicle | null)[];
  allVehicles: Vehicle[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveVehicle: (index: number) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export function CompareDialog({
  vehicles,
  allVehicles,
  isOpen,
  onOpenChange,
  onRemoveVehicle,
  onSelectVehicle,
}: CompareDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const formatPrice = (price: number) =>
    price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "$";

  const filledVehicles = vehicles.filter((v) => v !== null);
  
  // Get already selected vehicle IDs
  const selectedIds = new Set(vehicles.map((v) => v?.id).filter((id) => id));
  
  // Filter available vehicles for search
  const searchResults = searchQuery.trim()
    ? allVehicles.filter(
        (v) =>
          !selectedIds.has(v.id) &&
          v.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectVehicle = (vehicle: Vehicle) => {
    onSelectVehicle(vehicle);
    setSearchQuery("");
    setShowSearch(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-slate-900 border-amber-600/30">
        <DialogHeader>
          <DialogTitle className="text-amber-400 flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Comparaison de véhicules ({filledVehicles.length}/4)
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-6" style={{ gridTemplateColumns: `repeat(${Math.max(2, vehicles.length)}, 1fr)` }}>
          {/* Existing vehicles */}
          {vehicles.map((vehicle, idx) =>
            vehicle ? (
              <div key={idx} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-500/50 transition-all duration-300">
                <div className="relative overflow-hidden h-40 bg-gray-900">
                  <img
                    src={vehicle.image}
                    alt={vehicle.name}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 bg-red-500/80 hover:bg-red-600 text-white"
                    onClick={() => onRemoveVehicle(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-4">
                  <h3 className="text-lg font-bold text-white mb-1">{vehicle.name}</h3>
                  <p className="text-sm text-gray-400 mb-4">{vehicle.category}</p>

                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
                        <DollarSign className="w-4 h-4 text-amber-400 mb-1" />
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                          Prix
                        </p>
                        <p className="text-xs font-bold text-amber-400 text-center">
                          {formatPrice(vehicle.price)}
                        </p>
                      </div>

                      <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
                        <Package className="w-4 h-4 text-blue-400 mb-1" />
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                          Coffre
                        </p>
                        <p className="text-xs font-bold text-blue-400">{vehicle.trunkWeight} kg</p>
                      </div>

                      <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
                        <Users className="w-4 h-4 text-green-400 mb-1" />
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                          Places
                        </p>
                        <p className="text-xs font-bold text-green-400">{vehicle.seats}</p>
                      </div>
                    </div>

                    {vehicle.particularity && (
                      <div className="flex justify-center">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 flex items-center gap-1 text-xs">
                          <Sparkles className="w-3 h-3" />
                          {vehicle.particularity}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null
          )}

          {/* Add vehicle button or search */}
          {filledVehicles.length < 4 && (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg border-2 border-dashed border-amber-500/30 hover:border-amber-500/60 transition-all flex flex-col items-center justify-center min-h-96 p-4">
              {!showSearch ? (
                <button
                  onClick={() => setShowSearch(true)}
                  className="text-center group w-full h-full flex flex-col items-center justify-center"
                >
                  <Plus className="h-12 w-12 mb-2 text-amber-400 group-hover:scale-110 transition-transform" />
                  <p className="text-gray-300 font-semibold">Ajouter un véhicule</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ({4 - filledVehicles.length} disponible{4 - filledVehicles.length > 1 ? "s" : ""})
                  </p>
                </button>
              ) : (
                <div className="w-full space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-amber-400" />
                    <Input
                      placeholder="Tapez le nom du véhicule..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="pl-10 bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/50 focus:border-amber-500 focus:ring-amber-500/20"
                    />
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {searchResults.slice(0, 5).map((vehicle) => (
                        <button
                          key={vehicle.id}
                          onClick={() => handleSelectVehicle(vehicle)}
                          className="w-full text-left p-2 rounded-lg bg-slate-700/50 hover:bg-amber-500/20 border border-slate-600 hover:border-amber-500/50 transition-all"
                        >
                          <p className="font-semibold text-white text-sm">{vehicle.name}</p>
                          <p className="text-xs text-gray-400">
                            {vehicle.category} • {formatPrice(vehicle.price)}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.trim() ? (
                    <p className="text-center text-gray-400 py-4">Aucun véhicule trouvé</p>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={() => setShowSearch(false)}
                    className="w-full border-gray-600 text-gray-300 hover:bg-slate-700"
                  >
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
