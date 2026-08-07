const protobuf = require('protobufjs/light');
const { decompress } = require('fzstd');
const simWorldRoot = protobuf.Root.fromJSON(
  require('proto_bundle/sim_world_proto_bundle.json'),
);

const SimWorldMessage = simWorldRoot.lookupType('apollo.dreamview.SimulationWorld');
const mapMessage = simWorldRoot.lookupType('apollo.hdmap.Map');
const cameraMessage = simWorldRoot.lookupType('apollo.dreamview.CameraUpdate');
const pointCloudRoot = protobuf.Root.fromJSON(
  require('proto_bundle/point_cloud_proto_bundle.json'),
);

const pointCloudMessage = pointCloudRoot.lookupType('apollo.dreamview.PointCloud');
const zstdHeader = new Uint8Array([68, 86, 90, 83, 84, 68, 1]);

function decodeRealtimePayload(data) {
  const bytes = new Uint8Array(data);
  for (let i = 0; i < zstdHeader.length; i += 1) {
    if (bytes[i] !== zstdHeader[i]) {
      return bytes;
    }
  }
  return decompress(bytes.subarray(zstdHeader.length));
}

self.addEventListener('message', (event) => {
  let message = null;
  const { data } = event.data;
  switch (event.data.source) {
    case 'realtime':
      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else {
        message = SimWorldMessage.toObject(
          SimWorldMessage.decode(decodeRealtimePayload(data)),
          { enums: String },
        );
        message.type = 'SimWorldUpdate';
      }
      break;
    case 'map':
      message = mapMessage.toObject(
        mapMessage.decode(new Uint8Array(data)),
        { enums: String },
      );
      message.type = 'MapData';
      break;
    case 'point_cloud':
      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else {
        message = pointCloudMessage.toObject(pointCloudMessage.decode(new Uint8Array(data)), { arrays: true });
      }
      break;
    case 'camera':
      message = cameraMessage.toObject(cameraMessage.decode(new Uint8Array(data)), { enums: String });
      message.type = 'CameraData';
      break;
    case 'teleop':
      if (typeof data === 'string') {
        message = JSON.parse(data);
      }
      break;
    default:
      console.error('Unknown data source found:', event.data.source);
      break;
  }

  if (message) {
    self.postMessage(message);
  }
});
