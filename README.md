# Run locally

Do **not** open `index.html` by double-clicking it. Firebase's JavaScript modules must be served over HTTP/HTTPS, not from a `file:///` URL.

From this folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local-server.ps1
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

If port 8080 is busy, choose another port:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local-server.ps1 -Port 8081
```

Then visit `http://localhost:8081`.

For Google sign-in, also add `localhost` and your deployment domain to **Firebase Authentication → Settings → Authorized domains**.

