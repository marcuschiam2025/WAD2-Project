# Vercel deployment

Project: `minxie-ngs-projects/bidmaxxer`.
Production URL: https://bidmaxxer.vercel.app
Use Node.js 24 LTS for both services and the Vercel project.

The backend's committed `jwks-rsa` patch replaces eager `require('jose')` calls
with dynamic imports for Vercel's module loader. Keep the patch and its lockfile
entry together; `config/firebase-compat.test.js` checks signing-key loading with
ES-module `require()` disabled.

Deploy the repository root, with `vercel.json` defining the Vite frontend and
Express backend as services. `/api/*` reaches Express with its original path;
other requests reach the frontend, including Vue Router deep links.

`backend/vercel.js` connects MongoDB before exporting Express. Local development
continues to use `backend/server.js` and the Vite API proxy.

Configure the following in the Vercel project's Production environment:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`:
  public Firebase web configuration, available during the frontend build.
- `MONGODB_URI`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`: server credentials, stored as sensitive variables.
- `CLIENT_ORIGIN`: the deployed frontend's HTTPS origin.

Keep `VITE_API_URL` unset so requests use the deployment's own `/api`. Firebase
Authentication must authorize the deployed hostname. MongoDB Atlas must permit
connections from the deployment. Do not seed or reset the database to deploy.

The `.vercel` directory and real environment files stay out of Git and uploads.
Preview deployments need separately configured credentials; production secrets
are not copied to Preview automatically.

To deploy the current checkout with the Vercel CLI:

```sh
vercel link --yes --scope minxie-ngs-projects --project bidmaxxer
vercel deploy --prod --yes --scope minxie-ngs-projects
```

The intended automatic Production branch is `dev` in
`marcuschiam2025/WAD2-Project`. This project was initially deployed from the local
checkout; automatic Git deployments require granting the Vercel GitHub app access
to that repository, connecting it in Vercel, and selecting `dev` as the Production
branch. Preview credentials are configured separately from Production.

Verify the landing page, a direct `/planner` navigation, `/api/health`, the public
module catalogue, and Google sign-in after deployment.
