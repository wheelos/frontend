# Native traffic-sign notification

The Dreamview app shell displays traffic-sign detections at the top left without
requiring map initialization or a selected workspace. Backend integration lives
in `wheelos/apollo-base`; this frontend checkout owns the native notification.

The existing `/websocket` receives JSON with type `TrafficSignDetection` and a
`signs` array of `{classId, className, score}`. The backend reads the typed Cyber
channel `/perception/traffic_signs`. Only valid labels and scores in [0, 1] are
displayed. Multiple detections of a label show its highest confidence. Empty
frames, disconnection, or two seconds without updates clear the notification.
Expiry uses receipt time so historical records work correctly.

Build with `yarn install --frozen-lockfile && npm run build`; run the regression
checks with `node tests/traffic_signs.cjs`. Serve `dist` with Dreamview's
`--static_file_dir=/apollo/data/frontend/dist` flag.

See `modules/traffic_sign/docs/simulation.md` in apollo-base for test-data
preparation, TensorRT engine generation, replay commands, expected channel
output, and manual UI verification. The camera-only fixture intentionally does
not initialize the map; the notification still appears over the loading screen.

## Sign icons

The native top-left notification maps 16 semantic `signType` values to bundled SVGs in `src/components/TrafficSignNotification/icons`. It displays the icon, readable name, and confidence. Unknown or legacy types retain a text notification without a broken image.

Pedestrian crossing and speed limits 30/40/50/60/70 use the user-supplied local SVGs. Speed limit 10 uses the reviewed generated SVG. Remaining signs use public-domain Slovenia road-sign SVGs from Wikimedia Commons. Direction arrows are mapped by semantic meaning, not by the SVG filename code. Supplied SVG metadata is preserved.
