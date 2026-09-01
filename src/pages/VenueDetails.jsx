import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import adminApi, { getApiError } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { loadGoogleMaps } from '../../utils/loadGoogleMaps';
import '../styles/venue-review.css';

const money = value => value == null || value === '' || !Number.isFinite(Number(value))
  ? 'Not provided'
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
const display = value => value == null || value === '' ? 'Not provided' : String(value);
const percent = value => value == null || value === '' ? 'Not provided' : `${value}%`;
const dateText = value => value && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toLocaleString('en-IN') : 'Not provided';
const statusLabel = value => value === 'approved' ? 'Approved' : value === 'onhold' ? 'On hold' : display(value);
const mediaList = value => (Array.isArray(value) ? value.flat(Infinity) : value ? [value] : [])
  .filter(item => item && typeof item === 'object');
const safeUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
};
const amenitiesList = value => [...new Set(
  (Array.isArray(value) ? value.flat(Infinity) : [value])
    .filter(item => typeof item === 'string')
    .flatMap(item => item.split(',')).map(item => item.trim()).filter(Boolean),
)];
const coordinates = venue => {
  if ([venue.latitude, venue.longitude].some(value => value == null || String(value).trim() === '')) return null;
  const lat = Number(venue.latitude), lng = Number(venue.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng } : null;
};

function Detail({ label, value }) {
  return <div><dt>{label}</dt><dd>{display(value)}</dd></div>;
}

function Photo({ photo, label, onOpen }) {
  const [failed, setFailed] = useState(false);
  const url = safeUrl(photo?.url);
  return (
    <figure className="vr-photo">
      {url && !failed ? (
        <button type="button" onClick={() => onOpen({ url, label })} aria-label={`View full-size ${label}`}>
          <img src={url} alt={label} loading="lazy" onError={() => setFailed(true)} />
        </button>
      ) : <div className="vr-missing">Image unavailable</div>}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function FullImage({ image, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="vr-lightbox" aria-label={image.label} onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) ref.current.close(); }}>
      <div className="vr-lightbox-head"><strong>{image.label}</strong>
        <button type="button" autoFocus onClick={() => ref.current.close()}>Close</button>
      </div>
      <img src={image.url} alt={image.label} />
      <a href={image.url} target="_blank" rel="noopener noreferrer">Open original image</a>
    </dialog>
  );
}

function VenueMap({ lat, lng, name }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false, marker, map, maps;
    const container = ref.current;
    async function initialise() {
      try {
        maps = await loadGoogleMaps();
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          maps.importLibrary('maps'), maps.importLibrary('marker'),
        ]);
        if (cancelled) return;
        map = new Map(container, {
          center: { lat, lng }, zoom: 16,
          mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
          streetViewControl: true, fullscreenControl: true,
          mapTypeControl: true, gestureHandling: 'cooperative',
        });
        marker = new AdvancedMarkerElement({ map, position: { lat, lng }, title: name, gmpDraggable: false });
      } catch (err) { if (!cancelled) setError(err.message || 'Unable to load map.'); }
    }
    initialise();
    return () => {
      cancelled = true;
      if (marker) marker.map = null;
      if (map) maps.event.clearInstanceListeners(map);
      container?.replaceChildren();
    };
  }, [lat, lng, name]);
  return <>{error && <p role="alert" className="vr-error">{error}</p>}
    <div ref={ref} className="vr-map" aria-label="Saved venue location" />
    <p className="vr-muted">Read-only saved location. Street View is available only where Google has coverage.</p>
  </>;
}

export default function VenueDetails() {
  const { id } = useParams();
  // Remount on ID changes so old photos/status never leak into another venue.
  return <VenueReview key={id} id={id} />;
}

function VenueReview({ id }) {
  const routeLocation = useLocation();
  const { checkSession } = useAdminAuth();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(routeLocation.state?.successMessage || '');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reload, setReload] = useState(0);
  const [image, setImage] = useState(null);
  const savingRef = useRef(false);
  const active = useRef(false);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      try {
        if (!/^[a-f\d]{24}$/i.test(id || '')) throw new Error('Invalid venue ID.');
        const response = await adminApi.get(`/venues/${id}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const record = response.data?.data?._id ? response.data.data : response.data;
        if (!record?._id || String(record._id) !== id) throw new Error('Unexpected venue response.');
        setVenue(record); setUncertain(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err.response?.status === 401) await checkSession();
        if (!controller.signal.aborted) setError(err.response ? getApiError(err, 'Unable to load venue.') : err.message);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load(); return () => controller.abort();
  }, [id, reload, checkSession]);

  async function updateStatus(status) {
    if (!venue || savingRef.current || uncertain || venue.verificationStatus === status) return;
    const action = status === 'approved' ? 'Approve' : 'Move to On Hold';
    const detail = status === 'approved'
      ? 'This venue can appear in customer listings if its availability is enabled.'
      : 'This venue will be excluded from approved customer listings. Existing bookings are not cancelled.';
    if (!window.confirm(`${action}: ${venue.functionHallName}?\n\n${detail}\n\nListing availability will not change.`)) return;
    savingRef.current = true; setSaving(true); setNotice(''); setError('');
    try {
      const response = await adminApi.patch(`/venues/${id}/verification`, { status });
      if (!active.current) return;
      const updated = response.data?.data?._id ? response.data.data : response.data;
      if (String(updated?._id) !== id || updated.verificationStatus !== status) throw new Error('Unexpected update response.');
      setVenue(updated);
      setNotice(status === 'approved' ? 'Venue approved successfully.' : 'Venue moved to On Hold.');
    } catch (err) {
      if (!active.current) return;
      // A timeout can happen after the server committed the change; reload before retrying.
      setUncertain(true);
      setError(`${getApiError(err, 'The update could not be confirmed.')} Reload the venue to check its current status before trying again.`);
      if (err.response?.status === 401) await checkSession();
    } finally {
      savingRef.current = false;
      if (active.current) setSaving(false);
    }
  }

  if (loading) return <div className="vr-page" role="status">Loading venue details…</div>;
  if (!venue) return <section className="vr-page"><Link to="/venues">← All venues</Link>
    <p role="alert" className="vr-error">{error || 'Venue not found.'}</p>
    <button type="button" onClick={() => setReload(n => n + 1)}>Retry</button></section>;

  const gallery = mediaList(venue.additionalImages);
  const menus = mediaList(venue.menuImages);
  const videos = mediaList(venue.hallVideos);
  const amenities = amenitiesList(venue.hallAmenities);
  const position = coordinates(venue);
  const menuBased = venue.menuAvailable === true || venue.pricingType === 'menu_based' || menus.length > 0;
  const phone = String(venue.vendorMobileNumber || '').replace(/[^\d+]/g, '');
  const included = Number(venue.includedGuestCount);
  const mapLink = position
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${position.lat},${position.lng}`)}`
    : null;

  return (
    <div className="vr-page">
      <Link to="/venues" className="vr-back">← All venues</Link>
      <header className="vr-heading">
        <div><p className="vr-eyebrow">VENUE REVIEW</p><h1>{venue.functionHallName}</h1>
          <span className="vr-category">{display(venue.venueCategory)}</span></div>
        <span className={`vr-status ${venue.verificationStatus === 'approved' ? 'vr-approved' : ''}`}>
          {statusLabel(venue.verificationStatus)}</span>
      </header>
      {notice && <p role="status" className="vr-success">{notice}</p>}
      {error && <p role="alert" className="vr-error">{error}</p>}
      <section className="vr-actions" aria-label="Approval controls">
        <div><strong>Review before approving</strong><p>Approval and listing availability are separate settings.</p></div>
        <Link
          className="primary-button vr-edit-button"
          to={`/venues/${id}/edit`}
        >
          Edit venue
        </Link>
        <button type="button" onClick={() => setReload(n => n + 1)} disabled={saving}>Reload details</button>
        <button type="button" className="vr-approve" disabled={saving || uncertain || venue.verificationStatus === 'approved'}
          onClick={() => updateStatus('approved')}>{saving ? 'Saving…' : 'Approve Venue'}</button>
        <button type="button" disabled={saving || uncertain || venue.verificationStatus === 'onhold'}
          onClick={() => updateStatus('onhold')}>Move to On Hold</button>
      </section>

      <section className="vr-panel"><h2>Cover photo & gallery</h2>
        <div className="vr-cover"><Photo photo={venue.professionalImage} label="Cover photo" onOpen={setImage} /></div>
        <div className="vr-gallery">{gallery.map((photo, index) =>
          <Photo key={`${photo._id || photo.url}-${index}`} photo={photo} label={`Gallery photo ${index + 1}`} onOpen={setImage} />)}</div>
        {!gallery.length && <p className="vr-muted">No additional photos uploaded.</p>}
      </section>

      <div className="vr-columns">
        <section className="vr-panel"><h2>Pricing</h2><dl className="vr-facts">
          <Detail label="Pricing mode" value={menuBased ? 'Menu based' : 'Fixed rent'} />
          <Detail label="Daily rent" value={menuBased ? 'Menu based — see menus below' : money(venue.rentPricePerDay)} />
          <Detail label="Advance" value={menuBased ? percent(venue.advanceAmountInPercentageForMenu) : money(venue.advanceAmount)} />
          <Detail label="Discount" value={percent(venue.discountPercentage)} />
          <Detail label="Guests included in displayed price" value={Number.isInteger(included) && included > 0 ? included : 'Not provided'} />
          <Detail label="Extra-hour charge" value={money(venue.overTimeCharges)} />
          <Detail label="Service charges (stored)" value={money(venue.serviceCharges)} />
          <Detail label="Vendor earning amount (stored)" value={money(venue.vendorEarningAmount)} />
          <Detail label="Vendor earnings after discount (stored)" value={money(venue.vendorEarningAmountAfterDiscount)} />
        </dl><p className="vr-muted">Included guests are not seating capacity. Stored financial amounts are shown without recalculating or changing them.</p></section>
        <section className="vr-panel"><h2>Venue information</h2><dl className="vr-facts">
          <Detail label="Seating capacity" value={venue.seatingCapacity} />
          <Detail label="Rooms" value={venue.bedRooms} />
          <Detail label="Hall area (sq ft)" value={venue.functionHallAreaInSft} />
          <Detail label="Food type" value={venue.foodType} />
          <Detail label="Listing availability" value={venue.available === true ? 'Available' : venue.available === false ? 'Unavailable' : 'Not set'} />
        </dl><p className="vr-muted">Listing availability is not availability for a specific event date.</p>
          <h3>Amenities</h3>
          {amenities.length ? <ul className="vr-chips">{amenities.map(item => <li key={item}>{item}</li>)}</ul>
            : <p className="vr-muted">No amenities provided.</p>}
        </section>
      </div>

      <section className="vr-panel"><h2>Description</h2>
        <p className="vr-description">{venue.description || 'No description provided.'}</p>
      </section>

      <section className="vr-panel"><h2>Menus & per-plate prices</h2>
        {menus.length ? <div className="vr-gallery">{menus.map((menu, index) => (
          <div key={`${menu._id || menu.url}-${index}`}>
            <Photo photo={menu} label={menu.menuType || `Menu ${index + 1}`} onOpen={setImage} />
            <p className="vr-menu-price">{money(menu.menuPrice)} / plate</p>
          </div>
        ))}</div> : <p className="vr-muted">No menu images uploaded.</p>}
      </section>

      <section className="vr-panel"><h2>Videos</h2>
        {videos.length ? <div className="vr-videos">{videos.map((video, index) => {
          const url = safeUrl(video.url);
          return <figure key={`${video._id || video.url}-${index}`}>
            {url ? <><video controls playsInline preload="metadata" src={url} aria-label={`Venue video ${index + 1}`} />
              <a href={url} target="_blank" rel="noopener noreferrer">Open original video {index + 1}</a></>
              : <p>Video URL unavailable.</p>}
            <figcaption>{video.filename || `Video ${index + 1}`}</figcaption>
          </figure>;
        })}</div> : <p className="vr-muted">No videos uploaded.</p>}
        {!!videos.length && <p className="vr-muted">If your browser cannot play a video format, open the original file.</p>}
      </section>

      <section className="vr-panel"><h2>Address, location & vendor</h2>
        <dl className="vr-facts">
          <Detail label="Address" value={venue.functionHallAddress?.address || venue.address} />
          <Detail label="City / locality" value={venue.functionHallAddress?.city} />
          <Detail label="Area" value={venue.county} />
          <Detail label="PIN code" value={venue.functionHallAddress?.pinCode} />
          <Detail label="Vendor phone" value={venue.vendorMobileNumber} />
          <Detail label="Latitude" value={venue.latitude} />
          <Detail label="Longitude" value={venue.longitude} />
          <Detail label="Google place reference" value={venue.locationPlaceId} />
        </dl>
        <div className="vr-links">
          {phone && <a href={`tel:${phone}`}>Call vendor</a>}
          {mapLink && <a href={mapLink} target="_blank" rel="noopener noreferrer">Open saved location in Google Maps</a>}
        </div>
        {position ? <VenueMap lat={position.lat} lng={position.lng} name={venue.functionHallName} />
          : <p className="vr-muted">No valid coordinates saved. No default location is assumed.</p>}
      </section>

      <section className="vr-panel"><h2>Record details</h2><dl className="vr-facts">
        <Detail label="Venue ID" value={venue._id} />
        <Detail label="Approval status" value={statusLabel(venue.verificationStatus)} />
        <Detail label="Created" value={dateText(venue.createdAt)} />
        <Detail label="Last updated" value={dateText(venue.updatedAt)} />
        <Detail label="Location confirmed" value={dateText(venue.locationConfirmedAt)} />
      </dl></section>
      {image && <FullImage image={image} onClose={() => setImage(null)} />}
    </div>
  );
}
