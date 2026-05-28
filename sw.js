const CACHE_NAME = "plantapp-v1";
const STATIC_CACHE = "plantapp-static-v1";
const DYNAMIC_CACHE = "plantapp-dynamic-v1";
const IMAGES_CACHE = "plantapp-images-v1";

const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css",
  "./sw.js"
];

// Instalación del Service Worker
self.addEventListener("install", event => {
  console.log("Service Worker: Instalando...");
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log("Service Worker: Cacheando archivos estáticos");
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log("Error al cachear:", err))
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener("activate", event => {
  console.log("Service Worker: Activado");
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== IMAGES_CACHE) {
            console.log("Service Worker: Eliminando caché vieja:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de caché: Stale While Revalidate (para assets)
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  
  // Estrategia 1: Network First para HTML
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(response => response || createOfflinePage());
        })
    );
    return;
  }

  // Estrategia 2: Cache First para imágenes
  if (event.request.destination === "image") {
    event.respondWith(
      caches.open(IMAGES_CACHE)
        .then(cache => {
          return cache.match(event.request)
            .then(response => {
              if (response) return response;
              
              return fetch(event.request)
                .then(response => {
                  const clonedResponse = response.clone();
                  cache.put(event.request, clonedResponse);
                  return response;
                })
                .catch(() => {
                  return new Response(
                    '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><text x="10" y="50">Imagen no disponible</text></svg>',
                    { headers: { 'Content-Type': 'image/svg+xml' } }
                  );
                });
            });
        })
    );
    return;
  }

  // Estrategia 3: Stale While Revalidate para CSS, JS y otros
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            const clonedResponse = networkResponse.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(event.request, clonedResponse);
              });
            
            return networkResponse;
          })
          .catch(() => response);
        
        return response || fetchPromise;
      })
  );
});

// Página offline personalizada
function createOfflinePage() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PlantApp - Offline</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #000000;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          color: #fff;
        }
        .container {
          max-width: 600px;
          background: rgb(197, 215, 216);
          padding: 40px;
          border-radius: 15px;
          text-align: center;
          color: #000;
        }
        h1 {
          color: #2e7d32;
          margin-bottom: 20px;
        }
        p {
          font-size: 16px;
          line-height: 1.5;
        }
        .emoji {
          font-size: 50px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="emoji">🌿</div>
        <h1>PlantApp - Modo Offline</h1>
        <p>No hay conexión a internet en este momento.</p>
        <p>Algunos datos en caché pueden estar disponibles cuando reconectes.</p>
        <p>Por favor, verifica tu conexión y recarga la página.</p>
      </div>
    </body>
    </html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

// Sincronización en segundo plano (Background Sync)
self.addEventListener("sync", event => {
  if (event.tag === "sync-plants") {
    event.waitUntil(
      fetch("./index.html")
        .then(() => console.log("✅ Sincronización completada"))
        .catch(err => console.log("❌ Error en sincronización:", err))
    );
  }
});

// Manejo de mensajes desde la app
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});