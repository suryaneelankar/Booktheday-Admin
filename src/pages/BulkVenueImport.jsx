import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import adminApi, { getApiError } from '../api/adminApi';
import '../styles/bulk-venue-import.css';

const BATCH_SIZE = 50;

const TEMPLATE_HEADERS = [
  'recordId',
  'functionHallName',
  'venueCategory',
  'vendorMobileNumber',
  'description',
  'foodType',
  'seatingCapacity',
  'includedGuestCount',
  'bedRooms',
  'functionHallAreaInSft',
  'amenities',
  'available',
  'fullAddress',
  'locality',
  'city',
  'pinCode',
  'latitude',
  'longitude',
  'locationPlaceId',
  'rentPricePerDay',
  'advanceAmount',
  'discountPercentage',
  'overTimeCharges',
  'menuAvailable',
  'menuAdvancePercentage',
  'menuPackages',
  'professionalImageUrl',
  'additionalImageUrls',
  'videoUrls',
];

const HEADER_ALIASES = {
  'record id': 'recordId',
  'venue name': 'functionHallName',
  'venue category': 'venueCategory',
  'primary phone': 'vendorMobileNumber',
  'vendor mobile number': 'vendorMobileNumber',
  'full address': 'fullAddress',
  'locality/area': 'locality',
  'locality / area': 'locality',
  'pin': 'pinCode',
  'rent per day': 'rentPricePerDay',
  'advance amount': 'advanceAmount',
  'seating capacity': 'seatingCapacity',
  'number of rooms': 'bedRooms',
  'food type': 'foodType',
  'professional image url': 'professionalImageUrl',
  'additional image urls': 'additionalImageUrls',
};

function parseCsv(text) {
  const records = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      if (row.some(cell => cell.trim())) records.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  row.push(value.replace(/\r$/, ''));
  if (row.some(cell => cell.trim())) records.push(row);
  if (quoted) throw new Error('The CSV contains an unclosed quoted value.');
  return records;
}

function canonicalHeader(value) {
  const trimmed = String(value || '').replace(/^\uFEFF/, '').trim();
  return HEADER_ALIASES[trimmed.toLowerCase()] || trimmed;
}

function csvRows(text) {
  const records = parseCsv(text);
  if (records.length < 2) throw new Error('The CSV must contain a header and at least one venue.');
  const headers = records[0].map(canonicalHeader);
  if (!headers.includes('recordId')) throw new Error('The CSV must contain a recordId column.');
  return records.slice(1).map((record) => Object.fromEntries(
    headers.map((header, index) => [header, String(record[index] || '').trim()]),
  ));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadText(filename, text) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function templateCsv() {
  const example = {
    recordId: 'BTD-FARM-0001',
    functionHallName: "Cebo's Tranquil",
    venueCategory: 'Farm House',
    vendorMobileNumber: '9059975076',
    description: 'Private farmhouse suitable for stays and celebrations.',
    foodType: 'non-veg',
    seatingCapacity: '50-100',
    includedGuestCount: '5',
    bedRooms: '3',
    functionHallAreaInSft: '12000',
    amenities: 'Parking;Restrooms/Toilets;Air Conditioners (AC);Bedrooms;Kitchen Space;Swimming Pool;Private Lawn / Open Area;Power Backup',
    available: 'Yes',
    fullAddress: 'Sardar Nagar, Thukkuguda, Telangana 501359',
    locality: 'Thukkuguda',
    city: 'Hyderabad',
    pinCode: '501359',
    latitude: '17.223233',
    longitude: '78.484350',
    rentPricePerDay: '40000',
    advanceAmount: '10000',
    discountPercentage: '0',
    menuAvailable: 'No',
    professionalImageUrl: 'https://example.com/cover.jpg',
    additionalImageUrls: 'https://example.com/1.jpg;https://example.com/2.jpg;https://example.com/3.jpg;https://example.com/4.jpg',
  };
  return [
    TEMPLATE_HEADERS.join(','),
    TEMPLATE_HEADERS.map(header => csvEscape(example[header] || '')).join(','),
  ].join('\n');
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export default function BulkVenueImport() {
  const [fileName, setFileName] = useState('');
  const [mediaArchive, setMediaArchive] = useState(null);
  const [rows, setRows] = useState([]);
  const [validation, setValidation] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);

  const summary = useMemo(() => ({
    valid: validation.filter(item => item.valid && !item.alreadyImported).length,
    invalid: validation.filter(item => !item.valid).length,
    existing: validation.filter(item => item.alreadyImported).length,
    created: results.filter(item => item.status === 'created').length,
    skipped: results.filter(item => item.status === 'skipped').length,
    failed: results.filter(item => item.status === 'failed').length,
  }), [validation, results]);

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setValidation([]);
    setResults([]);
    try {
      const parsed = csvRows(await file.text());
      if (parsed.length > 2000) throw new Error('Use at most 2,000 venues in one CSV.');
      setRows(parsed);
      setFileName(file.name);
    } catch (failure) {
      setRows([]);
      setFileName('');
      setError(failure.message);
    }
  }

  function chooseMediaArchive(event) {
    const file = event.target.files?.[0] || null;
    setError('');
    setValidation([]);
    setResults([]);
    setProgress(0);
    if (file && !file.name.toLowerCase().endsWith('.zip')) {
      setMediaArchive(null);
      setError('Select a .zip media archive.');
      return;
    }
    if (file && file.size > 500 * 1024 * 1024) {
      setMediaArchive(null);
      setError('The media ZIP must be at most 500 MB.');
      return;
    }
    setMediaArchive(file);
  }

  async function validateImport() {
    if (!rows.length || working) return;
    setWorking(true);
    setError('');
    setValidation([]);
    setResults([]);
    setProgress(0);
    try {
      if (mediaArchive) {
        if (rows.length > BATCH_SIZE) {
          throw new Error('A CSV with a media ZIP can contain at most 50 venues. Use about 20 per archive for faster uploads.');
        }
        const form = new FormData();
        form.append('rows', JSON.stringify(rows));
        form.append('mediaArchive', mediaArchive);
        const response = await adminApi.post(
          '/venues/bulk/validate-with-media',
          form,
          {
            timeout: 10 * 60 * 1000,
            onUploadProgress: event => {
              if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
            },
          },
        );
        setValidation(response.data.data);
        setProgress(100);
        return;
      }
      const batches = chunks(rows, BATCH_SIZE);
      const collected = [];
      for (let index = 0; index < batches.length; index += 1) {
        const response = await adminApi.post('/venues/bulk/validate', { rows: batches[index] });
        const offset = index * BATCH_SIZE;
        collected.push(...response.data.data.map(item => ({
          ...item,
          rowNumber: item.rowNumber + offset,
        })));
        setProgress(Math.round(((index + 1) / batches.length) * 100));
      }
      setValidation(collected);
    } catch (failure) {
      setError(getApiError(failure, 'Unable to validate the venue file.'));
    } finally {
      setWorking(false);
    }
  }

  async function importVenues() {
    if (working || summary.invalid || !summary.valid) return;
    if (!window.confirm(`Create ${summary.valid} validated venue(s) as On Hold?`)) return;
    setWorking(true);
    setError('');
    setResults([]);
    setProgress(0);
    try {
      if (mediaArchive) {
        const form = new FormData();
        form.append('confirmed', 'true');
        form.append('rows', JSON.stringify(rows));
        form.append('mediaArchive', mediaArchive);
        const response = await adminApi.post(
          '/venues/bulk/import-with-media',
          form,
          {
            timeout: 20 * 60 * 1000,
            onUploadProgress: event => {
              if (event.total) setProgress(Math.round((event.loaded / event.total) * 85));
            },
          },
        );
        setResults(response.data.data);
        setProgress(100);
        return;
      }
      const existingKeys = new Set(
        validation.filter(item => item.alreadyImported).map(item => item.recordId),
      );
      const pending = rows.filter(row => !existingKeys.has(String(row.recordId || '').trim().toUpperCase()));
      const batches = chunks(pending, BATCH_SIZE);
      const collected = [];
      for (let index = 0; index < batches.length; index += 1) {
        const response = await adminApi.post('/venues/bulk/import', {
          confirmed: true,
          rows: batches[index],
        });
        const offset = index * BATCH_SIZE;
        collected.push(...response.data.data.map(item => ({
          ...item,
          rowNumber: item.rowNumber ? item.rowNumber + offset : item.rowNumber,
        })));
        setResults([...collected]);
        setProgress(Math.round(((index + 1) / batches.length) * 100));
      }
    } catch (failure) {
      setError(getApiError(failure, 'The import stopped. Already-created record IDs are safe to retry.'));
    } finally {
      setWorking(false);
    }
  }

  function downloadErrors() {
    const failed = validation.filter(item => !item.valid);
    const text = [
      'rowNumber,recordId,venueName,errors',
      ...failed.map(item => [
        item.rowNumber,
        item.recordId,
        item.venueName,
        item.errors.join(' | '),
      ].map(csvEscape).join(',')),
    ].join('\n');
    downloadText('booktheday-import-errors.csv', text);
  }

  return (
    <div className="bulk-import-page">
      <header className="bulk-heading">
        <Link to="/venues">← All venues</Link>
        <span className="section-label">VENUE OPERATIONS</span>
        <h1>Bulk import venues</h1>
        <p>Validate a spreadsheet, review every issue and create approved rows as On Hold listings.</p>
      </header>

      {error && <div className="error-message" role="alert">{error}</div>}

      <section className="panel bulk-step">
        <div className="bulk-step-number">1</div>
        <div className="bulk-step-body">
          <h2>Prepare the spreadsheet</h2>
          <p className="muted">Use the template column names. Media URLs can be left empty when you attach a correctly named media ZIP.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => downloadText('booktheday-venue-import-template.csv', templateCsv())}
          >
            Download CSV template
          </button>
        </div>
      </section>

      <section className="panel bulk-step">
        <div className="bulk-step-number">2</div>
        <div className="bulk-step-body">
          <h2>Select venue CSV and media</h2>
          <div className="bulk-file-grid">
            <label className="bulk-dropzone">
              <input type="file" accept=".csv,text/csv" onChange={chooseFile} />
              <strong>{fileName || 'Choose venue CSV'}</strong>
              <span>{rows.length ? `${rows.length.toLocaleString('en-IN')} venue rows loaded` : 'Required spreadsheet'}</span>
            </label>
            <label className="bulk-dropzone bulk-media-dropzone">
              <input type="file" accept=".zip,application/zip" onChange={chooseMediaArchive} />
              <strong>{mediaArchive?.name || 'Choose media ZIP (optional)'}</strong>
              <span>{mediaArchive ? `${(mediaArchive.size / 1024 / 1024).toFixed(1)} MB selected` : 'Use this instead of media URLs; maximum 500 MB'}</span>
            </label>
          </div>
          <details className="bulk-media-help">
            <summary>Required ZIP folder and file names</summary>
            <p>Use one folder per CSV record ID. Each folder needs one cover and 4–8 additional images. Videos are optional, up to three.</p>
            <pre>{`venue-media.zip
├── BTD-FARM-0001/
│   ├── cover.jpg
│   ├── image-1.jpg
│   ├── image-2.jpg
│   ├── image-3.jpg
│   ├── image-4.jpg
│   └── video-1.mp4
└── BTD-HALL-0002/
    ├── cover.webp
    └── image-1.jpg ... image-4.jpg`}</pre>
            <p>Images: JPG, PNG or WebP, maximum 8 MB each. Videos: MP4, WebM or MOV, maximum 35 MB each. Use about 20 venues per ZIP; the hard limit is 50.</p>
          </details>
          <button
            type="button"
            className="primary-button"
            disabled={!rows.length || working}
            onClick={validateImport}
          >
            {working && !validation.length ? 'Validating…' : 'Validate venues'}
          </button>
        </div>
      </section>

      {(working || validation.length > 0 || results.length > 0) && (
        <section className="panel bulk-results">
          <div className="bulk-results-header">
            <div>
              <span className="section-label">IMPORT REVIEW</span>
              <h2>{results.length ? 'Import results' : 'Validation results'}</h2>
            </div>
            {working && <strong>{progress}%</strong>}
          </div>
          <div className="bulk-progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="bulk-summary">
            <div><strong>{summary.valid}</strong><span>Ready</span></div>
            <div><strong>{summary.invalid}</strong><span>Need changes</span></div>
            <div><strong>{summary.existing}</strong><span>Already imported</span></div>
            <div><strong>{summary.created}</strong><span>Created</span></div>
          </div>

          {validation.length > 0 && !results.length && (
            <div className="bulk-actions">
              <button
                type="button"
                className="primary-button"
                disabled={working || summary.invalid > 0 || summary.valid === 0}
                onClick={importVenues}
              >
                Import {summary.valid} venue{summary.valid === 1 ? '' : 's'} as On Hold
              </button>
              {summary.invalid > 0 && (
                <button type="button" className="secondary-button" onClick={downloadErrors}>
                  Download error report
                </button>
              )}
            </div>
          )}

          <div className="bulk-table-wrap">
            <table className="bulk-table">
              <thead><tr><th>Row</th><th>Record ID</th><th>Venue</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>
                {(results.length ? results : validation).slice(0, 500).map((item, index) => {
                  const status = results.length
                    ? item.status
                    : item.alreadyImported ? 'existing' : item.valid ? 'ready' : 'invalid';
                  return (
                    <tr key={`${item.recordId}-${item.rowNumber}-${index}`}>
                      <td>{item.rowNumber || '—'}</td>
                      <td><code>{item.recordId || 'Missing'}</code></td>
                      <td>{item.venueName || 'Unnamed venue'}</td>
                      <td><span className={`bulk-status ${status}`}>{status}</span></td>
                      <td>{item.errors?.join(' · ') || item.reason || (item.linkedToVendor ? 'Linked to approved vendor' : '—')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
