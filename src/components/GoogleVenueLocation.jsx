import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../../utils/loadGoogleMaps";

function locationRecord(position, address, components, placeId, source) {
  const get = (type) => {
    const part = components?.find((item) => item.types?.includes(type));
    return part?.longText || part?.long_name || "";
  };
  return {
    latitude: position.lat,
    longitude: position.lng,
    address,
    city:
      get("locality") ||
      get("postal_town") ||
      get("administrative_area_level_2"),
    county: get("sublocality_level_1") || get("sublocality") || get("locality"),
    pinCode: get("postal_code"),
    locationPlaceId: placeId,
    locationSource: source,
  };
}

export default function GoogleVenueLocation({ value, onChange, disabled }) {
  const mapNode = useRef(null);
  const searchNode = useRef(null);
  const interactionNode = useRef(null);
  const changeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  changeRef.current = onChange;
  disabledRef.current = disabled;
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [street, setStreet] = useState({ state: "idle" });
  useEffect(() => {
    if (interactionNode.current)
      interactionNode.current.inert = Boolean(disabled);
  }, [disabled]);

  useEffect(() => {
    let disposed = false;
    let sequence = 0;
    let marker;
    let autocomplete;
    const listeners = [];
    let onSelect;
    let onInput;
    let onPlacesError;
    async function setup() {
      try {
        const g = await loadGoogleMaps();
        const [
          { Map },
          { AdvancedMarkerElement },
          { PlaceAutocompleteElement },
          { Geocoder },
          { StreetViewService },
        ] = await Promise.all([
          g.importLibrary("maps"),
          g.importLibrary("marker"),
          g.importLibrary("places"),
          g.importLibrary("geocoding"),
          g.importLibrary("streetView"),
        ]);
        if (disposed) return;
        // This is only the initial viewport, never a saved location.
        const map = new Map(mapNode.current, {
          center: { lat: 17.385, lng: 78.4867 },
          zoom: 11,
          mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
          streetViewControl: true,
          fullscreenControl: true,
          mapTypeControl: true,
        });
        mapRef.current = map;
        marker = new AdvancedMarkerElement({
          gmpDraggable: true,
          title: "Venue entrance — drag to adjust",
        });
        const geocoder = new Geocoder();
        const streetService = new StreetViewService();
        autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ["in"],
        });
        autocomplete.placeholder =
          "Search venue name or address in Google Maps";
        autocomplete.setAttribute("aria-label", "Search venue on Google Maps");
        searchNode.current.replaceChildren(autocomplete);

        const savedLat = Number(value?.latitude);
        const savedLng = Number(value?.longitude);
        if (
          value &&
          Number.isFinite(savedLat) &&
          Number.isFinite(savedLng) &&
          Math.abs(savedLat) <= 90 &&
          Math.abs(savedLng) <= 180
        ) {
          const savedPosition = { lat: savedLat, lng: savedLng };
          setCandidate({ ...value, latitude: savedLat, longitude: savedLng });
          marker.position = savedPosition;
          marker.map = map;
          map.setCenter(savedPosition);
          map.setZoom(17);
          setStreet({ state: "loading" });
          streetService.getPanorama(
            { location: savedPosition, radius: 50 },
            (result, status) => {
              if (disposed) return;
              if (status === "OK" && result?.location?.pano)
                setStreet({ state: "available", pano: result.location.pano });
              else if (status === "ZERO_RESULTS")
                setStreet({ state: "unavailable" });
              else setStreet({ state: "error" });
            },
          );
        }

        function invalidate() {
          sequence += 1;
          changeRef.current(null);
          setCandidate(null);
          setStreet({ state: "idle" });
          setError("");
          return sequence;
        }
        function accept(record, ticket) {
          if (disposed || ticket !== sequence) return;
          if (!record.address || !record.locationPlaceId)
            throw new Error(
              "No address found for this point. Select a nearby point at the venue entrance.",
            );
          setCandidate(record);
          setBusy(false);
          const position = { lat: record.latitude, lng: record.longitude };
          marker.position = position;
          marker.map = map;
          map.panTo(position);
          map.setZoom(Math.max(map.getZoom(), 17));
          setStreet({ state: "loading" });
          streetService.getPanorama(
            { location: position, radius: 50 },
            (result, status) => {
              if (disposed || ticket !== sequence) return;
              if (status === "OK" && result?.location?.pano)
                setStreet({ state: "available", pano: result.location.pano });
              else if (status === "ZERO_RESULTS")
                setStreet({ state: "unavailable" });
              else setStreet({ state: "error" });
            },
          );
        }
        async function pickPoint(position) {
          if (disposed || disabledRef.current) return;
          const ticket = invalidate();
          setBusy(true);
          try {
            const { results } = await geocoder.geocode({ location: position });
            const result = results?.[0];
            if (!result)
              throw new Error(
                "Google could not resolve an address here. Select the venue entrance or search the venue name.",
              );
            accept(
              locationRecord(
                position,
                result.formatted_address,
                result.address_components,
                result.place_id,
                "google_pin",
              ),
              ticket,
            );
          } catch (failure) {
            if (!disposed && ticket === sequence) {
              setError(
                failure.message || "Unable to resolve this map location.",
              );
              setBusy(false);
            }
          }
        }
        onSelect = async ({ placePrediction }) => {
          if (disabledRef.current) return;
          const ticket = invalidate();
          setBusy(true);
          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: [
                "id",
                "formattedAddress",
                "addressComponents",
                "location",
              ],
            });
            if (!place.location)
              throw new Error(
                "This selection has no coordinates. Choose a different result.",
              );
            accept(
              locationRecord(
                place.location.toJSON(),
                place.formattedAddress,
                place.addressComponents,
                place.id,
                "google_place",
              ),
              ticket,
            );
          } catch (failure) {
            if (!disposed && ticket === sequence) {
              setError(failure.message || "Unable to load the selected place.");
              setBusy(false);
            }
          }
        };
        onInput = () => {
          if (!disabledRef.current) {
            invalidate();
            setBusy(false);
          }
        };
        onPlacesError = () => {
          if (!disposed)
            setError(
              "Places search failed. Check Places API (New), billing and browser key restrictions.",
            );
        };
        autocomplete.addEventListener("gmp-select", onSelect);
        autocomplete.addEventListener("input", onInput);
        autocomplete.addEventListener("gmp-error", onPlacesError);
        listeners.push(
          map.addListener("click", (event) => {
            if (event.placeId) event.stop();
            if (event.latLng) pickPoint(event.latLng.toJSON());
          }),
        );
        listeners.push(
          marker.addListener("dragstart", () => {
            if (!disabledRef.current) invalidate();
          }),
        );
        listeners.push(
          marker.addListener("dragend", () => {
            const p = marker.position;
            if (p)
              pickPoint({
                lat: typeof p.lat === "function" ? p.lat() : p.lat,
                lng: typeof p.lng === "function" ? p.lng() : p.lng,
              });
          }),
        );
        setReady(true);
      } catch (failure) {
        if (!disposed)
          setError(failure.message || "Unable to initialize Google Maps.");
      }
    }
    setup();
    return () => {
      disposed = true;
      sequence += 1;
      listeners.forEach((listener) => listener.remove());
      if (autocomplete) {
        autocomplete.removeEventListener("gmp-select", onSelect);
        autocomplete.removeEventListener("input", onInput);
        autocomplete.removeEventListener("gmp-error", onPlacesError);
        autocomplete.remove();
      }
      if (marker) marker.map = null;
      mapRef.current?.getStreetView().setVisible(false);
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="ve-location">
      <p>
        Search and select the venue, or click the map and adjust the pin to its
        entrance. Then confirm. Address and coordinates cannot be typed
        manually.
      </p>
      <div className="ve-map-interactions" ref={interactionNode}>
        <div ref={searchNode} className="ve-map-search" />
        {!ready && !error && <p role="status">Loading Google Maps…</p>}
        <div
          ref={mapNode}
          className="ve-map"
          aria-label="Select venue location on map"
        />
      </div>
      {error && (
        <p className="ve-error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Resolving selected location…</p>}
      {candidate && !busy && (
        <>
          <dl className="ve-location-details">
            <div>
              <dt>Google address</dt>
              <dd>{candidate.address}</dd>
            </div>
            <div>
              <dt>City / locality</dt>
              <dd>
                {candidate.city || "Not returned by Google"} /{" "}
                {candidate.county || "—"}
              </dd>
            </div>
            <div>
              <dt>PIN code</dt>
              <dd>{candidate.pinCode || "Not returned by Google"}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {candidate.latitude.toFixed(6)},{" "}
                {candidate.longitude.toFixed(6)}
              </dd>
            </div>
          </dl>
          <div className="ve-actions">
            <button
              type="button"
              disabled={disabled}
              className="primary-button"
              onClick={() => onChange(candidate)}
            >
              {value ? "Location confirmed ✓" : "Confirm this venue location"}
            </button>
            {street.state === "available" && (
              <button
                type="button"
                className="secondary-button"
                disabled={disabled}
                onClick={() => {
                  const panorama = mapRef.current?.getStreetView();
                  if (panorama) {
                    panorama.setPano(street.pano);
                    panorama.setVisible(true);
                  }
                }}
              >
                Preview nearby Street View
              </button>
            )}
          </div>
          <p className="ve-hint" role="status">
            {street.state === "loading"
              ? "Checking Street View coverage…"
              : street.state === "unavailable"
                ? "No Street View found within 50 metres. You can still save this venue."
                : street.state === "error"
                  ? "Street View check failed. You can still save the confirmed map location."
                  : "Street View may show a nearby road, not the venue interior. Venue coordinates remain unchanged."}
          </p>
        </>
      )}
      {!value && (
        <p className="ve-hint">
          A confirmed Google Maps location is required before saving.
        </p>
      )}
    </div>
  );
}
