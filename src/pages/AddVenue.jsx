import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import adminApi, { getApiError } from "../api/adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import GoogleVenueLocation from "../components/GoogleVenueLocation";
import VenueMediaPicker, { ExistingMediaPreview } from "../components/VenueMediaPicker";
import "../styles/venue-editor.css";

const categories = [
  "Function Hall",
  "Banquet Hall",
  "Farm House",
  "Luxury Resort",
];
const capacities = [
  "50-100",
  "100-200",
  "200-400",
  "400-600",
  "600-800",
  "800-1000",
  "1000-1200",
  "1200+",
];
const amenities = [
  "Tables with basic covers",
  "Chairs",

  "Restrooms/Toilets",
  "Restrooms / Toilets",

  "Parking",

  "Wheelchair access",
  "Wheelchair Access",

  "Coolers / Fans",
  "Air Conditioners (AC)",
  "Bedrooms",

  "Sound/music license",
  "Sound System / Music Setup",

  "Lighting",
  "Power Backup",
  "Bridal Room",
  "Kitchen Space",

  "Projector / Screen",
  "Stage",
  "Dining Area",
  "Wi-Fi",
  "Drinking Water",
  "Attached Bathrooms",
  "Hot Water / Geyser",
  "Television",
  "Refrigerator",
  "Swimming Pool",
  "Kids Swimming Pool",
  "Private Lawn / Open Area",
  "Rain Dance",
  "Indoor Games",
  "Outdoor Games",
  "Kids Play Area",
  "Barbecue Setup",
  "Bonfire Area",
  "Pet Friendly",
  "Valet Parking",
  "Lift",
  "CCTV / Security",
  "Fire Safety Equipment",
  "Housekeeping",
  "Caretaker Available",
];
const menuDefinitions = [
  ["basic-veg", "Basic Veg"],
  ["premium-veg", "Premium Veg"],
  ["elite-veg", "Elite Veg"],
  ["basic-nonveg", "Basic Non-Veg"],
  ["premium-nonveg", "Premium Non-Veg"],
  ["elite-nonveg", "Elite Non-Veg"],
];
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const mediaList = (value) =>
  (Array.isArray(value) ? value.flat(Infinity) : value ? [value] : [])
    .filter((item) => item && typeof item === "object");
const amenityList = (value) => [...new Set(
  (Array.isArray(value) ? value.flat(Infinity) : [value])
    .filter((item) => typeof item === "string")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean),
)];

function Field({ label, name, values, onChange, children, ...props }) {
  return (
    <label className="ve-field">
      <span>
        {label}
        {props.required ? " *" : ""}
      </span>
      {children || (
        <input
          name={name}
          value={values[name]}
          onChange={onChange}
          {...props}
        />
      )}
    </label>
  );
}

export default function AddVenue() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { checkSession } = useAdminAuth();
  const [values, setValues] = useState({
    functionHallName: "",
    venueCategory: "Function Hall",
    vendorMobileNumber: "",
    description: "",
    foodType: "",
    seatingCapacity: "",
    bedRooms: "",
    functionHallAreaInSft: "",
    rentPricePerDay: "",
    advanceAmount: "",
    advanceAmountInPercentageForMenu: "",
    discountPercentage: "0",
    overTimeCharges: "",
    available: "true",
    includedGuestCount: '',
  });
  const [menuAvailable, setMenuAvailable] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [location, setLocation] = useState(null);
  const [cover, setCover] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [videos, setVideos] = useState([]);
  const [existingCover, setExistingCover] = useState(null);
  const [existingGallery, setExistingGallery] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [existingMenus, setExistingMenus] = useState([]);
  const [menus, setMenus] = useState(() =>
    Object.fromEntries(
      menuDefinitions.map(([id, label]) => [
        id,
        { name: `${label} Menu`, price: "", files: [] },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [fee, setFee] = useState(null);
  const [configError, setConfigError] = useState("");
  const [configRetry, setConfigRetry] = useState(0);
  const [loadingVenue, setLoadingVenue] = useState(editing);
  const [venueLoaded, setVenueLoaded] = useState(!editing);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setConfigError("");
    adminApi
      .get("/venues/form-config", { signal: abort.signal })
      .then(({ data }) => {
        if (!Number.isFinite(data.serviceFeePercent))
          throw new Error("Invalid pricing configuration.");
        setFee(data.serviceFeePercent);
      })
      .catch(async (failure) => {
        if (abort.signal.aborted) return;
        if (failure.response?.status === 401) {
          await checkSession();
          return;
        }
        setConfigError(
          "Unable to load server pricing settings. Check the form-config route.",
        );
      });
    return () => abort.abort();
  }, [checkSession, configRetry]);

  useEffect(() => {
    if (!editing) return;
    const abort = new AbortController();
    setLoadingVenue(true);
    setError("");
    adminApi
      .get(`/venues/${id}`, { signal: abort.signal })
      .then(({ data }) => {
        const venue = data?.data?._id ? data.data : data;
        if (!venue?._id) throw new Error("Unexpected venue response.");
        setValues({
          functionHallName: String(venue.functionHallName ?? ""),
          venueCategory: venue.venueCategory || "Function Hall",
          vendorMobileNumber: String(venue.vendorMobileNumber ?? ""),
          description: String(venue.description ?? ""),
          foodType: venue.foodType || "",
          seatingCapacity: venue.seatingCapacity || "",
          bedRooms: String(venue.bedRooms ?? ""),
          functionHallAreaInSft: String(venue.functionHallAreaInSft ?? ""),
          rentPricePerDay: String(venue.rentPricePerDay ?? ""),
          advanceAmount: String(venue.advanceAmount ?? ""),
          advanceAmountInPercentageForMenu: String(
            venue.advanceAmountInPercentageForMenu ?? "",
          ),
          discountPercentage: String(venue.discountPercentage ?? 0),
          overTimeCharges: String(venue.overTimeCharges ?? ""),
          available: String(venue.available === true),
          includedGuestCount: String(venue.includedGuestCount ?? ""),
        });
        setSelectedAmenities(amenityList(venue.hallAmenities));
        setMenuAvailable(
          venue.menuAvailable === true ||
          venue.pricingType === "menu_based" ||
          mediaList(venue.menuImages).length > 0,
        );
        setLocation({
          latitude: Number(venue.latitude),
          longitude: Number(venue.longitude),
          address: venue.address || venue.functionHallAddress?.address || "",
          city: venue.functionHallAddress?.city || "",
          county: venue.county || "",
          pinCode: venue.functionHallAddress?.pinCode || "",
          locationPlaceId: venue.locationPlaceId || "",
          locationSource: venue.locationSource || "google_pin",
        });
        setExistingCover(mediaList(venue.professionalImage)[0] || null);
        setExistingGallery(mediaList(venue.additionalImages));
        setExistingVideos(mediaList(venue.hallVideos));
        setExistingMenus(
          mediaList(venue.menuImages).map((menu) => ({
            ...menu,
            menuType: menu.menuType || "Menu",
            menuPrice: String(menu.menuPrice ?? ""),
          })),
        );
        setVenueLoaded(true);
        setDirty(false);
      })
      .catch(async (failure) => {
        if (abort.signal.aborted) return;
        if (failure.response?.status === 401) await checkSession();
        else setError(getApiError(failure, "Unable to load venue for editing."));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingVenue(false);
      });
    return () => abort.abort();
  }, [editing, id, checkSession]);
  useEffect(() => {
    const guard = (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const change = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setDirty(true);
  };
  const updateMenu = (id, patch) =>
    setMenus((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const changeNewMenu = (id, patch) => {
    updateMenu(id, patch);
    setDirty(true);
  };
  const updateExistingMenu = (menuId, patch) => {
    setExistingMenus((current) => current.map((menu) =>
      String(menu._id) === String(menuId) ? { ...menu, ...patch } : menu,
    ));
    setDirty(true);
  };
  const discounted = round(
    Number(values.rentPricePerDay || 0) *
    (1 - Number(values.discountPercentage) / 100),
  );
  const service = fee === null ? 0 : round((discounted * fee) / 100);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!location) {
      setError("Select and confirm the venue location on Google Maps.");
      return;
    }
    if (fee === null) {
      setError("Wait for the server pricing settings.");
      return;
    }
    if (!selectedAmenities.length) {
      setError("Select at least one amenity.");
      return;
    }
    const totalCover = cover.length ? 1 : existingCover ? 1 : 0;
    const totalGallery = gallery.length + existingGallery.length;
    if (totalCover !== 1 || totalGallery < 4 || totalGallery > 8) {
      setError("Keep or upload one cover photo and a total of 4–8 additional photos.");
      return;
    }
    const activeMenus = menuAvailable
      ? menuDefinitions.filter(
        ([id]) => menus[id].price !== "" || menus[id].files.length,
      )
      : [];
    if (menuAvailable && !activeMenus.length && !existingMenus.length) {
      setError("Keep or add at least one priced menu and its image.");
      return;
    }
    if (existingMenus.length + activeMenus.length > 6) {
      setError("Keep or add at most six menus.");
      return;
    }
    for (const entry of existingMenus) {
      if (
        !entry.menuType.trim() ||
        !Number.isFinite(Number(entry.menuPrice)) ||
        Number(entry.menuPrice) <= 0
      ) {
        setError("Every retained menu needs a name and positive price.");
        return;
      }
    }
    for (const [id, label] of activeMenus) {
      const entry = menus[id];
      if (
        !entry.name.trim() ||
        !Number.isFinite(Number(entry.price)) ||
        Number(entry.price) <= 0 ||
        entry.files.length !== 1
      ) {
        setError(`${label} needs a name, positive price and one menu image.`);
        return;
      }
    }
    if (!menuAvailable && Number(values.advanceAmount) > discounted) {
      setError("Advance cannot exceed the discounted rent.");
      return;
    }
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      data.append(key, value.trim()),
    );
    data.set("rentPricePerDay", menuAvailable ? "0" : values.rentPricePerDay);
    data.set("advanceAmount", menuAvailable ? "0" : values.advanceAmount);
    data.set(
      "advanceAmountInPercentageForMenu",
      menuAvailable ? values.advanceAmountInPercentageForMenu : "0",
    );
    data.append("menuAvailable", String(menuAvailable));
    data.append("hallAmenities", JSON.stringify(selectedAmenities));
    Object.entries(location).forEach(([key, value]) =>
      data.append(key, String(value ?? "")),
    );

    data.append("locationConfirmed", "true");
    if (cover[0]) data.append("professionalImage", cover[0]);
    gallery.forEach((file) => data.append("additionalImages", file));
    videos.forEach((file) => data.append("hallVideos", file));
    if (editing) {
      data.append("retainedCoverId", cover.length ? "" : existingCover?._id || "");
      data.append(
        "retainedAdditionalImageIds",
        JSON.stringify(existingGallery.map((item) => String(item._id))),
      );
      data.append(
        "retainedVideoIds",
        JSON.stringify(existingVideos.map((item) => String(item._id))),
      );
      data.append(
        "retainedMenuIds",
        JSON.stringify(menuAvailable ? existingMenus.map((item) => String(item._id)) : []),
      );
      data.append(
        "existingMenuUpdates",
        JSON.stringify(
          menuAvailable
            ? existingMenus.map((item) => ({
              id: String(item._id),
              menuType: item.menuType.trim(),
              menuPrice: Number(item.menuPrice),
            }))
            : [],
        ),
      );
    }
    const metadata = activeMenus.map(([id]) => {
      const entry = menus[id];
      const file = entry.files[0];
      const ext = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[file.type];
      const fileName = `${id}.${ext}`;
      data.append("menuImages", file, fileName);
      return {
        slot: id,
        fileName,
        menuType: entry.name.trim(),
        menuPrice: Number(entry.price),
      };
    });
    data.append("menuImagesMeta", JSON.stringify(metadata));
    setSaving(true);
    setProgress(0);
    try {
      await adminApi.request({
        method: editing ? "patch" : "post",
        url: editing ? `/venues/${id}` : "/venues",
        data,
        timeout: 300000,
        onUploadProgress: (event) => {
          if (event.total)
            setProgress(Math.round((event.loaded * 100) / event.total));
        },
      });
      setDirty(false);
      navigate(editing ? `/venues/${id}` : "/venues", {
        replace: true,
        state: {
          successMessage: editing
            ? "Venue details and media updated successfully."
            : "Venue and media saved successfully. Listing is on hold for review.",
        },
      });
    } catch (failure) {
      if (failure.response?.status === 401) {
        await checkSession();
        return;
      }
      setError(
        failure.response
          ? getApiError(failure, "Unable to save venue.")
          : editing
            ? "Update response was not received. Reload the venue before retrying."
            : "Save response was not received. Check All venues before retrying to avoid duplicates.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingVenue) {
    return <div className="venue-editor ve-loading" role="status">Loading venue for editing…</div>;
  }
  if (editing && !venueLoaded) {
    return (
      <div className="venue-editor">
        <Link to="/venues">← All venues</Link>
        <div className="ve-error" role="alert">
          {error || "Unable to load venue for editing."}
        </div>
      </div>
    );
  }

  return (
    <div className="venue-editor">
      <header className="ve-heading">
        <Link to="/venues">← All venues</Link>
        <span className="ve-eyebrow">{editing ? "VENUE MANAGEMENT" : "VENUE ONBOARDING"}</span>
        <h1>{editing ? "Edit venue" : "Add a venue"}</h1>
        <p>
          {editing
            ? "Update details and media without changing venue ownership or approval status."
            : "Details, location, menus and media — ready for a complete listing."}
        </p>
      </header>
      {configError && (
        <div className="ve-error" role="alert">
          {configError}{" "}
          <button type="button" onClick={() => setConfigRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      <form onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving} className="ve-fieldset">
          <section className="ve-section">
            <header>
              <span>01</span>
              <div>
                <h2>Venue essentials</h2>
                <p>
                  Use the same categories and capacity ranges as the mobile app.
                </p>
              </div>
            </header>
            <div className="ve-grid">
              <Field
                label="Venue name"
                name="functionHallName"
                values={values}
                onChange={change}
                required
                maxLength={200}
              />
              <Field
                label="Vendor mobile number"
                name="vendorMobileNumber"
                values={values}
                onChange={change}
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                required
                placeholder="10 digits, without +91"
              />
              <Field label="Category">
                <select
                  name="venueCategory"
                  value={values.venueCategory}
                  onChange={change}
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field label="Food type">
                <select
                  name="foodType"
                  value={values.foodType}
                  onChange={change}
                  required
                >
                  <option value="">Select food type</option>
                  <option value="veg">Vegetarian</option>
                  <option value="non-veg">Non-vegetarian</option>
                  <option value="Both">Both</option>
                </select>
              </Field>
              <Field label="Seating capacity">
                <select
                  name="seatingCapacity"
                  value={values.seatingCapacity}
                  onChange={change}
                  required
                >
                  <option value="">Select capacity</option>
                  {capacities.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
              {values.venueCategory === "Farm House" && (
                <Field
                  label="Guests included in the price"
                  name="includedGuestCount"
                  values={values}
                  onChange={change}
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  placeholder="Example: 12"
                />
              )}
              <Field
                label="Bedrooms"
                name="bedRooms"
                values={values}
                onChange={change}
                type="number"
                min="0"
                max="10000"
                step="1"
                required
              />
              <Field
                label="Hall area (sq ft)"
                name="functionHallAreaInSft"
                values={values}
                onChange={change}
                type="number"
                min="1"
                max="100000000"
                step="1"
                required
              />
              <Field label="Listing availability">
                <select
                  name="available"
                  value={values.available}
                  onChange={change}
                >
                  <option value="true">Available for enquiries</option>
                  <option value="false">Unavailable</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                name="description"
                value={values.description}
                onChange={change}
                rows={4}
                maxLength={5000}
              />
            </Field>
            <p className="ve-hint">
              The vendor number is contact information only. Ownership will not
              be assigned automatically.
            </p>
            <h3>Amenities *</h3>
            <div className="ve-amenities">
              {amenities.map((item) => (
                <label
                  key={item}
                  className={selectedAmenities.includes(item) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(item)}
                    onChange={() => {
                      setSelectedAmenities((current) =>
                        current.includes(item)
                          ? current.filter((value) => value !== item)
                          : [...current, item],
                      );
                      setDirty(true);
                    }}
                  />
                  {item}
                </label>
              ))}
            </div>
          </section>
          <section className="ve-section">
            <header>
              <span>02</span>
              <div>
                <h2>Google Maps location</h2>
                <p>Pin the venue entrance, not a generic city location.</p>
              </div>
            </header>
            <GoogleVenueLocation
              value={location}
              onChange={(next) => {
                setLocation(next);
                setDirty(true);
              }}
              disabled={saving}
            />
          </section>
          <section className="ve-section">
            <header>
              <span>03</span>
              <div>
                <h2>Pricing and menus</h2>
                <p>
                  Menu mode matches the mobile flow: it replaces fixed daily
                  rent.
                </p>
              </div>
            </header>
            <label className="ve-mode">
              <input
                type="checkbox"
                checked={menuAvailable}
                onChange={(event) => {
                  setMenuAvailable(event.target.checked);
                  setDirty(true);
                }}
              />
              In-house catering / menu-based pricing
            </label>
            {menuAvailable ? (
              <>
                <p className="ve-hint">
                  Add at least one complete menu. Each used slot needs its own
                  name, per-plate price and photo. Unused slots may stay empty.
                </p>
                {editing && existingMenus.length > 0 && (
                  <div className="ve-existing-section">
                    <h3>Currently saved menus</h3>
                    <div className="ve-menu-grid">
                      {existingMenus.map((menu) => (
                        <div className="ve-menu" key={menu._id}>
                          <Field label="Menu name">
                            <input
                              value={menu.menuType}
                              maxLength={120}
                              onChange={(event) =>
                                updateExistingMenu(menu._id, { menuType: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="Price per plate (₹)">
                            <input
                              type="number"
                              min="0.01"
                              max="1000000"
                              step="0.01"
                              value={menu.menuPrice}
                              onChange={(event) =>
                                updateExistingMenu(menu._id, { menuPrice: event.target.value })
                              }
                            />
                          </Field>
                          <ExistingMediaPreview
                            item={menu}
                            disabled={saving}
                            onRemove={() => {
                              setExistingMenus((current) =>
                                current.filter((item) => String(item._id) !== String(menu._id)),
                              );
                              setDirty(true);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="ve-menu-grid">
                  {menuDefinitions.map(([id, label]) => (
                    <div className="ve-menu" key={id}>
                      <h3>{label}</h3>
                      <Field label="Menu name">
                        <input
                          value={menus[id].name}
                          maxLength={120}
                          onChange={(event) =>
                            changeNewMenu(id, { name: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Price per plate (₹)">
                        <input
                          type="number"
                          min="0.01"
                          max="1000000"
                          step="0.01"
                          value={menus[id].price}
                          onChange={(event) =>
                            changeNewMenu(id, { price: event.target.value })
                          }
                        />
                      </Field>
                      <VenueMediaPicker
                        files={menus[id].files}
                        label={`${label} menu image`}
                        maxCount={1}
                        onChange={(files) => changeNewMenu(id, { files })}
                        disabled={saving}
                        onError={setError}
                      />
                    </div>
                  ))}
                </div>
                <Field
                  label="Advance percentage"
                  name="advanceAmountInPercentageForMenu"
                  values={values}
                  onChange={change}
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  required
                />
              </>
            ) : (
              <div className="ve-grid">
                <Field
                  label="Daily rent (₹)"
                  name="rentPricePerDay"
                  values={values}
                  onChange={change}
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  required
                />
                <Field
                  label="Advance amount (₹)"
                  name="advanceAmount"
                  values={values}
                  onChange={change}
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  required
                />
              </div>
            )}
            <div className="ve-grid">
              <Field label="Discount">
                <select
                  name="discountPercentage"
                  value={values.discountPercentage}
                  onChange={change}
                >
                  {[0, 5, 10, 15, 20, 25, 30, 50].map((amount) => (
                    <option key={amount} value={amount}>
                      {amount}%
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Overtime charge per hour (₹)"
                name="overTimeCharges"
                values={values}
                onChange={change}
                type="number"
                min="0"
                max="100000000"
                step="0.01"
              />
            </div>
            {!menuAvailable && fee !== null && (
              <dl className="ve-price-summary">
                <div>
                  <dt>After discount</dt>
                  <dd>{money(discounted)}</dd>
                </div>
                <div>
                  <dt>Service fee ({fee}%)</dt>
                  <dd>{money(service)}</dd>
                </div>
                <div>
                  <dt>Vendor earnings</dt>
                  <dd>{money(round(discounted - service))}</dd>
                </div>
              </dl>
            )}
            <p className="ve-hint">
              Final calculations are made by the backend. In menu mode,
              rent-derived earnings are zero, as in your mobile form; selected
              discounts are stored but not applied to menu prices here.
            </p>
          </section>
          <section className="ve-section">
            <header>
              <span>04</span>
              <div>
                <h2>Photos and videos</h2>
                <p>Preview, enlarge, replace or remove media before saving.</p>
              </div>
            </header>
            {editing && existingCover && !cover.length && (
              <div className="ve-existing-section">
                <h3>Current cover photo</h3>
                <div className="ve-media-grid">
                  <ExistingMediaPreview
                    item={existingCover}
                    disabled={saving}
                    onRemove={() => {
                      setExistingCover(null);
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
            )}
            <VenueMediaPicker
              label={editing ? "Replacement cover photo — optional" : "Cover photo *"}
              files={cover}
              maxCount={1}
              onChange={(files) => {
                setCover(files);
                setDirty(true);
              }}
              disabled={saving}
              onError={setError}
            />
            {editing && existingGallery.length > 0 && (
              <div className="ve-existing-section">
                <h3>Current additional photos</h3>
                <div className="ve-media-grid">
                  {existingGallery.map((item) => (
                    <ExistingMediaPreview
                      key={item._id}
                      item={item}
                      disabled={saving}
                      onRemove={() => {
                        setExistingGallery((current) =>
                          current.filter((photo) => String(photo._id) !== String(item._id)),
                        );
                        setDirty(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {(!editing || existingGallery.length < 8) && <VenueMediaPicker
              label={editing ? "Add more photos — total must remain 4–8" : "Additional photos * — minimum 4"}
              files={gallery}
              maxCount={8 - existingGallery.length}
              onChange={(files) => {
                setGallery(files);
                setDirty(true);
              }}
              disabled={saving}
              onError={setError}
            />}
            {editing && existingVideos.length > 0 && (
              <div className="ve-existing-section">
                <h3>Current videos</h3>
                <div className="ve-media-grid">
                  {existingVideos.map((item) => (
                    <ExistingMediaPreview
                      key={item._id}
                      item={item}
                      video
                      disabled={saving}
                      onRemove={() => {
                        setExistingVideos((current) =>
                          current.filter((video) => String(video._id) !== String(item._id)),
                        );
                        setDirty(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {(!editing || existingVideos.length < 3) && <VenueMediaPicker
              label={editing ? "Add videos — optional" : "Venue videos — optional"}
              files={videos}
              maxCount={3 - existingVideos.length}
              video
              onChange={(files) => {
                setVideos(files);
                setDirty(true);
              }}
              disabled={saving}
              onError={setError}
            />}
          </section>
        </fieldset>
        {error && (
          <div className="ve-error" role="alert">
            {error}
          </div>
        )}
        <div className="ve-save">
          <div>
            <strong>{editing ? "Save venue changes" : "Save for review"}</strong>
            <p>
              {editing
                ? "Approval status and vendor ownership will remain unchanged."
                : "Listing stays on hold. Vendor ownership remains unassigned."}
            </p>
            {saving && (
              <p role="status">
                {progress < 100
                  ? `Uploading: ${progress}%`
                  : "Upload sent. Verifying media and saving — please wait…"}
              </p>
            )}
          </div>
          <button
            className="primary-button"
            type="submit"
            disabled={saving || fee === null}
          >
            {saving ? "Saving venue…" : editing ? "Save Changes" : "Save Venue"}
          </button>
        </div>
      </form>
    </div>
  );
}
