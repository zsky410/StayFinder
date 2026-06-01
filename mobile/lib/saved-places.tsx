import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { PlaceDetail, PlaceSummary } from "@/lib/stayfinder";

export type SavedPlaceRecord = {
  id: string;
  place_id: string;
  title: string;
  location: string;
  price_text: string | null;
  rating: number | null;
  cover_image: string | null;
};

type SavedPlacesContextValue = {
  savedPlaces: SavedPlaceRecord[];
  isSaved: (placeId: string) => boolean;
  toggleSavedFromSummary: (place: PlaceSummary) => void;
  toggleSavedFromDetail: (place: PlaceDetail) => void;
  removeSaved: (placeId: string) => void;
};

const SavedPlacesContext = createContext<SavedPlacesContextValue | null>(null);

function buildLocation(parts: Array<string | null | undefined>) {
  const values = parts.map((part) => String(part || "").trim()).filter(Boolean);
  return values.join(" • ") || "Đà Nẵng";
}

function fromSummary(place: PlaceSummary): SavedPlaceRecord {
  return {
    id: place.id,
    place_id: place.place_id,
    title: place.title,
    location: buildLocation([place.neighborhood, place.district, place.address]),
    price_text: place.price_text,
    rating: place.rating,
    cover_image: place.cover_image,
  };
}

function fromDetail(place: PlaceDetail): SavedPlaceRecord {
  return {
    id: place.id,
    place_id: place.place_id,
    title: place.title,
    location: buildLocation([place.neighborhood, place.district, place.address]),
    price_text: place.price_text,
    rating: place.rating,
    cover_image: place.cover_image,
  };
}

export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceRecord[]>([]);

  const value = useMemo<SavedPlacesContextValue>(
    () => ({
      savedPlaces,
      isSaved(placeId) {
        return savedPlaces.some((item) => item.place_id === placeId);
      },
      toggleSavedFromSummary(place) {
        setSavedPlaces((current) => {
          const exists = current.some((item) => item.place_id === place.place_id);
          if (exists) {
            return current.filter((item) => item.place_id !== place.place_id);
          }
          return [fromSummary(place), ...current];
        });
      },
      toggleSavedFromDetail(place) {
        setSavedPlaces((current) => {
          const exists = current.some((item) => item.place_id === place.place_id);
          if (exists) {
            return current.filter((item) => item.place_id !== place.place_id);
          }
          return [fromDetail(place), ...current];
        });
      },
      removeSaved(placeId) {
        setSavedPlaces((current) => current.filter((item) => item.place_id !== placeId));
      },
    }),
    [savedPlaces],
  );

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>;
}

export function useSavedPlaces() {
  const context = useContext(SavedPlacesContext);
  if (!context) {
    throw new Error("useSavedPlaces must be used within SavedPlacesProvider.");
  }
  return context;
}
