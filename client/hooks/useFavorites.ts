import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "elite_vinewood_favorites";

export interface FavoriteVehicle {
  id: number;
  name: string;
  category: string;
  price: number;
  image_url: string;
  seats: number;
  trunk_weight: number;
}

function loadLocalFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set<number>(parsed.map(Number));
  } catch {}
  return new Set();
}

function saveLocalFavorites(favorites: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  } catch {}
}

export function useFavorites(token?: string | null) {
  const [favorites, setFavorites] = useState<Set<number>>(() => loadLocalFavorites());
  const [favoriteVehicles, setFavoriteVehicles] = useState<FavoriteVehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const prevTokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevTokenRef.current === token) return;
    prevTokenRef.current = token;

    if (!token) {
      setFavorites(loadLocalFavorites());
      setFavoriteVehicles([]);
      setLoaded(true);
      return;
    }

    setLoaded(false);
    fetch("/api/public/favorites", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<number>((data.favorites || []).map(Number));
        setFavorites(ids);
        setFavoriteVehicles(data.vehicles || []);
        saveLocalFavorites(ids);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [token]);

  const toggleFavorite = useCallback(
    async (vehicleId: number | string) => {
      const id = Number(vehicleId);
      const isFav = favorites.has(id);

      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.delete(id);
        } else {
          next.add(id);
        }
        saveLocalFavorites(next);
        return next;
      });

      if (isFav) {
        setFavoriteVehicles((prev) => prev.filter((v) => v.id !== id));
      }

      if (token) {
        try {
          await fetch(`/api/public/favorites/${id}`, {
            method: isFav ? "DELETE" : "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!isFav) {
            const res = await fetch("/api/public/favorites", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setFavoriteVehicles(data.vehicles || []);
          }
        } catch {}
      }
    },
    [token, favorites]
  );

  const isFavorite = useCallback(
    (vehicleId: number | string) => favorites.has(Number(vehicleId)),
    [favorites]
  );

  return { favorites, favoriteVehicles, toggleFavorite, isFavorite, count: favorites.size, loaded };
}
