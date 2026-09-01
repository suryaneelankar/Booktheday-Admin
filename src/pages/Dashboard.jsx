import { useAdminAuth } from '../context/AdminAuthContext';

export default function Dashboard() {
  const { admin } = useAdminAuth();

  return (
    <>
      <div className="page-heading">
        <span className="section-label">OVERVIEW</span>
        <h1>Welcome, {admin?.fullName}.</h1>
        <p className="muted">
          You’re signed in to the BookTheDay admin workspace.
        </p>
      </div>

      <section className="panel" aria-labelledby="account-heading">
        <div className="panel-heading">
          <h2 id="account-heading">Your admin account</h2>
          <span className="status-pill">Signed in</span>
        </div>

        <dl className="account-details">
          <div>
            <dt>Name</dt>
            <dd>{admin?.fullName}</dd>
          </div>

          <div>
            <dt>Mobile number</dt>
            <dd>+91 {admin?.mobileNumber}</dd>
          </div>

          <div>
            <dt>Account access</dt>
            <dd>Administrator</dd>
          </div>
        </dl>
      </section>

      <section className="next-step">
        <span className="section-label">NEXT DEVELOPMENT STEP</span>
        <h2>Bring your venues into the workspace.</h2>
        <p>
          Login is connected. Venue listing, hall creation and vendor
          ownership approval are not connected in this starter yet.
        </p>
      </section>
    </>
  );
}